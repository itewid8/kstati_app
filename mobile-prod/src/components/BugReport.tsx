/**
 * Окно отзыва с кнопки-жучка (макет bug-report-mock): шапка «ОТЗЫВ / Ошибка» с «отменить / вернуть» для действий со снимком;
 * блок СНИМОК — рамка вокруг места с проблемой, обрезка (выделить → ОБРЕЗАТЬ), на весь экран, убрать; ОШИБКА / ИДЕЯ;
 * текст (или голосом); свёрнутые «Сведения» — что уйдёт вместе с отзывом; ОТПРАВИТЬ.
 * Вместе с отчётом уходят сведения (lib/diag.ts): приложение, устройство, экран, состояние, журнал событий, падение.
 * Своё окно-модалка поверх всего; рамка «впекается» в снимок снимком самого превью.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { Icon, fonts, size as S, useInputColors, useTheme, type IconName } from '@/ui';

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

type Btn = { label?: string; icon?: IconName; on?: boolean; strong?: boolean; disabled?: boolean; onPress?: () => void; a11y?: string; style?: object };

/** Кнопка-плашка с рамкой: текст моноширинным или значок */
function Tool({ label, icon, on, strong, disabled, onPress, a11y, style }: Btn) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, icon && !label ? styles.toolIcon : styles.flex, { borderColor: strong ? c.text : c.border, backgroundColor: on ? c.text : c.panel }, disabled && styles.off, style]}
    >
      {icon ? <Icon name={icon} size={14} color={on ? c.bg : c.text} /> : null}
      {label ? <Text style={[styles.toolText, on && styles.toolTextOn, { color: on ? c.bg : c.text }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Квадратная кнопка шапки */
function HeadButton({ icon, size = 40, disabled, onPress, a11y }: { icon: IconName; size?: number; disabled?: boolean; onPress?: () => void; a11y: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.sq, { width: size, height: size, borderColor: c.border, backgroundColor: c.panel }, disabled && styles.off]}
    >
      <Icon name={icon} size={14} color={c.text} />
    </Pressable>
  );
}

/** Блок с рамкой и тёмной полосой-заголовком (СНИМОК · РАМКА) */
function Box({ head, aside, children }: { head?: string; aside?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
      {head ? (
        <View style={[styles.boxHead, { backgroundColor: c.text }]}>
          <Text style={[styles.boxHeadText, { color: c.bg }]}>{head}</Text>
          {aside ? <Text style={[styles.boxHeadText, { color: c.bg }]}>{aside}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const eventsWord = (n: number) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'СОБЫТИЕ';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'СОБЫТИЯ';
  return 'СОБЫТИЙ';
};

/** Что уйдёт вместе с отзывом — строками «ЭКРАН / ВЕРСИЯ / …» */
function infoRows(ctx: Record<string, unknown>, crash: BugReportDraft['crash']): [string, string][] {
  const app = (ctx.app ?? {}) as { version?: string; build?: string | number };
  const dev = (ctx.device ?? {}) as { os?: string; osVersion?: string; model?: string | null };
  const st = (ctx.state ?? {}) as { serverApi?: number; net?: string; outbox?: number; tasksView?: string };
  const events = Array.isArray(ctx.events) ? ctx.events.length : 0;
  const route = String(ctx.route ?? '');
  const os = dev.os === 'ios' ? 'iOS' : dev.os === 'android' ? 'Android' : (dev.os ?? '');
  const rows: [string, string][] = [
    ['ЭКРАН', route || '—'],
    ['ВЕРСИЯ', `${app.version ?? '—'} (${app.build ?? '—'})${st.serverApi ? ` · API ${st.serverApi}` : ''}`],
    ['ТЕЛЕФОН', [dev.model, `${os} ${dev.osVersion ?? ''}`.trim()].filter(Boolean).join(' · ')],
    ['СВЯЗЬ', `${st.net === 'offline' ? 'НЕТ СВЯЗИ' : 'СЕРВЕР ОТВЕЧАЕТ'} · ${st.outbox ?? 0} В ОЧЕРЕДИ`],
    ['ЖУРНАЛ', `${events} ${eventsWord(events)} · БЕЗ ТЕКСТОВ`],
  ];
  if (crash) rows.push(['ПАДЕНИЕ', crash.message.slice(0, 120)]);
  return rows;
}

/** Состояние снимка для «отменить / вернуть»: сам снимок (после обрезки — новый файл) и рамка на нём */
type Snap = { shot: string | null; frame: Rect | null };

function Editor({ draft }: { draft: BugReportDraft }) {
  const { c } = useTheme();
  const ic = useInputColors();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const close = useBug((s) => s.close);
  const [hist, setHist] = useState<{ list: Snap[]; at: number }>({ list: [{ shot: draft.shot, frame: null }], at: 0 });
  const { shot, frame } = hist.list[hist.at]!;
  const [img, setImg] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<Mode>('frame');
  const [crop, setCrop] = useState<Rect | null>(null);
  const [live, setLive] = useState<Rect | null>(null);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [zoom, setZoom] = useState(false);
  const preview = useRef<View>(null);
  const dictation = useDictation((t) => setText((cur) => appendText(cur, t)), setError);
  const rows = useMemo(() => infoRows(collectContext(draft.route, appState()), draft.crash), [draft]);

  const push = useCallback((next: Snap) => {
    setHist((h) => ({ list: [...h.list.slice(0, h.at + 1), next], at: h.at + 1 }));
    setCrop(null);
  }, []);
  const undo = useCallback(() => {
    setHist((h) => ({ ...h, at: Math.max(0, h.at - 1) }));
    setCrop(null);
  }, []);
  const redo = useCallback(() => {
    setHist((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) }));
    setCrop(null);
  }, []);

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

  // Превью — во всю ширину блока, не выше 60% экрана
  const box = useMemo(() => {
    if (!img) return null;
    const maxW = screenW - 32 - 2 * S.border - 16;
    const maxH = screenH * 0.6;
    const k = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * k, h: img.height * k, k };
  }, [img, screenW, screenH]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const boxRef = useRef(box);
  boxRef.current = box;
  const snapRef = useRef({ shot, frame });
  snapRef.current = { shot, frame };
  const draw = useMemo(() => {
    let a = { x: 0, y: 0 };
    const inside = (x: number, y: number) => {
      const b = boxRef.current;
      return b ? { x: Math.min(Math.max(x, 0), b.w), y: Math.min(Math.max(y, 0), b.h) } : { x, y };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        a = inside(e.nativeEvent.locationX, e.nativeEvent.locationY);
        setLive(null);
      },
      onPanResponderMove: (_e, g) => setLive(norm(a, inside(a.x + g.dx, a.y + g.dy))),
      onPanResponderRelease: (_e, g) => {
        const r = norm(a, inside(a.x + g.dx, a.y + g.dy));
        setLive(null);
        if (!big(r)) return;
        if (modeRef.current === 'frame') push({ shot: snapRef.current.shot, frame: r });
        else setCrop(r);
      },
    });
  }, [push]);

  /** Обрезать снимок по выделению: превью → пиксели картинки */
  const applyCrop = useCallback(async () => {
    if (!shot || !box || !big(crop)) return;
    try {
      const out = await cropImage(shot, { x: crop.x / box.k, y: crop.y / box.k, w: crop.w / box.k, h: crop.h / box.k });
      setImg({ width: out.width, height: out.height });
      push({ shot: out.uri, frame: null });
      setMode('frame');
    } catch (e) {
      logError(e);
      setError('Не обрезалось');
    }
  }, [shot, box, crop, push]);

  /** Последний снимок до удаления — для «вернуть снимок» */
  const lastShot = useMemo(() => {
    for (let i = hist.at; i >= 0; i--) {
      const s = hist.list[i]!.shot;
      if (s) return hist.list[i]!;
    }
    return null;
  }, [hist]);

  const recording = dictation.state === 'recording';
  const idle = dictation.state === 'idle';

  const send = useCallback(async () => {
    if (busy || !idle) return;
    if (!text.trim() && !shot) return setError(kind === 'bug' ? 'Опишите, что пошло не так' : 'Опишите идею');
    setBusy(true);
    setError(null);
    let screenshot: string | null = null;
    try {
      if (shot) {
        // Рамка — впекается снимком превью (без выделения обрезки), иначе — сам снимок
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
    useStore.getState().notice('Отправлено');
    close();
  }, [busy, idle, text, shot, frame, img, draft, kind, close]);

  const rectStyle = (r: Rect, color: string, dashed?: boolean) => ({
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    borderColor: color,
    borderStyle: dashed ? ('dashed' as const) : ('solid' as const),
  });
  const shown = crop ?? (mode === 'crop' ? live : null);
  const canCrop = mode === 'crop' && big(crop);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.head}>
          <HeadButton icon="close" a11y="Закрыть" onPress={close} />
          <View style={styles.flex}>
            <Text style={[styles.cap, { color: c.muted }]}>{draft.crash ? 'ОТЧЁТ О ПАДЕНИИ' : 'ОТЗЫВ'}</Text>
            <Text style={[styles.title, { color: c.text }]}>{kind === 'bug' ? 'Ошибка' : 'Идея'}</Text>
          </View>
          {draft.shot ? (
            <>
              <HeadButton icon="undo" size={36} a11y="Отменить" disabled={hist.at === 0} onPress={undo} />
              <HeadButton icon="redo" size={36} a11y="Вернуть" disabled={hist.at === hist.list.length - 1} onPress={redo} />
            </>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" scrollEnabled={!live}>
          {draft.shot ? (
            <Box head="СНИМОК" aside={shot ? (mode === 'frame' ? 'РАМКА' : 'ОБРЕЗКА') : 'УБРАН'}>
              {shot && box ? (
                <>
                  <View style={styles.shotWrap}>
                    <View style={[styles.shot, { borderColor: c.hair }]}>
                      <View ref={preview} collapsable={false} style={{ width: box.w, height: box.h }}>
                        <Image source={{ uri: shot }} style={{ width: box.w, height: box.h }} resizeMode="stretch" />
                        {frame ? <View pointerEvents="none" style={[styles.rect, rectStyle(frame, c.red)]} /> : null}
                      </View>
                      {shown ? (
                        <>
                          <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, width: box.w, height: shown.y }]} />
                          <View pointerEvents="none" style={[styles.dim, { left: 0, top: shown.y + shown.h, width: box.w, height: box.h - shown.y - shown.h }]} />
                          <View pointerEvents="none" style={[styles.dim, { left: 0, top: shown.y, width: shown.x, height: shown.h }]} />
                          <View pointerEvents="none" style={[styles.dim, { left: shown.x + shown.w, top: shown.y, width: box.w - shown.x - shown.w, height: shown.h }]} />
                          <View pointerEvents="none" style={[styles.rect, styles.cropRect, rectStyle(shown, c.text, true)]} />
                          {[
                            [shown.x, shown.y],
                            [shown.x + shown.w, shown.y],
                            [shown.x, shown.y + shown.h],
                            [shown.x + shown.w, shown.y + shown.h],
                          ].map(([x, y], i) => (
                            <View key={i} pointerEvents="none" style={[styles.handle, { left: x! - 5, top: y! - 5, backgroundColor: c.text, borderColor: c.bg }]} />
                          ))}
                        </>
                      ) : null}
                      {live && mode === 'frame' ? <View pointerEvents="none" style={[styles.rect, rectStyle(live, c.red)]} /> : null}
                      <View {...draw.panHandlers} style={StyleSheet.absoluteFill} />
                    </View>
                  </View>
                  <View style={[styles.tools, { borderTopColor: c.hair }]}>
                    <Tool label="РАМКА" on={mode === 'frame'} onPress={() => (setMode('frame'), setCrop(null))} />
                    <Tool label="ОБРЕЗКА" on={mode === 'crop'} onPress={() => setMode('crop')} />
                    {canCrop ? (
                      <Tool label="ОБРЕЗАТЬ" strong style={styles.wide} onPress={() => void applyCrop()} />
                    ) : (
                      <>
                        <Tool icon="expand" a11y="На весь экран" onPress={() => setZoom(true)} />
                        <Tool icon="trash" a11y="Убрать снимок" onPress={() => push({ shot: null, frame: null })} />
                      </>
                    )}
                  </View>
                </>
              ) : !shot && lastShot ? (
                <View style={styles.tools}>
                  <Tool label="ВЕРНУТЬ СНИМОК" onPress={() => push({ shot: lastShot.shot, frame: lastShot.frame })} />
                </View>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator size="small" color={c.muted} />
                </View>
              )}
            </Box>
          ) : null}

          <Box>
            <View style={styles.seg}>
              <Tool label="ОШИБКА" on={kind === 'bug'} onPress={() => setKind('bug')} />
              <Tool label="ИДЕЯ" on={kind === 'idea'} onPress={() => setKind('idea')} />
            </View>
          </Box>

          <Box>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              editable={!busy && idle}
              maxLength={4000}
              placeholder={kind === 'bug' ? 'Что пошло не так' : 'Что предлагаете'}
              placeholderTextColor={c.muted}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              selectionColor={ic.selectionColor}
              cursorColor={ic.cursorColor}
              style={[styles.input, { color: c.text }]}
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
                <Icon name="mic" size={18} color={c.bg} />
              )}
            </Pressable>
          </Box>

          <Box>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: info }} onPress={() => setInfo((v) => !v)} style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: c.text }]}>Сведения</Text>
              <View style={styles.infoAside}>
                <Text numberOfLines={1} style={[styles.infoValue, { color: c.muted }]}>
                  {info ? 'СВЕРНУТЬ' : rows.map((r) => r[0]).join(' · ')}
                </Text>
                <Icon name={info ? 'chevronDown' : 'chevronRight'} size={10} color={c.muted} />
              </View>
            </Pressable>
            {info
              ? rows.map(([k, v]) => (
                  <View key={k} style={[styles.kv, { borderTopColor: c.hair }]}>
                    <Text style={[styles.kvKey, { color: c.muted, borderRightColor: c.hair }]}>{k}</Text>
                    <Text style={[styles.kvValue, { color: c.text }]}>{v}</Text>
                  </View>
                ))
              : null}
          </Box>
          {error ? <Text style={[styles.error, { color: c.red }]}>{error}</Text> : null}
        </ScrollView>
        <ShotViewer
          uri={zoom ? shot : null}
          size={img}
          frame={frame && box ? { x: frame.x / box.k, y: frame.y / box.k, w: frame.w / box.k, h: frame.h / box.k } : null}
          onClose={() => setZoom(false)}
        />
        <View style={[styles.buttons, { borderTopColor: c.hair }]}>
          <Pressable accessibilityRole="button" onPress={close} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
            <Text style={[styles.buttonText, { color: c.text }]}>ОТМЕНА</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !idle}
            onPress={() => void send()}
            style={[styles.button, { borderColor: c.text, backgroundColor: c.text }, (busy || !idle) && styles.dimmed]}
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
  flex: { flex: 1 },
  head: { height: 40, marginTop: 20, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sq: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  cap: { fontFamily: fonts.mono400, fontSize: 9, lineHeight: 11, letterSpacing: 0.72 },
  title: { fontFamily: fonts.sans700, fontSize: 22, lineHeight: 24, letterSpacing: -0.88 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 },
  box: { borderWidth: S.border },
  boxHead: { height: 22, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxHeadText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  shotWrap: { padding: 8, alignItems: 'center' },
  shot: { borderWidth: 1, overflow: 'hidden' },
  rect: { position: 'absolute', borderWidth: 2.5 },
  cropRect: { borderWidth: 2 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)' },
  handle: { position: 'absolute', width: 10, height: 10, borderWidth: 1.5 },
  tools: { flexDirection: 'row', gap: 6, padding: 6, borderTopWidth: S.hairline },
  seg: { flexDirection: 'row', gap: 6, padding: 6 },
  tool: { height: 32, borderWidth: S.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolIcon: { width: 32 },
  wide: { flex: 1.3 },
  toolText: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.76 },
  toolTextOn: { fontFamily: fonts.mono600 },
  loading: { height: 80, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  dimmed: { opacity: 0.4 },
  input: { minHeight: 104, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 52, fontFamily: fonts.sans400, fontSize: 15, lineHeight: 20 },
  mic: { position: 'absolute', right: 8, bottom: 8, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 12, height: 12 },
  infoRow: { height: 34, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  infoLabel: { fontFamily: fonts.sans400, fontSize: 13 },
  infoAside: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoValue: { flexShrink: 1, fontFamily: fonts.mono400, fontSize: 10, letterSpacing: 0.6 },
  kv: { flexDirection: 'row', borderTopWidth: S.hairline },
  kvKey: { width: 84, paddingHorizontal: 8, paddingVertical: 7, borderRightWidth: S.hairline, fontFamily: fonts.mono400, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.38 },
  kvValue: { flex: 1, paddingHorizontal: 8, paddingVertical: 7, fontFamily: fonts.mono400, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.38 },
  error: { fontFamily: fonts.mono400, fontSize: 11, letterSpacing: 0.4 },
  buttons: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: S.hairline },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1.05 },
});
