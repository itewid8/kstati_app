// Экраны, которых нет в реестрах сверки с макетами: для структурного ревью (design/review).
import { StyleSheet, View } from 'react-native';
import { AuthScreen } from '@/screens/account/AuthScreen';
import { AvatarScreen } from '@/screens/account/AvatarScreen';
import { CreateGroupScreen } from '@/screens/account/CreateGroupScreen';
import { EditFieldScreen } from '@/screens/account/EditFieldScreen';
import { FeedbackScreen } from '@/screens/account/FeedbackScreen';
import { GroupPickerSheet } from '@/screens/account/GroupPickerSheet';
import { JoinGroupScreen } from '@/screens/account/JoinGroupScreen';
import { OnboardingScreen } from '@/screens/account/OnboardingScreen';
import { PasswordScreen } from '@/screens/account/PasswordScreen';
import { RemindersScreen } from '@/screens/account/RemindersScreen';
import { TrashScreen } from '@/screens/account/TrashScreen';
import { NoteImportScreen } from '@/screens/notes/NoteImportScreen';
import { PhoneCalendarsScreen } from '@/screens/phone/PhoneCalendarsScreen';
import { PhoneImportScreen } from '@/screens/phone/PhoneImportScreen';
import { ActionSheet } from '@/screens/sheets/ActionSheet';
import { FilterSheetView } from '@/screens/sheets/FilterSheet';
import { TopicShareView } from '@/screens/sheets/TopicShareSheet';
import { UndoToastView } from '@/screens/sheets/UndoToast';
import { TasksListScreen } from '@/screens/lists/TasksListScreen';
import { WatchScreen } from '@/screens/lists/WatchScreen';
import { tasksListFixture } from '@/screens/fixtures/lists/tasks';
import { watchFixture } from '@/screens/fixtures/lists/watch';
import { NoteShareHelp } from '@/components/NoteShareHelp';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };
const noop = () => {};
const Over = ({ children }: { children: React.ReactNode }) => <View style={s.stage}>{children}</View>;
const reminders = (n: number) => ({
  rules: [{ spec: 'm120', label: 'За 2 ч до начала' }, { spec: 'd1@20', label: 'Накануне в 20:00' }].slice(0, n),
  presets: [{ key: 'm15', label: 'ЗА 15 МИН' }, { key: 'm60', label: 'ЗА 1 Ч' }, { key: 'm120', label: 'ЗА 2 Ч', used: true }, { key: 'd1@20', label: 'НАКАНУНЕ', used: true }],
  full: false,
});

