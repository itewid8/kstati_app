/**
 * Выбор группы (группа в верхней панели списков и календаря): мои группы — текущая с галочкой,
 * снизу НАСТРОЙКИ (текущей группы) и НОВАЯ ГРУППА. Вступление по коду — в профиле.
 * Презентационное нижнее окно: кладётся последним ребёнком (BottomSheet — absolute).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ID } from '@/lib/types';
import { BottomSheet, Icon, SectionBox, pad2, size as S, useTheme } from '@/ui';
import { AccountRow } from './components/AccountRow';
import { WideButton } from './components/WideButton';

export type PickerGroup = {
  id: ID;
  name: string;
  /** «ПАРА · 2» */
  meta: string;
  current: boolean;
};

export type GroupPickerSheetProps = {
  visible: boolean;
  groups: PickerGroup[];
  bottomInset?: number;
  onClose?: () => void;
  onPick?: (id: ID) => void;
  /** Настройки текущей группы; нет текущей — кнопки нет */
  onOpenSettings?: () => void;
  onCreate?: () => void;
};

/** Видно шесть групп, дальше список прокручивается */
const MAX_LIST = S.sectionHeader + S.border * 2 + S.row * 6;

const CurrentMark = memo(function CurrentMark() {
  const { c } = useTheme();
  return <Icon name="check" size={12} color={c.text} strokeWidth={3} />;
});

export const GroupPickerSheet = memo(function GroupPickerSheet(props: GroupPickerSheetProps) {
  const { visible, groups, bottomInset = 0, onClose, onPick, onOpenSettings, onCreate } = props;
  return (
    <BottomSheet visible={visible} onClose={onClose} bottomInset={bottomInset}>
      {groups.length ? (
        <SectionBox title="ГРУППЫ" count={pad2(groups.length)} scrollable style={styles.list}>
          {groups.map((g) => (
            <AccountRow
              key={g.id}
              label={g.name}
              value={g.meta}
              chevron={false}
              right={g.current ? <CurrentMark /> : null}
              accessibilityLabel={g.current ? `${g.name}, выбрана` : g.name}
              onPress={onPick ? () => onPick(g.id) : undefined}
            />
          ))}
        </SectionBox>
      ) : null}
      <View style={styles.actions}>
        {onOpenSettings ? <WideButton label="НАСТРОЙКИ" variant="outline" onPress={onOpenSettings} style={styles.settings} /> : null}
        <WideButton label="НОВАЯ ГРУППА" onPress={onCreate} style={styles.create} />
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  list: { maxHeight: MAX_LIST },
  actions: { flexDirection: 'row', gap: 8 },
  settings: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
  create: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
});
