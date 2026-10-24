/**
 * Карточка записи вверху окна (как в C-Ask*, C-Quick*): полоса цвета людей, название и ярлык в строку, подпись.
 * input — вместо названия поле ввода (правка в окне); onRemove — «×» справа (убрать запись из ответа);
 * onPress — карточка открывает полный редактор («›» справа).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { Icon, Marquee, fonts, size as S, useTheme } from '@/ui';
import { PersonStrip } from '../../voice/components/PersonStrip';

export type CardInput = {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
};

export type SheetCardProps = {
  title: string;
  /** Справа от названия: «ХОЧУ», «КАЖДУЮ НЕДЕЛЮ», «OZON.RU» */
  tag?: string;
  /** «ДОБАВИЛА КАРИНА · 28 СЕН» */
  meta?: string;
  /** Сверху вниз; пусто — без полосы */
  colors?: readonly PersonColor[];
  /** Название зачёркнуто (запись удаляется) */
  struck?: boolean;
  input?: CardInput;
  onPress?: () => void;
  onRemove?: () => void;
};

const NONE: readonly PersonColor[] = [];

export const SheetCard = memo(function SheetCard({ title, tag, meta, colors = NONE, struck, input, onPress, onRemove }: SheetCardProps) {
  const { c } = useTheme();
  const body = (
    <>
      <PersonStrip colors={colors} />
      <View style={styles.top}>
        {input ? (
          <TextInput
            value={input.value}
            onChangeText={input.onChangeText}
            accessibilityLabel={input.accessibilityLabel}
            multiline={input.multiline}
            autoFocus={input.autoFocus}
            maxLength={input.maxLength}
            textAlignVertical="top"
            selectionColor={c.text}
            cursorColor={c.text}
            style={[styles.title, styles.input, input.multiline && styles.multiline, { color: c.text }]}
          />
        ) : (
          <Marquee style={[styles.title, { color: c.text }, struck && styles.struck]}>{title}</Marquee>
        )}
        {tag ? <Marquee style={[styles.tag, { color: c.muted }]}>{tag}</Marquee> : null}
        {onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Убрать: ${title}`} hitSlop={10} onPress={onRemove} style={styles.icon}>
            <Icon name="close" size={12} color={c.muted} />
          </Pressable>
        ) : null}
        {onPress ? (
          <View style={styles.icon}>
            <Icon name="chevronRight" size={12} color={c.muted} />
          </View>
        ) : null}
      </View>
      {meta ? <Marquee style={[styles.meta, { color: c.muted }]}>{meta}</Marquee> : null}
    </>
  );
  const frame = [styles.card, { borderColor: c.border, backgroundColor: c.panel }];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={frame}>
      {body}
    </Pressable>
  ) : (
    <View style={frame}>{body}</View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: S.border, paddingTop: 9, paddingBottom: 9, paddingLeft: 12, paddingRight: 10, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans600, fontSize: 15 },
  input: { padding: 0, minHeight: 20 },
  multiline: { maxHeight: 132, lineHeight: 20 },
  struck: { textDecorationLine: 'line-through' },
  tag: { flexShrink: 1, maxWidth: '45%', fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.51 },
  meta: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.19 },
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
});
