/**
 * Перенести заметки (из файлов или нескольких сразу через «Поделиться»). Сначала — «ВЫБРАТЬ ФАЙЛ» и форматы;
 * потом источник (файл, сколько заметок, сколько уже есть), заметки группами «ярлык → тема» (нажатие на шапку
 * выбирает группу), уже перенесённые — бледные. Снизу: в какие темы, ВЫБРАТЬ / СНЯТЬ ВСЕ, ПЕРЕНЕСТИ N.
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, IconButton, SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from '../account/components/AccountHeader';
import { Loading, PhoneNotice, Tick } from '../phone/PhoneParts';

export type NoteRow = { key: string; title: string; meta: string; state: 'new' | 'done'; checked: boolean };
export type NoteGroup = { key: string; title: string; rows: readonly NoteRow[] };

export type NoteImportScreenProps = {
  phase: 'empty' | 'loading' | 'ready';
  /** «takeout-keep.zip», «ИЗ GOOGLE KEEP» */
  sourceTitle?: string;
  /** «GOOGLE KEEP · 46 ЗАМЕТОК · 1 УЖЕ ЕСТЬ» */
  sourceMeta?: string;
  groups: readonly NoteGroup[];
  destLabel: string;
  selected: number;
  allChecked: boolean;
  /** Нет модулей в сборке / ошибка чтения */
  error?: string;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  /** «?» в шапке: как перенести через «Поделиться» */
  onHelp?: () => void;
  onPick?: () => void;
  onToggleRow?: (key: string) => void;
  onToggleGroup?: (key: string) => void;
  onToggleAll?: () => void;
  onPickDest?: () => void;
  onTransfer?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
/** Основной способ — коротко; подробнее — по «?» (components/NoteShareHelp) */
const SHARE_STEPS = ['Откройте заметку в другом приложении', 'Нажмите «Поделиться»', 'Выберите «Кстати» и нажмите «СОХРАНИТЬ»'];

const Row = memo(function Row({ row, onToggle }: { row: NoteRow; onToggle?: (k: string) => void }) {
  const { c } = useTheme();
  const free = row.state === 'new';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.checked, disabled: !free }}
      accessibilityLabel={row.title}
      disabled={!free}
      onPress={onToggle ? () => onToggle(row.key) : undefined}
      style={[styles.row, { borderTopColor: c.hair }, !free && styles.faded]}
    >
      {free ? <Tick on={row.checked} /> : <Icon name="check" size={14} color={c.muted} />}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{row.title}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{free ? row.meta : 'ПЕРЕНЕСЕНО'}</Text>
      </View>
    </Pressable>
  );
});

