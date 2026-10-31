/**
 * Окно отчёта с кнопки-жучка: снимок экрана, на нём можно обвести проблемное место рамкой (РАМКА) и/или обрезать
 * (ОБРЕЗАТЬ → ПРИМЕНИТЬ); ошибка или предложение, текст (или голосом), ОТПРАВИТЬ.
 * Вместе с отчётом уходят сведения (lib/diag.ts): приложение, устройство, экран, состояние, журнал событий, падение.
 * Своё окно-модалка поверх всего; рамка «впекается» в снимок снимком самого превью.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appendText, useDictation } from '@/containers/account/useDictation';
import { DEVICE } from '@/containers/account/FeedbackContainer';
import { sendFeedback, type FeedbackKind } from '@/lib/api';
import { useBug, type BugReportDraft } from '@/lib/bugReport';
import { ShotViewer } from './ShotViewer';
import { collectContext, logError } from '@/lib/diag';
import { captureView, cropImage, imageSize, jpegBase64 } from '@/lib/screenshot';
import { useStore } from '@/lib/store';
import { Icon, fonts, size as S, useInputColors, useTheme } from '@/ui';

type Rect = { x: number; y: number; w: number; h: number };
type Mode = 'frame' | 'crop';

const norm = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});
const big = (r: Rect | null): r is Rect => !!r && r.w > 12 && r.h > 12;

/** Состояние приложения для отчёта: только служебное, без текстов дел и заметок */
function appState(): Record<string, unknown> {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const len = (k: string) => (Array.isArray(s[k]) ? (s[k] as unknown[]).length : undefined);
  const pick = (k: string) => s[k];
  return {
    signedIn: !!pick('session'),
    currentGroupId: pick('currentGroupId'),
    tasksView: pick('tasksView'),
    calendarView: pick('calendarView'),
    calendarDate: pick('calendarDate'),
    theme: pick('theme'),
    micMode: pick('micMode'),
    voiceLang: pick('voiceLang'),
    net: pick('net'),
    serverApi: pick('serverApi'),
    outbox: len('outbox'),
    counts: { groups: len('groups'), tasks: len('tasks'), watch: len('watch'), wishes: len('wishes'), topics: len('topics'), ideas: len('ideas') },
  };
}

function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }, disabled && styles.faded]}
    >
      <Text style={[styles.chipText, { color: on ? c.bg : c.text }]}>{label}</Text>
    </Pressable>
  );
}

