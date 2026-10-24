/**
 * Группа (C-Group): название, категория, код приглашения, участники, мои дела в группе, общие списки, «Покинуть группу».
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { plural } from '@/lib/plans';
import { CATEGORIES, type GroupCategory, type ID, type PersonColor } from '@/lib/types';
import { ScreenTitle, SectionBox, fonts, pad2, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';
import { CopyIcon, ShareIcon } from './components/AccountIcons';
import { AccountRow } from './components/AccountRow';
import { MemberRow } from './components/MemberRow';
import { SaveBar } from './components/SaveBar';
import { accountText, gridColumn, useAccountPalette } from './components/accountTheme';
import { CATEGORY_SHORT } from './components/categories';

export type GroupRole = 'owner' | 'admin' | 'member';

export type GroupMember = {
  id: ID;
  name: string;
  /** Без «@» */
  nick?: string | null;
  color: PersonColor;
  /** Символ на квадрате; нет — первая буква имени */
  avatar?: string | null;
  role: GroupRole;
  /** Это вы — к имени добавляется «(вы)» */
  isMe?: boolean;
};

export type SharedListKey = 'tasks' | 'wishes' | 'watch' | 'ideas';

export type SharedListSummary = {
  key: SharedListKey;
  /** Открытые дела, желания, фильмы в очереди, идеи */
  count: number;
};

