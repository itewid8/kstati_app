/**
 * Таблица полей дела: рамка 1.5px, строки ≥ 44px, колонка подписи 88px.
 * Раскрытая строка — подпись инвертирована и со стрелкой вверх, под ней ExpandedPanel.
 * Тап по строке закрывает клавиатуру; FieldInputRow — строка, которая правится прямо в ней (описание).
 */
import { memo, useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, PersonTag, size as S, type as T, useTheme } from '@/ui';
import { useKeyboardTarget } from './keyboard';
import { ET } from './text';
import { useWebAutoHeight } from './webAutoHeight';

export const FieldTable = memo(function FieldTable({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.table, { borderColor: c.border }, style]}>{children}</View>;
});

/** Справа в строке: «›» — открыть, «×» — очистить, пусто */
export type FieldTrailing = 'chevron' | 'clear' | 'none';

type FieldRowProps = {
  label: string;
  /** Первая строка таблицы — без разделителя сверху */
  first?: boolean;
  expanded?: boolean;
  trailing?: FieldTrailing;
  onPress?: () => void;
  onClear?: () => void;
  children: ReactNode;
};

/**
 * Строка — View, внутри нажимаемая часть (подпись, значение) и правый край. Кнопка «×» стоит рядом с нажимаемой частью,
 * а не внутри неё: кнопка в кнопке ломает доступность (и даёт <button> в <button> в react-native-web)
 */
