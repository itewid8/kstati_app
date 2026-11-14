/**
 * «Обучение» (из Настроек, тест): карточка с фразой или заданием своими словами, диктовка, текст по мере распознавания
 * и итог, который сервер считает сам: услышано ли слово в слово и совпал ли разбор с ожидаемым. От человека нужно
 * только говорить; отметки «сказал иначе» и «ошибка в карточке» — по желанию. Презентационный экран: данные — пропсами.
 */
import { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PracticeCard, PracticeProgress, PracticeVerdict } from '@/lib/api';
import { Icon, SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';

export type PracticePhase = 'idle' | 'listening' | 'sending' | 'done';

export type PracticeView =
  | { kind: 'loading' }
  | { kind: 'problem'; text: string }
  /** Первое открытие: что сохраняется */
  | { kind: 'consent' }
  /** На телефоне нет встроенного распознавания */
  | { kind: 'unavailable' }
  | {
      kind: 'card';
      card: PracticeCard;
      phase: PracticePhase;
      /** Текст по мере распознавания */
      live: string;
      verdict: PracticeVerdict | null;
      /** Отметки по желанию: сказал иначе, чем на карточке; оставлено замечание (кривая фраза, не то ожидается, должно быть иначе) */
      said: boolean;
      bad: boolean;
      /** «Не расслышал», «Нет связи» */
      note: string | null;
    };

export type PracticeScreenProps = {
  view: PracticeView;
  progress: PracticeProgress | null;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onAgree?: () => void;
  onRetry?: () => void;
  /** Начать или закончить запись */
  onMic?: () => void;
  onNext?: () => void;
  /** Та же карточка ещё раз */
  onRepeat?: () => void;
  onToggleSaid?: () => void;
  onToggleBad?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
const pad2 = (n: number) => String(n).padStart(2, '0');

export const PracticeScreen = memo(function PracticeScreen({ view, progress, insets = NO_INSETS, onBack, onAgree, onRetry, onMic, onNext, onRepeat, onToggleSaid, onToggleBad }: PracticeScreenProps) {
  const { c } = useTheme();
  const box = [styles.box, { borderColor: c.border, backgroundColor: c.panel }];
  const button = (label: string, onPress: (() => void) | undefined, opts: { solid?: boolean; red?: boolean; on?: boolean; icon?: 'mic' } = {}) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!opts.on }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: opts.red ? c.red : c.border, backgroundColor: opts.red ? c.red : opts.solid || opts.on ? c.text : c.panel, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {opts.icon ? <Icon name={opts.icon} size={16} color={opts.red || opts.solid ? c.bg : c.text} /> : null}
      <Text style={[styles.buttonText, { color: opts.red || opts.solid || opts.on ? c.bg : c.text }]}>{label}</Text>
    </Pressable>
  );
  const v = view.kind === 'card' ? view : null;
  const verdict = v?.verdict ?? null;
  const heard = verdict?.heard ?? v?.live ?? '';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AccountHeader caption="НАСТРОЙКИ" title="Обучение" onBack={onBack} />
      <View style={styles.body}>
        {progress ? <Text style={[styles.meta, { color: c.muted }]}>{`СЕГОДНЯ ${pad2(progress.today)} · ВСЕГО ${pad2(progress.total)}`}</Text> : null}

        {view.kind === 'loading' ? <ActivityIndicator color={c.muted} style={styles.wait} /> : null}

        {view.kind === 'problem' ? (
          <View style={box}>
            <Text style={[styles.text, { color: c.text }]}>{view.text}</Text>
            {button('ПОВТОРИТЬ', onRetry)}
          </View>
        ) : null}

        {view.kind === 'unavailable' ? (
          <View style={box}>
            <Text style={[styles.text, { color: c.text }]}>На этом устройстве нет встроенного распознавания речи</Text>
          </View>
        ) : null}

        {view.kind === 'consent' ? (
          <View style={box}>
            <Text style={[styles.text, { color: c.text }]}>
              Попытки сохраняются для обучения распознавания: фраза карточки, распознанный текст и запись голоса. Ваши дела, списки и заметки не используются.
            </Text>
            {button('НАЧАТЬ', onAgree, { solid: true })}
          </View>
        ) : null}

        {v ? (
          <>
            <View style={box}>
              <Text style={[styles.meta, { color: c.muted }]}>{v.card.mode === 'say' ? 'СКАЖИТЕ ФРАЗУ' : 'СКАЖИТЕ СВОИМИ СЛОВАМИ'}</Text>
              {v.card.text ? <Text style={[styles.phrase, { color: c.text }]}>{v.card.text}</Text> : null}
              {v.card.brief?.map((line) => (
                <Text key={line} style={[styles.brief, { color: c.text }]}>
                  {line}
                </Text>
              ))}
              {v.card.mode === 'do' ? <Text style={[styles.meta, { color: c.muted }]}>{`СЕГОДНЯ В ЗАДАНИИ: ${v.card.today.toUpperCase()}`}</Text> : null}
            </View>

            {heard || v.phase === 'listening' ? (
              <View style={box}>
                <Text style={[styles.meta, { color: v.phase === 'listening' ? c.red : c.muted }]}>{v.phase === 'listening' ? 'СЛУШАЮ' : 'УСЛЫШАНО'}</Text>
                <Text style={[styles.text, { color: verdict ? c.text : c.muted }]}>{heard || '…'}</Text>
              </View>
            ) : null}

            {v.note ? <Text style={[styles.meta, { color: c.red }]}>{v.note.toUpperCase()}</Text> : null}

            {verdict ? (
              <SectionBox title="ИТОГ">
                {verdict.sttOk !== null ? (
                  <View style={[styles.row, { backgroundColor: c.panel }]}>
                    <Text style={[styles.rowLabel, { color: c.text }]}>Распознавание</Text>
                    <Text style={[styles.value, { color: verdict.sttOk ? c.text : c.red }]}>{verdict.sttOk ? 'ВЕРНО' : 'С ОШИБКОЙ'}</Text>
                  </View>
                ) : null}
                <View style={[styles.row, { backgroundColor: c.panel }, verdict.sttOk !== null && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
                  <Text style={[styles.rowLabel, { color: c.text }]}>Разбор</Text>
                  <Text style={[styles.value, { color: verdict.parseOk ? c.text : c.red }]}>{verdict.parseOk ? 'ВЕРНО' : 'ОШИБКА'}</Text>
                </View>
                <View style={[styles.detail, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
                  <Text style={[styles.meta, { color: c.muted }]}>ПОЛУЧИЛОСЬ</Text>
                  <Text style={[styles.small, { color: c.text }]}>{verdict.did}</Text>
                  {!verdict.parseOk ? (
                    <>
                      <Text style={[styles.meta, styles.gap, { color: c.muted }]}>ОЖИДАЛОСЬ</Text>
                      <Text style={[styles.small, { color: c.text }]}>{verdict.want}</Text>
                    </>
                  ) : null}
                </View>
              </SectionBox>
            ) : null}

            {v.phase === 'sending' ? <ActivityIndicator color={c.muted} style={styles.wait} /> : null}
            {v.phase === 'idle' ? (
              <View style={styles.buttons}>
                {button('ЗАПИСЬ', onMic, { solid: true, icon: 'mic' })}
                {button('ПРОПУСТИТЬ', onNext)}
              </View>
            ) : null}
            {v.phase === 'listening' ? <View style={styles.buttons}>{button('СТОП', onMic, { red: true, icon: 'mic' })}</View> : null}
            {v.phase === 'done' ? (
              <>
                <View style={styles.buttons}>
                  {button('ДАЛЬШЕ', onNext, { solid: true })}
                  {button('ЕЩЁ РАЗ', onRepeat)}
                </View>
                <View style={styles.buttons}>
                  {button('СКАЗАЛ ИНАЧЕ', onToggleSaid, { on: v.said })}
                  {button('ЗАМЕЧАНИЕ', onToggleBad, { on: v.bad })}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  body: { marginTop: 12, gap: 8 },
  wait: { marginVertical: 20 },
  box: { borderWidth: S.border, padding: 12, gap: 8 },
  meta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.4 },
  phrase: { fontFamily: fonts.sans500, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  brief: { fontFamily: fonts.sans500, fontSize: 17, lineHeight: 23 },
  text: { fontFamily: fonts.sans500, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.sans500, fontSize: 13, lineHeight: 18 },
  row: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontFamily: fonts.sans500, fontSize: 14 },
  value: { fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.6 },
  detail: { padding: 10, gap: 4, borderTopWidth: S.hairline },
  gap: { marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 6 },
  button: { flex: 1, minHeight: 44, paddingHorizontal: 8, borderWidth: S.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonText: { fontFamily: fonts.mono500, fontSize: 10, letterSpacing: 0.8 },
});