export const NoteImportScreen = memo(function NoteImportScreen(props: NoteImportScreenProps) {
  const { phase, groups, destLabel, selected, allChecked, insets = NO_INSETS } = props;
  const { c } = useTheme();
  const ready = phase === 'ready';
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + (ready ? 170 : 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader
          caption="ЗАМЕТКИ"
          title="Перенести заметки"
          onBack={props.onBack}
          right={props.onHelp ? <IconButton icon="help" accessibilityLabel="Как перенести заметки" onPress={props.onHelp} /> : undefined}
        />
        <View style={styles.body}>
          {props.error ? <PhoneNotice text={props.error} /> : null}
          {phase === 'empty' ? (
            <>
              <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
                <View style={[styles.head, { backgroundColor: c.text }]}>
                  <Text style={[styles.headText, styles.flex, { color: c.bg }]}>ПОДЕЛИТЬСЯ → КСТАТИ</Text>
                </View>
                {SHARE_STEPS.map((t, i) => (
                  <View key={t} style={[styles.step, i > 0 && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
                    <Text style={[styles.num, { color: c.text }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[styles.stepText, { color: c.text }]}>{t}</Text>
                  </View>
                ))}
                {props.onHelp ? (
                  <Pressable accessibilityRole="button" onPress={props.onHelp} style={[styles.more, { borderTopColor: c.hair }]}>
                    <Text style={[styles.smallText, { color: c.text }]}>НЕСКОЛЬКО ЗАМЕТОК СРАЗУ И ВЕСЬ KEEP</Text>
                    <Icon name="chevronRight" size={10} color={c.text} />
                  </Pressable>
                ) : null}
              </View>
              <View style={[styles.box, styles.pick, { borderColor: c.border, backgroundColor: c.panel }]}>
                <Text style={[styles.formats, { color: c.muted }]}>ВСЁ СРАЗУ ИЗ ФАЙЛА · ZIP ИЗ GOOGLE TAKEOUT · JSON · TXT · MD</Text>
                <Pressable accessibilityRole="button" onPress={props.onPick} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
                  <Text style={[styles.buttonText, { color: c.text }]}>ВЫБРАТЬ ФАЙЛ</Text>
                </Pressable>
              </View>
            </>
          ) : phase === 'loading' ? (
            <Loading />
          ) : (
            <>
              <View style={[styles.box, styles.source, { borderColor: c.border, backgroundColor: c.panel }]}>
                <Icon name="folder" size={16} color={c.text} />
                <View style={styles.text}>
                  <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{props.sourceTitle}</Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{props.sourceMeta}</Text>
                </View>
                {props.onPick ? (
                  <Pressable accessibilityRole="button" onPress={props.onPick} style={[styles.small, { borderColor: c.border }]}>
                    <Text style={[styles.smallText, { color: c.text }]}>ДРУГОЙ ФАЙЛ</Text>
                  </Pressable>
                ) : null}
              </View>
              {groups.length ? (
                <>
                  <SectionBox
                    title="ЗАМЕТКИ"
                    count={String(groups.reduce((n, x) => n + x.rows.length, 0))}
                    action={props.onToggleAll && { label: allChecked ? 'СНЯТЬ ВСЕ' : 'ВЫБРАТЬ ВСЕ', onPress: props.onToggleAll }}
                  />
                  {groups.map((g) => (
                  <View key={g.key} style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${g.title}: выбрать все`}
                      onPress={props.onToggleGroup ? () => props.onToggleGroup!(g.key) : undefined}
                      style={[styles.head, { backgroundColor: c.text }]}
                    >
                      <Text numberOfLines={1} style={[styles.headText, styles.flex, { color: c.bg }]}>{g.title}</Text>
                      <Text style={[styles.headText, { color: c.bg }]}>{String(g.rows.length).padStart(2, '0')}</Text>
                    </Pressable>
                    {g.rows.map((r) => (
                      <Row key={r.key} row={r} onToggle={props.onToggleRow} />
                    ))}
                  </View>
                ))}
                </>
              ) : (
                <PhoneNotice text="Заметок в файле не нашлось" />
              )}
            </>
          )}
        </View>
      </ScrollView>
      {ready && groups.length ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16, borderTopColor: c.hair, backgroundColor: c.bg }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`В какие темы: ${destLabel}`} onPress={props.onPickDest} style={[styles.dest, { borderColor: c.border, backgroundColor: c.panel }]}>
            <Text style={[styles.destLabel, { color: c.muted }]}>В ТЕМЫ</Text>
            <Text numberOfLines={1} style={[styles.destValue, { color: c.text }]}>{destLabel}</Text>
            <Icon name="chevronDown" size={10} color={c.text} />
          </Pressable>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected }}
              disabled={!selected}
              onPress={props.onTransfer}
              style={[styles.button, styles.main, { borderColor: c.text, backgroundColor: c.text }, !selected && styles.faded]}
            >
              <Text style={[styles.buttonText, { color: c.bg }]}>{selected ? `ПЕРЕНЕСТИ ${selected}` : 'ПЕРЕНЕСТИ'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: space.side },
  body: { marginTop: 12, gap: 8 },
  box: { borderWidth: S.border },
  pick: { padding: 12, gap: 12 },
  formats: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.6 },
  source: { minHeight: 52, paddingLeft: 10, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fonts.sans500, fontSize: 14 },
  meta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.4 },
  small: { height: 32, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  smallText: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.6 },
  step: { paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', gap: 10 },
  num: { width: 20, fontFamily: fonts.mono600, fontSize: 11, lineHeight: 19 },
  stepText: { flex: 1, fontFamily: fonts.sans500, fontSize: 14, lineHeight: 19 },
  more: { height: S.row, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: S.hairline },
  head: { height: S.sectionHeader, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  row: { minHeight: 56, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: S.hairline },
  faded: { opacity: 0.4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: space.side, gap: 10, borderTopWidth: S.hairline },
  dest: { height: 40, paddingHorizontal: 10, borderWidth: S.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  destLabel: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  destValue: { flex: 1, fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 2 },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
