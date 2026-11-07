/**
 * Таблица полей окна (как в C-Voice): рамка 1.5px, строки ≥ 34px через линию 1px, слева подпись моноширинным
 * в колонке 84px, справа значение или поле ввода.
 */
import { memo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon, Marquee, PersonTag, fonts, size as S, useInputColors, useTheme } from '@/ui';
import type { RecognizedField } from '../../voice/VoiceCreateSheet';

const WEB = Platform.OS === 'web';
/** Многострочное поле: не ниже двух строк, выше — прокрутка внутри */
const AREA_MIN = 44;
const AREA_MAX = 220;

export const FieldBox = memo(function FieldBox({ children, faded }: { children: ReactNode; faded?: boolean }) {
  const { c } = useTheme();
  return <View style={[styles.table, { borderColor: c.border, backgroundColor: c.panel }, faded && styles.faded]}>{children}</View>;
});

type LineProps = {
  label: string;
  /** Первая строка — без линии сверху */
  first?: boolean;
  /** Справа: «×» (убрать запись) или «›» (открыть) */
  onRemove?: () => void;
  removeLabel?: string;
  chevron?: boolean;
  children: ReactNode;
};

export const FieldLine = memo(function FieldLine({ label, first, onRemove, removeLabel, chevron, children }: LineProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, !first && [styles.rowSep, { borderTopColor: c.hair }]]}>
      <View style={[styles.labelCell, { borderRightColor: c.hair }]}>
        <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      </View>
      <View style={styles.valueCell}>{children}</View>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={removeLabel ?? 'Убрать'} hitSlop={8} onPress={onRemove} style={styles.trailing}>
          <Icon name="close" size={12} color={c.muted} />
        </Pressable>
      ) : chevron ? (
        <View style={styles.trailing}>
          <Icon name="chevronRight" size={12} color={c.muted} />
        </View>
      ) : null}
    </View>
  );
});

/** Строка с подписью сверху и полем на всю ширину — для длинного текста (заметка, ссылки) */
export const FieldBlock = memo(function FieldBlock({ label, first, children }: { label: string; first?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.block, !first && [styles.rowSep, { borderTopColor: c.hair }]]}>
      <Text style={[styles.label, styles.blockLabel, { color: c.muted }]}>{label}</Text>
      {children}
    </View>
  );
});

type InputProps = {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  keyboardType?: 'default' | 'url' | 'number-pad';
  maxLength?: number;
  autoFocus?: boolean;
  /** Ссылки, годы — моноширинным */
  mono?: boolean;
  /** Несколько строк, растёт с текстом (FieldBlock) */
  multiline?: boolean;
  placeholder?: string;
};

/** Поле ввода в строке таблицы: без своей рамки, во всю ячейку */
export const FieldInput = memo(function FieldInput({
  value,
  onChangeText,
  accessibilityLabel,
  keyboardType = 'default',
  maxLength,
  autoFocus,
  mono,
  multiline,
  placeholder,
}: InputProps) {
  const { c } = useTheme();
  const ic = useInputColors();
  const plain = keyboardType !== 'default';
  // В браузере многострочное поле само не растёт — высота по тексту (на телефоне растёт само)
  const [height, setHeight] = useState<number | null>(null);
  return (
    <TextInput
      onContentSizeChange={multiline && WEB ? (e) => setHeight(Math.min(AREA_MAX, Math.ceil(e.nativeEvent.contentSize.height))) : undefined}
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={accessibilityLabel}
      keyboardType={keyboardType}
      maxLength={maxLength}
      autoFocus={autoFocus}
      autoCapitalize={plain ? 'none' : 'sentences'}
      autoCorrect={!plain}
      selectionColor={ic.selectionColor}
      cursorColor={ic.cursorColor}
      multiline={multiline}
      placeholder={placeholder}
      placeholderTextColor={c.faint}
      textAlignVertical={multiline ? 'top' : undefined}
      style={[
        styles.input,
        mono ? styles.inputMono : styles.inputSans,
        multiline && [styles.inputArea, mono ? styles.areaMono : styles.areaSans],
        multiline && height !== null && { height: Math.max(AREA_MIN, height) },
        { color: c.text },
      ]}
    />
  );
});