export const FieldRow = memo(function FieldRow({ label, first, expanded, trailing = 'chevron', onPress, onClear, children }: FieldRowProps) {
  const { c } = useTheme();
  const clear = !expanded && trailing === 'clear';
  // Открыли другую строку — печатать закончили
  const press = useCallback(() => {
    Keyboard.dismiss();
    onPress?.();
  }, [onPress]);
  const clearPress = useCallback(() => {
    Keyboard.dismiss();
    onClear?.();
  }, [onClear]);
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: c.panel },
        first ? styles.first : [styles.divided, { borderTopColor: c.hair }],
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: !!expanded }}
        onPress={press}
        disabled={!onPress}
        style={styles.main}
      >
        <View style={[styles.label, expanded && { backgroundColor: c.text }]}>
          <Text style={[T.fieldLabel, { color: expanded ? c.bg : c.muted }]}>{label}</Text>
          {expanded ? <Icon name="chevronUp" size={12} color={c.bg} strokeWidth={2.5} /> : null}
        </View>
        <View style={styles.value}>{children}</View>
        {clear ? null : (
          <View style={styles.trailing}>
            {!expanded && trailing === 'chevron' ? <Icon name="chevronRight" size={12} color={c.muted} /> : null}
          </View>
        )}
      </Pressable>
      {clear ? (
        <View style={styles.trailing}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Очистить: ${label}`} onPress={clearPress} hitSlop={8}>
            <Text style={[ET.clear, { color: c.muted }]}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

type FieldInputRowProps = {
  label: string;
  /** Текст как есть; null — пусто */
  value: string | null;
  /** Что видно в пустой строке без фокуса: «+ ОПИСАНИЕ» — как у остальных пустых строк */
  empty: string;
  maxLength: number;
  inputRef?: RefObject<TextInput | null>;
  onChangeText: (text: string) => void;
};

/**
 * Строка, которая правится на месте (описание): тап по любой её части ставит курсор в поле, текст 13/17 — как у
 * FieldDescription. Справа «›», как у остальных строк в макете. Поле в фокусе сообщает окну (useKeyboardTarget),
 * и окно прокручивается так, чтобы строка была над клавиатурой
 */
export const FieldInputRow = memo(function FieldInputRow({ label, value, empty, maxLength, inputRef, onChangeText }: FieldInputRowProps) {
  const { c } = useTheme();
  const setTarget = useKeyboardTarget();
  const row = useRef<View>(null);
  const own = useRef<TextInput>(null);
  const input = inputRef ?? own;
  const [focused, setFocused] = useState(false);
  const auto = useWebAutoHeight(ET.description.lineHeight);
  const focus = useCallback(() => input.current?.focus(), [input]);
  const onFocus = useCallback(() => {
    setFocused(true);
    setTarget(row.current);
  }, [setTarget]);
  const onBlur = useCallback(() => {
    setFocused(false);
    setTarget(null);
  }, [setTarget]);

  return (
    <Pressable ref={row} accessible={false} onPress={focus} style={[styles.row, styles.divided, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
      <View style={styles.label}>
        <Text style={[T.fieldLabel, { color: c.muted }]}>{label}</Text>
      </View>
      <View style={styles.value}>
        <TextInput
          ref={input}
          value={value ?? ''}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          multiline
          {...auto.webProps}
          onContentSizeChange={auto.onContentSizeChange}
          maxLength={maxLength}
          textAlignVertical="top"
          underlineColorAndroid="transparent"
          selectionColor={c.text}
          cursorColor={c.text}
          accessibilityLabel={label}
          style={[ET.description, styles.input, auto.style, { color: c.text }]}
        />
        {value === null && !focused ? (
          <View pointerEvents="none" style={styles.empty}>
            <FieldValue text={empty} muted />
          </View>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <Icon name="chevronRight" size={12} color={c.muted} />
      </View>
    </Pressable>
  );
});

/** Значение поля моноширинным; muted — пустое значение («+ КОНЕЦ», «НЕ ПОВТОРЯЕТСЯ») */
export const FieldValue = memo(function FieldValue({ text, muted }: { text: string; muted?: boolean }) {
  const { c } = useTheme();
  return <Text style={[T.fieldValue, styles.shrink, { color: muted ? c.muted : c.text }]}>{text}</Text>;
});

/** Описание — обычный текст 13/17 */
export const FieldDescription = memo(function FieldDescription({ text }: { text: string }) {
  const { c } = useTheme();
  return <Text style={[ET.description, styles.shrink, { color: c.text }]}>{text}</Text>;
});

export type EditorPerson = {
  id: string;
  /** «САНЯ», «КАРИНА» */
  name: string;
  /** Цвет под тему (useTheme().person) */
  color: string;
};

/** Выбранные люди в строке «КТО»: квадрат цвета + имя, только отображение */
export const FieldPeople = memo(function FieldPeople({ people }: { people: readonly EditorPerson[] }) {
  return (
    <View style={styles.people}>
      {people.map((p) => (
        <PersonTag key={p.id} color={p.color} name={p.name} size="md" />
      ))}
    </View>
  );
});

/** Раскрытая часть строки: фон экрана, поля 10/8, зазор 8 */
export const ExpandedPanel = memo(function ExpandedPanel({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.panel, { backgroundColor: c.bg, borderTopColor: c.hair }]}>{children}</View>;
});

/** Подпись группы внутри панели «КАЖДЫЕ», «ПО ДНЯМ» */
export const PanelLabel = memo(function PanelLabel({ text }: { text: string }) {
  const { c } = useTheme();
  return <Text style={[ET.panelLabel, { color: c.muted }]}>{text}</Text>;
});

const styles = StyleSheet.create({
  table: { borderWidth: S.border },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
  first: { minHeight: S.row },
  /** В макете min-height 44 + разделитель 1px сверху (content-box) */
  divided: { minHeight: S.row + S.hairline, borderTopWidth: S.hairline },
  label: {
    width: 88,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  value: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  trailing: { width: 28, alignItems: 'center', justifyContent: 'center' },
  shrink: { flexShrink: 1 },
  /** Без своих отступов (Android — фон EditText, iOS — поля UITextView), до 8 строк — дальше прокрутка внутри */
  input: { flex: 1, minWidth: 0, padding: 0, margin: 0, maxHeight: 17 * 8 },
  /** «+ ОПИСАНИЕ» на месте значения (как FieldValue в обычной строке) */
  empty: { position: 'absolute', left: 10, right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  people: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 12 },
  panel: { borderTopWidth: S.hairline, paddingVertical: 10, paddingHorizontal: 8, gap: 8 },
});
