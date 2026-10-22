/**
 * Таблица полей дела: рамка 1.5px, строки ≥ 44px, колонка подписи 88px.
 * Раскрытая строка — подпись инвертирована и со стрелкой вверх, под ней ExpandedPanel.
 */
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, PersonTag, size as S, type as T, useTheme } from '@/ui';
import { ET } from './text';

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
        onPress={onPress}
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Очистить: ${label}`} onPress={onClear} hitSlop={8}>
            <Text style={[ET.clear, { color: c.muted }]}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
  people: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 12 },
  panel: { borderTopWidth: S.hairline, paddingVertical: 10, paddingHorizontal: 8, gap: 8 },
});