export type GroupScreenProps = {
  name: string;
  category: GroupCategory;
  inviteCode: string;
  /** Ваша роль — в подписи «ГРУППА · ВЫ СОЗДАТЕЛЬ» */
  myRole: GroupRole;
  members: GroupMember[];
  lists: SharedListSummary[];
  /** «МОИ ДЕЛА В ГРУППЕ»: мой режим, сколько моих дел видно группе и сколько скрыто */
  share?: { selectOnly: boolean; visible: number; hidden: number };
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  /** Нет колбэка — название и категория не меняются (нет прав) */
  onRename?: () => void;
  onChangeCategory?: (category: GroupCategory) => void;
  onCopyCode?: () => void;
  onShareCode?: () => void;
  onOpenMember?: (id: ID) => void;
  onOpenList?: (key: SharedListKey) => void;
  onOpenShare?: () => void;
  onLeave?: () => void;
  /**
   * Название или категория изменены и не сохранены: снизу появляется ОТМЕНА / СОХРАНИТЬ.
   * Без изменений плашки нет (копирование кода, участники, списки и выход действуют сразу)
   */
  dirty?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

const ROLE_LABEL: Record<GroupRole, string> = { owner: 'СОЗДАТЕЛЬ', admin: 'АДМИН', member: 'УЧАСТНИК' };

const LIST_LABEL: Record<SharedListKey, string> = { tasks: 'Дела', wishes: 'Хочу', watch: 'Смотреть', ideas: 'Идеи' };

/** «12 ОТКРЫТЫХ», «04 ЖЕЛАНИЯ», «07 В ОЧЕРЕДИ», «09 ИДЕЙ» */
function listSummary({ key, count }: SharedListSummary): string {
  const n = pad2(count);
  switch (key) {
    case 'tasks':
      return `${n} ${plural(count, 'ОТКРЫТОЕ', 'ОТКРЫТЫХ', 'ОТКРЫТЫХ')}`;
    case 'wishes':
      return `${n} ${plural(count, 'ЖЕЛАНИЕ', 'ЖЕЛАНИЯ', 'ЖЕЛАНИЙ')}`;
    case 'watch':
      return `${n} В ОЧЕРЕДИ`;
    case 'ideas':
      return `${n} ${plural(count, 'ИДЕЯ', 'ИДЕИ', 'ИДЕЙ')}`;
  }
}

const upper = (s: string) => s.toLocaleUpperCase('ru-RU');

/* ---------- Категория: пять кнопок 32px, соседние рамки накладываются ---------- */

type CategoryProps = { value: GroupCategory; onChange?: (category: GroupCategory) => void };

const CategoryPicker = memo(function CategoryPicker({ value, onChange }: CategoryProps) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.categories}>
      {CATEGORIES.map((key, i) => {
        const on = key === value;
        return (
          <View key={key} style={styles.categoryCell}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={CATEGORY_SHORT[key]}
              accessibilityState={{ selected: on, disabled: !onChange }}
              disabled={!onChange}
              onPress={onChange ? () => onChange(key) : undefined}
              style={[
                styles.category,
                i > 0 && styles.categoryOverlap,
                { borderColor: c.border, backgroundColor: on ? c.text : c.panel },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[on ? styles.categoryTextActive : styles.categoryText, { color: on ? c.bg : c.text }]}
              >
                {CATEGORY_SHORT[key]}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
});

/* ---------- Код приглашения ---------- */

type InviteProps = { code: string; onCopy?: () => void; onShare?: () => void };

const InviteCode = memo(function InviteCode({ code, onCopy, onShare }: InviteProps) {
  const { c } = useTheme();
  const chars = code.split('');
  const width = gridColumn(chars.length);
  return (
    <SectionBox title="КОД ПРИГЛАШЕНИЯ" count={pad2(chars.length)}>
      <View accessible accessibilityLabel={`Код приглашения ${chars.join(' ')}`} style={[styles.code, { backgroundColor: c.panel }]}>
        {chars.map((ch, i) => (
          <View key={i} style={[styles.codeCell, { width }, i > 0 && { borderLeftWidth: S.hairline, borderLeftColor: c.hair }]}>
            <Text style={[styles.codeChar, { color: c.text }]}>{ch}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.codeActions, { borderTopColor: c.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Копировать код"
          onPress={onCopy}
          style={[styles.codeAction, { backgroundColor: c.panel }]}
        >
          <CopyIcon size={13} color={c.text} />
          <Text style={[styles.codeActionText, { color: c.text }]}>КОПИРОВАТЬ</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Поделиться кодом"
          onPress={onShare}
          style={[styles.codeAction, styles.codeShare, { backgroundColor: c.text, borderLeftColor: c.border }]}
        >
          <ShareIcon size={13} color={c.bg} />
          <Text style={[styles.codeActionText, { color: c.bg }]}>ПОДЕЛИТЬСЯ</Text>
        </Pressable>
      </View>
    </SectionBox>
  );
});

/* ---------- Экран ---------- */

export const GroupScreen = memo(function GroupScreen(props: GroupScreenProps) {
  const {
    name,
    category,
    inviteCode,
    myRole,
    members,
    lists,
    share,
    insets = NO_INSETS,
    onBack,
    onRename,
    onChangeCategory,
    onCopyCode,
    onShareCode,
    onOpenMember,
    onOpenList,
    onOpenShare,
    onLeave,
    dirty = false,
    onCancel,
    onSave,
  } = props;
  const { c } = useTheme();
  const pal = useAccountPalette();

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: dirty ? 24 : insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader caption={`ГРУППА · ВЫ ${ROLE_LABEL[myRole]}`} onBack={onBack} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Название группы: ${name}`}
          accessibilityState={{ disabled: !onRename }}
          disabled={!onRename}
          onPress={onRename}
          style={styles.title}
        >
          <ScreenTitle title={name} />
        </Pressable>

        <CategoryPicker value={category} onChange={onChangeCategory} />

        <View style={styles.sections}>
          <InviteCode code={inviteCode} onCopy={onCopyCode} onShare={onShareCode} />

          <SectionBox title="УЧАСТНИКИ" count={pad2(members.length)}>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                name={m.isMe ? `${m.name} (вы)` : m.name}
                nick={m.nick ? `@${upper(m.nick)}` : undefined}
                color={m.color}
                symbol={m.avatar || upper(m.name.slice(0, 1))}
                role={m.role === 'member' ? undefined : ROLE_LABEL[m.role]}
                onPress={onOpenMember ? () => onOpenMember(m.id) : undefined}
              />
            ))}
          </SectionBox>

          {share ? (
            <SectionBox title="МОИ ДЕЛА В ГРУППЕ" count={pad2(share.visible)}>
              <AccountRow
                label={share.selectOnly ? 'Только выбранные' : 'Все, кроме скрытых'}
                value={`${pad2(share.hidden)} СКРЫТО`}
                onPress={onOpenShare}
              />
            </SectionBox>
          ) : null}

          <SectionBox title="ОБЩИЕ СПИСКИ" count={pad2(lists.length)}>
            {lists.map((l) => (
              <AccountRow
                key={l.key}
                label={LIST_LABEL[l.key]}
                value={listSummary(l)}
                onPress={onOpenList ? () => onOpenList(l.key) : undefined}
              />
            ))}
          </SectionBox>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Покинуть группу"
            onPress={onLeave}
            style={[styles.leave, { borderColor: pal.danger }]}
          >
            <Text style={[accountText.wideAction, { color: pal.danger }]}>ПОКИНУТЬ ГРУППУ</Text>
          </Pressable>
        </View>
      </ScrollView>
      {dirty ? <SaveBar canSave bottomInset={insets.bottom} onCancel={onCancel} onSave={onSave} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  title: { marginTop: 14 },

  categories: { marginTop: 8, flexDirection: 'row' },
  categoryCell: { width: gridColumn(CATEGORIES.length) },
  category: { height: S.tab, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  /** Рамка ложится на рамку соседа слева, как margin-left: −1.5px в макете */
  categoryOverlap: { marginLeft: -S.border },
  categoryText: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.36 },
  categoryTextActive: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.36 },

  sections: { marginTop: 10, gap: 10 },

  code: { flexDirection: 'row' },
  codeCell: { height: 52, alignItems: 'center', justifyContent: 'center' },
  codeChar: { fontFamily: fonts.mono600, fontSize: 26 },
  codeActions: { flexDirection: 'row', borderTopWidth: S.border },
  codeAction: { width: '50%', height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  codeShare: { borderLeftWidth: S.border },
  codeActionText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.84 },

  leave: { height: 40, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
