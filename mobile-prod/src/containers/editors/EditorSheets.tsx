/**
 * Нижние окна поверх окна дела, для которых нет места в строках макета: конец дела, дата окончания повтора,
 * свои напоминания («за … до начала», «за … дней в …»). Собраны из src/ui и компонентов окон редактирования.
 * Кладутся последними детьми экрана (BottomSheet — absolute); «назад» Android закрывает окно.
 */
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { cursorOf, type Cursor, type EditorDraft } from '@/adapters/editors/draft';
import { remindLabel } from '@/adapters/editors/labels';
import { endPanel, timeText } from '@/adapters/editors/panels';
import type { IsoDate } from '@/lib/calendarLayout';
import { specD, specM } from '@/lib/remind';
import type { PersonColor, ReminderSpec } from '@/lib/types';
import { Stepper } from '@/screens/editors/components/Buttons';
import { MonthCalendar } from '@/screens/editors/components/MonthCalendar';
import { TimeWheel, type TimeValue } from '@/screens/editors/components/TimeWheel';
import type { CustomReminder } from '@/screens/editors/panels/RemindPanel';
import { DatePicker, type DateView } from '@/screens/editors/panels/DatePanel';
import { BottomSheet, Marquee, size as S, type as T, useTheme } from '@/ui';
import type { EditorDispatch } from './useEditorState';

/** Пока окно открыто, «назад» Android закрывает его, а не экран */
function useBackClose(visible: boolean, onClose: () => void) {
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);
}

type Action = { label: string; onPress: () => void; disabled?: boolean };

const SheetActions = memo(function SheetActions({ cancel, primary }: { cancel?: Action; primary: Action }) {
  const { c } = useTheme();
  return (
    <View style={styles.actions}>
      {cancel ? (
        <Pressable
          accessibilityRole="button"
          onPress={cancel.onPress}
          style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}
        >
          <Text style={[T.action, { color: c.text }]}>{cancel.label}</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!primary.disabled }}
        disabled={primary.disabled}
        onPress={primary.onPress}
        style={[styles.button, styles.primary, { borderColor: c.border, backgroundColor: c.text, opacity: primary.disabled ? 0.4 : 1 }]}
      >
        <Text style={[T.action, { color: c.bg }]}>{primary.label}</Text>
      </Pressable>
    </View>
  );
});

type FrameProps = { visible: boolean; bottomInset: number; onClose: () => void; children: ReactNode };

const Frame = memo(function Frame({ visible, bottomInset, onClose, children }: FrameProps) {
  useBackClose(visible, onClose);
  return (
    <BottomSheet visible={visible} onClose={onClose} bottomInset={bottomInset}>
      {children}
    </BottomSheet>
  );
});

/** Подпись того, что получится: «ЗА 1 Ч 30 МИН», «ВС 11 ОКТ · 20:00» */
const Value = memo(function Value({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.value, { borderColor: c.border, backgroundColor: c.panel }]}>
      <Marquee style={[T.fieldValue, { color: c.text }]}>{text}</Marquee>
    </View>
  );
});

/* ---------- Конец дела ---------- */

type EndSheetProps = {
  visible: boolean;
  draft: EditorDraft;
  /** «ВС 11 ОКТ · 20:00» — строка «КОНЕЦ» */
  label: string;
  color: PersonColor;
  today: IsoDate;
  bottomInset: number;
  dispatch: EditorDispatch;
  onClose: () => void;
};

