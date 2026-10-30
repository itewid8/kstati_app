/**
 * Отзыв: ошибка или предложение — тип, текст (печатать или надиктовать), снизу ОТМЕНА / ОТПРАВИТЬ.
 * Презентационный экран: черновик, отправка и ошибка — у вызывающего.
 */
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { FeedbackKind } from '@/lib/api';
import { Icon, SectionBox, fonts, useInputColors, useTheme } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { ErrorLine } from './components/ErrorLine';
import { OptionGrid, type Option } from './components/OptionGrid';

/** Диктовка: idle — можно начать, recording — идёт запись, working — распознаём */
export type DictateState = 'idle' | 'recording' | 'working';

export type FeedbackScreenProps = {
  kind: FeedbackKind;
  text: string;
  error?: string | null;
  busy?: boolean;
  dictate?: DictateState;
  /** Начать / остановить диктовку; нет — кнопки нет */
  onDictate?: () => void;
  insets?: PageInsets;
  onBack?: () => void;
  onChangeKind?: (kind: FeedbackKind) => void;
  onChangeText?: (text: string) => void;
  onCancel?: () => void;
  onSend?: () => void;
};

export const FEEDBACK_MAX = 4000;

const KINDS: Option<FeedbackKind>[] = [
  { key: 'bug', label: 'ОШИБКА' },
  { key: 'idea', label: 'ПРЕДЛОЖЕНИЕ' },
];

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

export const FeedbackScreen = memo(function FeedbackScreen(props: FeedbackScreenProps) {
  const { kind, text, error, busy = false, dictate = 'idle', insets = NO_INSETS, onBack, onChangeKind, onChangeText, onCancel, onSend } = props;
  const { c } = useTheme();
  const ic = useInputColors();
  const recording = dictate === 'recording';
  return (
    <AccountPage
      caption="НАСТРОЙКИ"
      title="Отзыв"
      insets={insets}
      onBack={onBack}
      save={{ canSave: !!text.trim(), busy, label: 'ОТПРАВИТЬ', onCancel, onSave: onSend }}
    >
      <SectionBox title="ЧТО">
        <OptionGrid options={KINDS} value={kind} onChange={busy ? undefined : onChangeKind} />
      </SectionBox>
      <SectionBox title={kind === 'bug' ? 'ЧТО СЛУЧИЛОСЬ' : 'ЧТО ПРЕДЛАГАЕТЕ'}>
        <View>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          multiline
          autoFocus
          editable={!busy && dictate === 'idle'}
          maxLength={FEEDBACK_MAX}
          textAlignVertical="top"
          underlineColorAndroid="transparent"
          selectionColor={ic.selectionColor}
          cursorColor={ic.cursorColor}
          accessibilityLabel="Текст отзыва"
          style={[styles.input, { color: c.text, backgroundColor: c.panel }]}
        />
        {props.onDictate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Остановить и распознать' : 'Надиктовать'}
            disabled={busy || dictate === 'working'}
            onPress={props.onDictate}
            hitSlop={6}
            style={[styles.mic, { backgroundColor: recording ? c.red : c.text }]}
          >
            {dictate === 'working' ? (
              <ActivityIndicator size="small" color={c.bg} />
            ) : recording ? (
              <View style={[styles.stop, { backgroundColor: c.bg }]} />
            ) : (
              <Icon name="mic" size={20} color={c.bg} />
            )}
          </Pressable>
        ) : null}
        </View>
      </SectionBox>
      <ErrorLine text={error} />
    </AccountPage>
  );
});

const styles = StyleSheet.create({
  /** Круглая кнопка диктовки в правом нижнем углу поля */
  mic: { position: 'absolute', right: 10, bottom: 10, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 14, height: 14 },
  input: { minHeight: 180, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 60, fontFamily: fonts.sans400, fontSize: 15, lineHeight: 20 },
});
