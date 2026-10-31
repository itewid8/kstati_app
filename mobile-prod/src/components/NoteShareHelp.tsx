/**
 * Подсказка «Как перенести заметки» (значок «?» на экране «Перенести заметки»): основной способ — «Поделиться»,
 * по шагам; несколько заметок сразу; закрепить «Кстати» в списке; запасной способ — файл из Google Takeout.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Platform } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import { Sheet } from './Sheet';

const STEPS = [
  'Откройте заметку в Google Keep, Samsung Notes, Xiaomi Notes или другом приложении',
  'Нажмите «Поделиться»',
  'В списке приложений выберите «Кстати»',
  'Проверьте название и тему, нажмите «СОХРАНИТЬ»',
];

const TIPS = [
  'Чтобы перенести несколько заметок, выделите их долгим нажатием и поделитесь. Откроется список: можно выбрать одну тему на всех или сделать каждую заметку отдельной темой',
  'Чтобы «Кстати» была первой в списке «Поделиться», удерживайте её значок и выберите «Закрепить»',
  'Списки с галочками переносятся пунктами. Картинки и вложения не переносятся',
  'Чтобы перенести весь Google Keep, выгрузите на takeout.google.com только Keep и выберите полученный архив кнопкой «ВЫБРАТЬ ФАЙЛ»',
];

export function NoteShareHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const footer = (
    <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, { borderColor: c.text, backgroundColor: c.text }]}>
      <Text style={[styles.buttonText, { color: c.bg }]}>ПОНЯТНО</Text>
    </Pressable>
  );
  if (!visible) return null;
  return (
    <Sheet visible onClose={onClose} footer={footer} inset>
      <View style={styles.gap4}>
        <Text style={[styles.cap, { color: c.muted }]}>ПОДСКАЗКА</Text>
        <Text style={[styles.title, { color: c.text }]}>Как перенести заметки</Text>
      </View>
      <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
        <View style={[styles.head, { backgroundColor: c.text }]}>
          <Text style={[styles.headText, { color: c.bg }]}>ПОДЕЛИТЬСЯ → КСТАТИ</Text>
        </View>
        {STEPS.map((t, i) => (
          <View key={t} style={[styles.step, i > 0 && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
            <Text style={[styles.num, { color: c.text }]}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[styles.text, { color: c.text }]}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tips}>
        {TIPS.map((t) => (
          <View key={t} style={styles.tip}>
            <Text style={[styles.dot, { color: c.muted }]}>•</Text>
            <Text style={[styles.tipText, { color: c.muted }]}>{t}</Text>
          </View>
        ))}
        {Platform.OS === 'ios' ? (
          <View style={styles.tip}>
            <Text style={[styles.dot, { color: c.muted }]}>•</Text>
            <Text style={[styles.tipText, { color: c.muted }]}>На iPhone «Поделиться → Кстати» появится в следующих версиях</Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap4: { gap: 4 },
  cap: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  title: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 28, letterSpacing: -0.9 },
  box: { borderWidth: S.border },
  head: { height: S.sectionHeader, paddingHorizontal: 8, justifyContent: 'center' },
  headText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  step: { paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', gap: 10 },
  num: { width: 20, fontFamily: fonts.mono600, fontSize: 11, lineHeight: 19 },
  text: { flex: 1, fontFamily: fonts.sans500, fontSize: 14, lineHeight: 19 },
  tips: { gap: 6 },
  tip: { flexDirection: 'row', gap: 6 },
  dot: { fontFamily: fonts.sans400, fontSize: 13, lineHeight: 18 },
  tipText: { flex: 1, fontFamily: fonts.sans400, fontSize: 13, lineHeight: 18 },
  button: { height: 44, marginTop: 10, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