/** Значение только для чтения: моноширинной строкой (бежит, если длинное) или обычным текстом в несколько строк (plain) */
export const FieldText = memo(function FieldText({ text, plain }: { text: string; plain?: boolean }) {
  const { c } = useTheme();
  if (plain) return <Text style={[valueStyles.plain, styles.flex, { color: c.text }]}>{text}</Text>;
  return <Marquee style={[valueStyles.text, styles.flex, { color: c.text }]}>{text}</Marquee>;
});

const valueStyles = StyleSheet.create({
  plain: { fontFamily: fonts.sans400, fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  tag: { fontFamily: fonts.mono600, fontSize: 11 },
  title: { fontFamily: fonts.sans600, fontSize: 13 },
  text: { fontFamily: fonts.mono500, fontSize: 11 },
});

/** Значение распознанного поля (C-Voice): ярлык, название, текст или люди */
const RecognizedValue = memo(function RecognizedValue({ field }: { field: RecognizedField }) {
  const { c, person } = useTheme();
  if (field.kind === 'people') {
    return (
      <>
        {field.people.map((p) => (
          <PersonTag key={p.id} name={p.name} color={person(p.color)} />
        ))}
      </>
    );
  }
  return <Marquee style={[valueStyles[field.kind], styles.flex, { color: c.text }]}>{field.value}</Marquee>;
});

type RecognizedProps = {
  fields: readonly RecognizedField[];
  faded?: boolean;
  onRemove?: () => void;
  /** Нажатие на таблицу — полный редактор записи */
  onPress?: () => void;
};

/** Запись только для просмотра — те же строки, что в C-Voice; «×» и «›» — в первой строке */
export const RecognizedRows = memo(function RecognizedRows({ fields, faded, onRemove, onPress }: RecognizedProps) {
  const title = fields.find((f) => f.key === 'title');
  const rows = fields.map((f, i) => (
    <FieldLine
      key={f.key}
      label={f.label}
      first={i === 0}
      onRemove={i === 0 ? onRemove : undefined}
      removeLabel={title && title.kind !== 'people' ? `Убрать: ${title.value}` : undefined}
      chevron={i === 0 && !onRemove && !!onPress}
    >
      <RecognizedValue field={f} />
    </FieldLine>
  ));
  return (
    <FieldBox faded={faded}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={title && title.kind !== 'people' ? title.value : 'Изменить'} onPress={onPress}>
          {rows}
        </Pressable>
      ) : (
        rows
      )}
    </FieldBox>
  );
});

const styles = StyleSheet.create({
  table: { borderWidth: S.border },
  faded: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 34 },
  /** 34 + разделитель 1 */
  rowSep: { minHeight: 35, borderTopWidth: S.hairline },
  labelCell: { width: 84, flexShrink: 0, justifyContent: 'center', paddingLeft: 8, borderRightWidth: S.hairline },
  label: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  valueCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  trailing: { width: 28, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  input: { flex: 1, minWidth: 0, minHeight: 34, paddingVertical: 6, paddingHorizontal: 0 },
  inputSans: { fontFamily: fonts.sans400, fontSize: 13 },
  inputMono: { fontFamily: fonts.mono500, fontSize: 11 },
  block: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  blockLabel: { marginBottom: 2 },
  /** Длинные ссылки переносятся по любому символу, а не уезжают за край */
  inputArea: { flex: 0, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: AREA_MIN, maxHeight: AREA_MAX, paddingVertical: 4, wordBreak: 'break-all' } as never,
  areaSans: { fontSize: 15, lineHeight: 20, wordBreak: 'normal' } as never,
  areaMono: { fontSize: 12, lineHeight: 17 },
});