/** День и время конца; правки сразу в черновике (отмена — «назад» из окна дела) */
export const EndSheet = memo(function EndSheet({ visible, draft, label, color, today, bottomInset, dispatch, onClose }: EndSheetProps) {
  const [view, setView] = useState<DateView>('month');
  const [cursor, setCursor] = useState<Cursor>(() => cursorOf(draft.endDate ?? draft.date ?? today));
  const endDay = draft.endDate ?? draft.date ?? today;
  // Открыли или сменился день конца — календарь на месяце конца
  useEffect(() => {
    if (!visible) return;
    setView('month');
    setCursor(cursorOf(endDay));
  }, [visible, endDay]);

  const data = useMemo(() => endPanel(draft, { dateView: view, cursor }, { today }, color), [draft, view, cursor, today, color]);
  const onSelectDay = useCallback((date: IsoDate) => dispatch({ type: 'endDay', date }), [dispatch]);
  const onShift = useCallback(
    (dir: -1 | 1) =>
      setCursor((c) => {
        if (view === 'year') return { year: c.year + dir, month: c.month };
        const m = c.year * 12 + c.month + dir;
        return { year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
      }),
    [view],
  );
  const onToggleView = useCallback(() => setView((v) => (v === 'month' ? 'year' : 'month')), []);
  const onSelectMonth = useCallback((month: number) => {
    setCursor((c) => ({ year: c.year, month }));
    setView('month');
  }, []);
  const onChangeTime = useCallback((t: TimeValue) => dispatch({ type: 'endTime', time: timeText(t) }), [dispatch]);
  const onToggleNoTime = useCallback(() => dispatch({ type: 'endNoTime' }), [dispatch]);

  return (
    <Frame visible={visible} bottomInset={bottomInset} onClose={onClose}>
      <Value text={label} />
      <DatePicker
        {...data}
        onSelectDay={onSelectDay}
        onShift={onShift}
        onToggleView={onToggleView}
        onSelectMonth={onSelectMonth}
        onChangeTime={onChangeTime}
        onToggleNoTime={onToggleNoTime}
      />
      <SheetActions primary={{ label: 'ГОТОВО', onPress: onClose }} />
    </Frame>
  );
});

/* ---------- Окончание повтора ---------- */

type UntilSheetProps = {
  visible: boolean;
  until: IsoDate | null;
  /** Раньше начала дела окончание не ставится */
  from: IsoDate;
  today: IsoDate;
  bottomInset: number;
  onPick: (iso: IsoDate) => void;
  onClose: () => void;
};

export const UntilSheet = memo(function UntilSheet({ visible, until, from, today, bottomInset, onPick, onClose }: UntilSheetProps) {
  const [cursor, setCursor] = useState<Cursor>(() => cursorOf(until ?? from));
  useEffect(() => {
    if (visible) setCursor(cursorOf(until ?? from));
  }, [visible, until, from]);
  const shift = useCallback(
    (dir: -1 | 1) =>
      setCursor((c) => {
        const m = c.year * 12 + c.month + dir;
        return { year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
      }),
    [],
  );
  const prev = useCallback(() => shift(-1), [shift]);
  const next = useCallback(() => shift(1), [shift]);
  const pick = useCallback(
    (iso: IsoDate) => {
      onPick(iso < from ? from : iso);
      onClose();
    },
    [from, onPick, onClose],
  );
  return (
    <Frame visible={visible} bottomInset={bottomInset} onClose={onClose}>
      <MonthCalendar
        year={cursor.year}
        month={cursor.month}
        today={today}
        selected={until}
        onSelectDay={pick}
        onPrevMonth={prev}
        onNextMonth={next}
      />
    </Frame>
  );
});

/* ---------- Свои напоминания ---------- */

type CustomRemindSheetProps = {
  kind: CustomReminder | null;
  bottomInset: number;
  onAdd: (spec: ReminderSpec) => void;
  onClose: () => void;
};

const BEFORE: TimeValue = { hour: 1, minute: 30 };
const DAYS = 5;
const AT: TimeValue = { hour: 20, minute: 0 };
const MAX_DAYS = 60;

/** «За 1 ч 30 мин до начала» — часы и минуты колесом; «за 5 дней в 20:00» — дни и время */
export const CustomRemindSheet = memo(function CustomRemindSheet({ kind, bottomInset, onAdd, onClose }: CustomRemindSheetProps) {
  const [before, setBefore] = useState(BEFORE);
  const [days, setDays] = useState(DAYS);
  const [at, setAt] = useState(AT);
  useEffect(() => {
    if (!kind) return;
    setBefore(BEFORE);
    setDays(DAYS);
    setAt(AT);
  }, [kind]);

  const minutes = before.hour * 60 + before.minute;
  const spec = kind === 'before' ? specM(minutes) : specD(days, timeText(at));
  const disabled = kind === 'before' && minutes === 0;
  const add = useCallback(() => {
    onAdd(spec);
    onClose();
  }, [spec, onAdd, onClose]);

  return (
    <Frame visible={!!kind} bottomInset={bottomInset} onClose={onClose}>
      <Value text={remindLabel(spec)} />
      {kind === 'days' ? (
        <View style={styles.days}>
          <Stepper
            value={days}
            onDecrement={days > 0 ? () => setDays(days - 1) : undefined}
            onIncrement={days < MAX_DAYS ? () => setDays(days + 1) : undefined}
          />
          <View style={styles.flex}>
            <TimeWheel hour={at.hour} minute={at.minute} onChange={setAt} />
          </View>
        </View>
      ) : (
        <TimeWheel hour={before.hour} minute={before.minute} onChange={setBefore} />
      )}
      <SheetActions cancel={{ label: 'ОТМЕНА', onPress: onClose }} primary={{ label: 'ДОБАВИТЬ', onPress: add, disabled }} />
    </Frame>
  );
});

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, height: S.row },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1.3 },
  value: { height: 36, borderWidth: S.border, paddingHorizontal: 10, justifyContent: 'center' },
  days: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
});