function Editor({ draft }: { draft: BugReportDraft }) {
  const { c } = useTheme();
  const ic = useInputColors();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const close = useBug((s) => s.close);
  const [shot, setShot] = useState(draft.shot);
  const [img, setImg] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<Mode>('frame');
  const [frame, setFrame] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [live, setLive] = useState<Rect | null>(null);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<View>(null);
  const dictation = useDictation((t) => setText((cur) => appendText(cur, t)), setError);

  useEffect(() => {
    if (!shot) return setImg(null);
    let alive = true;
    imageSize(shot)
      .then((sz) => alive && setImg(sz))
      .catch(() => alive && setImg({ width: screenW, height: screenH }));
    return () => {
      alive = false;
    };
  }, [shot, screenW, screenH]);

  // Превью — во всю ширину окна (снимок почти в натуральную величину), не выше 80% экрана
  const box = useMemo(() => {
    if (!img) return null;
    const maxW = screenW - 32;
    const maxH = screenH * 0.8;
    const k = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * k, h: img.height * k, k };
  }, [img, screenW, screenH]);
  const [zoom, setZoom] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const boxRef = useRef(box);
  boxRef.current = box;
  const draw = useMemo(() => {
    let a = { x: 0, y: 0 };
    const inside = (x: number, y: number) => {
      const b = boxRef.current;
      return b ? { x: Math.min(Math.max(x, 0), b.w), y: Math.min(Math.max(y, 0), b.h) } : { x, y };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        a = inside(e.nativeEvent.locationX, e.nativeEvent.locationY);
        setLive(null);
      },
      onPanResponderMove: (_e, g) => setLive(norm(a, inside(a.x + g.dx, a.y + g.dy))),
      onPanResponderRelease: (_e, g) => {
        const r = norm(a, inside(a.x + g.dx, a.y + g.dy));
        setLive(null);
        if (!big(r)) return;
        if (modeRef.current === 'frame') setFrame(r);
        else setCrop(r);
      },
    });
  }, []);

  /** Обрезать снимок по рамке обрезки: превью → пиксели картинки */
  const applyCrop = useCallback(async () => {
    if (!shot || !box || !big(crop)) return;
    try {
      const out = await cropImage(shot, { x: crop.x / box.k, y: crop.y / box.k, w: crop.w / box.k, h: crop.h / box.k });
      setShot(out.uri);
      setImg({ width: out.width, height: out.height });
      setCrop(null);
      setFrame(null);
      setMode('frame');
    } catch (e) {
      logError(e);
      setError('Не обрезалось');
    }
  }, [shot, box, crop]);

  const reset = useCallback(() => {
    setShot(draft.shot);
    setFrame(null);
    setCrop(null);
  }, [draft.shot]);

  const send = useCallback(async () => {
    if (busy || dictation.state !== 'idle') return;
    if (!text.trim() && !shot) return setError('Опишите, что случилось');
    setBusy(true);
    setError(null);
    let screenshot: string | null = null;
    try {
      if (shot) {
        // Рамка — впекается снимком превью (без рамки обрезки), иначе — сам снимок
        const uri = frame ? await captureView(preview) : shot;
        const sz = frame ? await imageSize(uri) : (img ?? (await imageSize(uri)));
        screenshot = await jpegBase64(uri, sz.width);
      }
    } catch (e) {
      logError(e);
    }
    const context = collectContext(draft.route, appState(), {
      ...(draft.crash && { crash: draft.crash }),
      ...(shot && !screenshot && { screenshotFailed: true }),
    });
    const problem = await sendFeedback(kind, text.trim() || (draft.crash ? 'Приложение упало' : 'Без описания'), DEVICE, { screenshot, context });
    setBusy(false);
    if (problem) return setError(problem);
    useStore.getState().notice('Спасибо, отчёт отправлен');
    close();
  }, [busy, dictation.state, text, shot, frame, img, draft, kind, close]);

  const recording = dictation.state === 'recording';
  const rectStyle = (r: Rect, color: string, dashed?: boolean) => ({
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    borderColor: color,
    borderStyle: dashed ? ('dashed' as const) : ('solid' as const),
  });

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.text }]}>{draft.crash ? 'Отчёт о падении' : 'Отчёт'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={10} onPress={close}>
            <Icon name="close" size={18} color={c.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {shot && box ? (
            <>
              <View style={[styles.previewWrap, { borderColor: c.border }]}>
                <View ref={preview} collapsable={false} style={{ width: box.w, height: box.h }}>
                  <Image source={{ uri: shot }} style={{ width: box.w, height: box.h }} resizeMode="stretch" />
                  {frame ? <View pointerEvents="none" style={[styles.rect, rectStyle(frame, c.red)]} /> : null}
                </View>
                {crop ? <View pointerEvents="none" style={[styles.rect, rectStyle(crop, c.text, true)]} /> : null}
                {live ? <View pointerEvents="none" style={[styles.rect, rectStyle(live, mode === 'frame' ? c.red : c.text, mode === 'crop')]} /> : null}
                <View {...draw.panHandlers} style={StyleSheet.absoluteFill} />
              </View>
              <View style={styles.row}>
                <Chip label="РАМКА" on={mode === 'frame'} onPress={() => setMode('frame')} />
                <Chip label="ОБРЕЗАТЬ" on={mode === 'crop'} onPress={() => setMode('crop')} />
                {crop ? <Chip label="ПРИМЕНИТЬ" onPress={() => void applyCrop()} /> : null}
                {frame || crop || shot !== draft.shot ? <Chip label="СБРОСИТЬ" onPress={reset} /> : null}
                <Chip label="УВЕЛИЧИТЬ" onPress={() => setZoom(true)} />
                <Chip label="БЕЗ СНИМКА" onPress={() => setShot(null)} />
              </View>
            </>
          ) : draft.shot && !shot ? (
            <View style={styles.row}>
              <Chip label="ВЕРНУТЬ СНИМОК" onPress={reset} />
            </View>
          ) : null}

          <View style={styles.row}>
            <Chip label="ОШИБКА" on={kind === 'bug'} onPress={() => setKind('bug')} />
            <Chip label="ПРЕДЛОЖЕНИЕ" on={kind === 'idea'} onPress={() => setKind('idea')} />
          </View>

          <View>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              editable={!busy && dictation.state === 'idle'}
              maxLength={4000}
              placeholder={kind === 'bug' ? 'Что случилось' : 'Что предлагаете'}
              placeholderTextColor={c.muted}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              selectionColor={ic.selectionColor}
              cursorColor={ic.cursorColor}
              style={[styles.input, { color: c.text, backgroundColor: c.panel, borderColor: c.border }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Остановить и распознать' : 'Надиктовать'}
              disabled={busy || dictation.state === 'working'}
              onPress={() => void dictation.toggle()}
              hitSlop={6}
              style={[styles.mic, { backgroundColor: recording ? c.red : c.text }]}
            >
              {dictation.state === 'working' ? (
                <ActivityIndicator size="small" color={c.bg} />
              ) : recording ? (
                <View style={[styles.stop, { backgroundColor: c.bg }]} />
              ) : (
                <Icon name="mic" size={20} color={c.bg} />
              )}
            </Pressable>
          </View>
          {error ? <Text style={[styles.error, { color: c.red }]}>{error}</Text> : null}
        </ScrollView>
        <ShotViewer uri={zoom ? shot : null} size={img} onClose={() => setZoom(false)} />
        <View style={[styles.buttons, { borderTopColor: c.hair }]}>
          <Pressable accessibilityRole="button" onPress={close} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
            <Text style={[styles.buttonText, { color: c.text }]}>ОТМЕНА</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void send()}
            style={[styles.button, { borderColor: c.text, backgroundColor: c.text }, busy && styles.faded]}
          >
            {busy ? <ActivityIndicator size="small" color={c.bg} /> : <Text style={[styles.buttonText, { color: c.bg }]}>ОТПРАВИТЬ</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Окно отчёта — открыто, пока в useBug есть черновик */
export function BugReport() {
  const draft = useBug((s) => s.report);
  const close = useBug((s) => s.close);
  return (
    <Modal visible={!!draft} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      {draft ? <Editor draft={draft} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.sans700, fontSize: 22, letterSpacing: -0.6 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  previewWrap: { alignSelf: 'center', borderWidth: S.border },
  rect: { position: 'absolute', borderWidth: 2.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8 },
  faded: { opacity: 0.5 },
  input: { minHeight: 140, borderWidth: S.border, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 60, fontFamily: fonts.sans400, fontSize: 15, lineHeight: 20 },
  mic: { position: 'absolute', right: 10, bottom: 10, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 14, height: 14 },
  error: { fontFamily: fonts.mono400, fontSize: 11, letterSpacing: 0.4 },
  buttons: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: S.hairline },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9 },
});