export const screens = {
  'X-Onboarding': (_: Props) => <OnboardingScreen onCreate={noop} onJoin={noop} onLater={noop} />,
  'X-Login': (_: Props) => <AuthScreen mode="login" step="password" email="karina@mail.ru" password="secret12" repeat="" name="" strength={1} canSubmit canReset vk onBack={noop} onSubmit={noop} onForgot={noop} onVk={noop} onSwitch={noop} />,
  'X-Register': (_: Props) => <AuthScreen mode="register" step="password" email="karina@mail.ru" password="qwerty" repeat="qwer" name="Карина" strength={0} canSubmit={false} error="Пароли не совпадают" onBack={noop} onSwitch={noop} />,
  'X-Avatar': (_: Props) => <AvatarScreen name="Карина" color="pink" autoColor="pink" symbol="" canSave onBack={noop} onSave={noop} onCancel={noop} />,
  'X-EditName': (_: Props) => <EditFieldScreen field="name" name="Карина" nick="karina" gender="f" canSave onBack={noop} onSave={noop} onCancel={noop} />,
  'X-EditNick': (_: Props) => <EditFieldScreen field="nick" name="Карина" nick="karina_n" gender="f" nickState="taken" error="Этот ник уже занят" canSave={false} onBack={noop} />,
  'X-Password': (_: Props) => <PasswordScreen hasOld old="old12345" password="NewPass2026" repeat="NewPass2026" strength={2} canSave onBack={noop} onSave={noop} onCancel={noop} />,
  'X-Reminders': (_: Props) => <RemindersScreen timed={reminders(2)} allDay={reminders(1)} canSave onBack={noop} onSave={noop} onCancel={noop} />,
  'X-Feedback': (_: Props) => <FeedbackScreen kind="bug" text="После выбора всех заметок кнопка «Перенести» не активна" dictate="idle" onDictate={noop} onBack={noop} onSend={noop} onCancel={noop} />,
  'X-CreateGroup': (_: Props) => <CreateGroupScreen name="Мы с Кариной" category="couple" caption="ГРУППЫ" onBack={noop} onCreate={noop} onCancel={noop} />,
  'X-JoinGroup': (_: Props) => <JoinGroupScreen code="K7Q2" caption="ГРУППЫ" onBack={noop} onJoin={noop} onCancel={noop} />,
  'X-JoinGroupError': (_: Props) => <JoinGroupScreen code="K7Q2XZ" error errorText="Такого кода нет" onBack={noop} />,
  'X-Trash': (_: Props) => (
    <TrashScreen
      filters={[{ key: 'all', label: 'ВСЁ', on: true }, { key: 'task', label: 'ДЕЛА', on: false }, { key: 'wish', label: 'ХОЧУ', on: false }, { key: 'note', label: 'ЗАМЕТКИ', on: false }]}
      days={[
        { key: 'd1', title: 'СЕГОДНЯ', rows: [
          { key: 'a', type: 'ДЕЛО', title: 'Купить корм коту', meta: 'ОСТАЛОСЬ 30 ДН.', checked: true },
          { key: 'b', type: 'ЗАМЕТКА', title: 'Рецепт плова', meta: 'ОСТАЛОСЬ 30 ДН.', checked: false },
        ] },
        { key: 'd2', title: '28 ОКТ', rows: [{ key: 'c', type: 'ХОЧУ', title: 'Плед', meta: 'ОСТАЛОСЬ 26 ДН.', checked: false }] },
      ]}
      total={3} selected={1} allSelected={false} onBack={noop} onRestore={noop} onPurge={noop} onSelectAll={noop}
    />
  ),
  'X-NoteImportEmpty': (_: Props) => <NoteImportScreen phase="empty" groups={[]} destLabel="ПО ЯРЛЫКАМ" selected={0} allChecked={false} onBack={noop} onHelp={noop} onPick={noop} />,
  'X-NoteImport': (_: Props) => (
    <NoteImportScreen
      phase="ready" sourceTitle="takeout-keep.zip" sourceMeta="GOOGLE KEEP · 46 ЗАМЕТОК · 1 УЖЕ ЕСТЬ"
      groups={[
        { key: 'g1', title: 'ДАЧА', rows: [
          { key: 'n1', title: 'Список покупок на дачу', meta: '12 СЕН 2026 · 5 ПУНКТОВ', state: 'new', checked: true },
          { key: 'n2', title: 'Пароль от вайфая на даче', meta: 'ПЕРЕНЕСЕНО', state: 'done', checked: false },
        ] },
        { key: 'g2', title: 'БЕЗ ЯРЛЫКА', rows: [
          { key: 'n3', title: 'Рецепт плова', meta: '11 МАР 2025 · Рис 500 г, морковь…', state: 'new', checked: true },
          { key: 'n4', title: 'Без названия', meta: '30 ЯНВ 2025 · Позвонить в автосервис', state: 'new', checked: false },
        ] },
      ]}
      destLabel="ПО ЯРЛЫКАМ KEEP" selected={2} allChecked={false} onBack={noop} onPick={noop} onTransfer={noop} onToggleAll={noop} onPickDest={noop}
    />
  ),
  'X-PhoneCalendars': (_: Props) => (
    <PhoneCalendarsScreen access="granted" show imported={12}
      cals={[
        { id: '1', title: 'Личный', account: 'GOOGLE', color: '#3D6FD9', on: true, dest: 'ТОЛЬКО МНЕ' },
        { id: '2', title: 'Работа', account: 'GOOGLE', color: '#D9A93A', on: true, dest: 'ТОЛЬКО МНЕ' },
        { id: '3', title: 'Дни рождения', account: 'КОНТАКТЫ', color: '#C93C8D', on: false, dest: 'МЫ С КАРИНОЙ' },
      ]}
      onBack={noop} onImport={noop} onDropAll={noop} onToggleShow={noop} onToggleCal={noop} onPickDest={noop}
    />
  ),
  'X-PhoneAccess': (_: Props) => <PhoneCalendarsScreen access="ask" show={false} imported={0} cals={[]} onBack={noop} onAsk={noop} />,
  'X-PhoneImport': (_: Props) => (
    <PhoneImportScreen access="granted" loading={false} period="month"
      chips={[{ id: '1', label: 'ЛИЧНЫЙ', on: true }, { id: '2', label: 'РАБОТА', on: true }]}
      sections={[
        { key: 's1', title: 'ПН 2 НОЯ', rows: [
          { key: 'e1', time: '10:00', title: 'Планёрка', cal: 'РАБОТА', repeat: true, state: 'new', checked: true },
          { key: 'e2', time: 'ВЕСЬ ДЕНЬ', title: 'ДР Миши', cal: 'КОНТАКТЫ', birthday: true, state: 'done', checked: false },
        ] },
        { key: 's2', title: 'СР 4 НОЯ', rows: [{ key: 'e3', time: '19:30', title: 'Театр', cal: 'ЛИЧНЫЙ', state: 'changed', checked: false }] },
      ]}
      destLabel="ПО КАЛЕНДАРЯМ" selected={1} allChecked={false} emptyText="За 30 дней событий нет"
      onBack={noop} onPeriod={noop} onTransfer={noop} onToggleAll={noop} onPickDest={noop} onUpdate={noop}
    />
  ),
  'X-PhoneImportAll': (_: Props) => (
    <PhoneImportScreen access="granted" loading={false} period="all" chips={[]} past={{ on: false, count: 312 }} onTogglePast={noop}
      sections={[{ key: 's1', title: 'НОЯБРЬ 2026', rows: [{ key: 'e1', time: '10:00', title: 'Планёрка', cal: 'РАБОТА', repeat: true, state: 'new', checked: true }] }]}
      destLabel="ПО КАЛЕНДАРЯМ" selected={1} allChecked emptyText="" onBack={noop} onTransfer={noop} />
  ),
  'X-ListSelect': (_: Props) => {
    const f = tasksListFixture();
    return <TasksListScreen {...f} selected={['t3']} pickable={['t1', 't2', 't3']} allSelected={false} onCancelSelect={noop}
      selectActions={[{ label: 'ЗАКРЫТЬ', n: 1, onPress: noop }, { label: 'ОТКРЫТЬ', n: 0, onPress: noop }, { label: 'ПЕРЕНЕСТИ', n: 1, onPress: noop }, { label: 'УДАЛИТЬ', n: 1, danger: true, onPress: noop }]} />;
  },
  'X-WatchSelect': ({ theme }: Props) => (
    <WatchScreen {...watchFixture(theme)} selected={['m1', 'm2']} pickable={['m1', 'm2', 'm3']} allSelected={false} onCancelSelect={noop}
      selectActions={[{ label: 'ПОСМОТРЕЛИ', n: 2, onPress: noop }, { label: 'В ОЧЕРЕДЬ', n: 0, onPress: noop }, { label: 'УДАЛИТЬ', n: 2, danger: true, onPress: noop }]} />
  ),
  'X-ActionSheet': (_: Props) => <Over><ActionSheet title="Йога" meta="ДЕЛО · СЕГОДНЯ 19:00" actions={[{ label: 'Изменить' }, { label: 'Перенести на завтра' }, { label: 'Удалить', danger: true }]} onAction={noop} onClose={noop} /></Over>,
  'X-FilterSheet': (_: Props) => <Over><FilterSheetView title="Жанр" options={[{ key: 'a', label: 'Фантастика', selected: true }, { key: 'b', label: 'Драма', selected: false }, { key: 'c', label: 'Комедия', selected: false }]} onDone={noop} onClear={noop} onToggle={noop} /></Over>,
  'X-TopicShare': (_: Props) => <Over><TopicShareView title="Дача" meta="12 ЗАМЕТОК" color="pink" groups={[{ id: 'g1', name: 'Мы с Кариной', meta: '2 УЧАСТНИКА', shared: true }, { id: 'g2', name: 'Семья', meta: '4 УЧАСТНИКА', shared: false }]} onToggle={noop} onClose={noop} /></Over>,
  'X-GroupPicker': (_: Props) => <Over><GroupPickerSheet visible groups={[{ id: 'g1', name: 'Мы с Кариной', meta: 'ПАРА · 2', current: true }, { id: 'g2', name: 'Семья', meta: 'СЕМЬЯ · 4', current: false }]} onPick={noop} onClose={noop} onCreate={noop} onOpenSettings={noop} /></Over>,
  'X-Undo': (_: Props) => <Over><UndoToastView label="Удалено: 3" onUndo={noop} style={s.toast} /></Over>,
  'X-ShareHelp': (_: Props) => <Over><NoteShareHelp visible onClose={noop} /></Over>,
};

const s = StyleSheet.create({ stage: { flex: 1, justifyContent: 'flex-end' }, toast: { margin: 16 } });
