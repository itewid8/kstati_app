# Интеграция редизайна в `mobile-prod/` (этап 3)

Дата: 2026-10-18. Основа: код `mobile-prod/` на коммите `0da3f99`, `docs/redesign/DECISIONS.md`, `docs/server-changes-v2.md`,
`docs/redesign/AUDIT-2.md`. Цель — подключить 28 выверенных экранов `src/screens/**` к данным (`src/lib/*`) и навигации, не трогая `mobile/` и не сломав сверку.

---

## 0. Принципы и соглашения

### 0.1. Три слоя

```
app/**                 маршруты expo-router: 3–10 строк, только <XContainer/> и параметры адреса
src/containers/**      React: читают store (useStore + useShallow), router, safe area; вызывают адаптер; привязывают колбэки к действиям
src/adapters/**        чистые функции (Snapshot, Clock, UiState) → данные пропсов экрана; без react, react-native, expo, store
src/screens/**         презентационные экраны (как есть), рендерятся в реестрах из фикстур
```

- Экраны **не меняются** по смыслу. Разрешено только **добавить необязательный проп** (например `onEditTitle`), который
  ничего не меняет в рендере без него. После такой правки владелец потока прогоняет свой реестр.
- Реестры `design-registry*.tsx` и фикстуры `src/screens/fixtures/**` не трогаем. Контейнеры в реестры не попадают.
- Адаптер возвращает **только данные**: тип результата — `DataOf<XScreenProps>` (см. 0.2). Колбэки и `insets` добавляет контейнер.
- Импорты в адаптерах: `@/lib/*` разрешены, но только чистые модули (`types`, `recur`, `span`, `dates`, `remind`, `plans`, `dupes`,
  `calendarLayout`, новый `personColors`). Из `@/screens/**` — только `import type` и чистые `screens/calendar/format.ts`,
  `screens/editors/periodMath.ts`, `screens/editors/components/calendarMath.ts`.
- В интерфейсе без поясняющих подписей. Новые элементы без макета (InputSheet, окно ошибки голоса) собираются из `src/ui` и
  токенов: монохром, Geist / Geist Mono.

### 0.2. Общие типы (создаёт Ф, файл `src/adapters/snapshot.ts`)

```ts
import type { Activity, Group, ID, Idea, Me, ReminderSettings, Task, TaskReminderOverride, Topic, User, WatchItem, Wish } from '@/lib/types';
import type { DayMinute, IsoDate } from '@/lib/calendarLayout';

/** Срез хранилища, который нужен адаптерам. me не null: контейнеры живут только после входа */
export type Snapshot = {
  me: Me; users: User[]; groups: Group[]; currentGroupId: ID | null;
  tasks: Task[]; wishes: Wish[]; watch: WatchItem[]; topics: Topic[]; ideas: Idea[];
  overrides: Record<ID, TaskReminderOverride>; reminders: ReminderSettings;
  activity: Activity[]; activitySeen: string;
};
/** Время снаружи — адаптеры детерминированы и тестируются на фикстурах макетов (сегодня 2026-10-05, 17:52) */
export type Clock = { today: IsoDate; now: DayMinute; nowIso: string };
/** Пропсы экрана без колбэков и safe area */
export type DataOf<P> = Omit<P, Extract<keyof P, `on${string}`> | 'insets' | 'bottomInset'>;
```

`Me` переносится из `lib/store.ts` в `lib/types.ts` (store его ре-экспортирует), чтобы адаптеры не зависели от store.

### 0.3. Общие хелперы (Ф)

| Файл | Функции |
|---|---|
| `src/lib/personColors.ts` | чистые `colorHex`, `hueHex`, `hexHue`, `inkOn`, `tint`, `memberColors` (вынести из `lib/colors.ts`, тот их ре-экспортирует) |
| `src/adapters/common/people.ts` | `colorMap(s)` — один цвет человека во всех группах: `memberColors([me, …участники групп по порядку groups/memberIds], users)`; `letterOf(user)` (avatar ?? первая буква, заглавная); `meBadge(s, colors) → { letter, color }`; `groupPeople(s, colors, groupId) → CalendarPerson[]` (я первым, `tabLabel: 'Я'`, остальные — имя заглавными); `voicePerson`, `editorPerson` |
| `src/adapters/common/ru.ts` | `upper` (ru-RU), `plural` (ре-экспорт `lib/plans`), `genitive(name, gender?)` («Карина» → «КАРИНЫ», «Дима» → «ДИМЫ», «Олег» → «ОЛЕГА», «Лена» → «ЛЕНЫ»), `busyLabel(user)` → «КАРИНА ЗАНЯТА» / «САНЯ ЗАНЯТ», `relativeDay(iso, today)` → «СЕГОДНЯ», «ВЧЕРА», «3 ДНЯ НАЗАД», «28 СЕН» |
| `src/adapters/common/when.ts` | `dayShort('2026-10-05')` → «ПН 05», `dayMonth` → «СБ 10 ОКТ», `whenLabel(date, time)` → «СБ 10 ОКТ · 19:00» / «БЕЗ ДАТЫ», `rangeDays(a, b)` → «7—9» / «05—11 ОКТ», `periodLabel(task)` → «СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00» (на основе `screens/calendar/format.ts`) |
| `src/adapters/common/tasks.ts` | `instancesIn(tasks, groupIds, from, to)` = `expandTasks` + дела без повтора, пересекающие период по `daysOf`; `parseKey('id@2026-10-10') → { id, occ }` (обратная к `taskKey`); `kidsOf(tasks, planId)`; `isPlan(t, tasks)` = нет `parentId` и есть подзадачи |
| `src/adapters/common/busy.ts` | `busyEvents(instances) → BusyEvent[]` по правилу из `calendarLayout/index.ts` (только со временем, без `isLong`, без планов с подзадачами; `people = peopleOf`); `busyFor(s, draft, personIds, exceptId) → { personId, title, range }[]` (через `conflicts`); `FREE_OPTS = { dayStart: 540, dayEnd: 1320, minGap: 60 }` — «Свободно» 09:00–22:00, окна от 1 ч (DECISIONS). `FREE_DEFAULTS` в `busy.ts` **не менять** (на них тесты) |

### 0.4. Контейнеры: общие хуки (Ф, `src/containers/common/*`)

- `useSnapshot(): Snapshot` — `useStore(useShallow(pickSnapshot))` (`zustand/react/shallow`).
- `useClock(): Clock` — тик раз в минуту по границе минуты и при `AppState → active`.
- `useInsets()` — `{ top, bottom }` из `useSafeAreaInsets()`.
- `useChrome(active: NavTab)` — общее для экранов с навигацией: `me`, `hasNews` (`activity[0]?.id > activitySeen`),
  `groupLabel` (`upper(group.name)`), `onNavigate` (→ `nav.tab`), `onRec` (→ `toggleRecording`), `onOpenFeed`, `onOpenSettings`,
  `onPickGroup` / `onOpenGroup` (→ `setGroupSheet(true)`). Контейнер берёт только нужные экрану ключи (без лишних спредов).
- `nav.ts` — единственное место с адресами: `nav.tab(tab)`, `nav.taskEditor({ id?, occ?, date?, time?, parentId? })`,
  `nav.planEditor(id, field?)`, `nav.planGrid(id)`, `nav.activity()`, `nav.profile()`, `nav.appSettings()`, `nav.group(id)`,
  `nav.reminders()`, `nav.avatar()`, `nav.profileEdit(field)`, `nav.topic(id)`.
- `layout.ts` — `useBottomSpace()` (замена `useBottomSpace` из удаляемого `components/BottomBar.tsx`):
  `insets.bottom + 18 + 72 + 8` — над `BottomNav`.

### 0.5. Тесты и проверка без npm

- `mobile-prod/scripts/test.sh [путь]` (Ф) — по образцу `src/lib/calendarLayout/run-tests.sh`: tsc из `/home/claude/webkit`
  транспилирует `src/adapters/**/*.test.ts` + зависимости в CommonJS (`paths` `@/*` → `src/*` через `--require`-хук,
  переписывающий `@/`), `node --test`. Тесты пишутся на фикстурах макетов: вход — `Snapshot` с людьми Саня/Карина/Олег, выход
  сравнивается с `src/screens/fixtures/**` (где данные макета совпадают с правилами; расхождения макета помечать в тесте).
- `mobile-prod/scripts/typecheck-lite.sh` (Ф) — `tsc --noEmit` по `src/adapters`, `src/lib` (чистые), `src/screens` с шимами
  `scripts/shims/*.d.ts` для `react-native`, `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler`,
  `react-native-worklets`, `expo-haptics`, `@expo-google-fonts/*` (явные экспорты; сокращённое `declare module 'x';` не годится —
  `StyleProp<…>` даёт TS2709, проверено). Шимы `useAnimatedReaction` и `Gesture` типизировать дженериками, иначе
  `TimeWheel.tsx` даёт TS7006. Цель — 0 ошибок. Контейнеры проверяются на Mac: `npm run typecheck`.
- Сверка: `for r in mobile-prod/design-registry*.tsx; do node design/harness/run.mjs "$r"; done`. Сейчас все экраны ≤ 0.27%
  (например, аккаунт: C-Profile 0.13%, C-Settings/C-Group 0.01%, C-Code 0.00%). Приёмка потока: ≤ 2% на тему и не хуже
  нынешнего больше чем на 0.1 п.п. без причины; `compare.png` просмотрен.

---

## 1. Инвентаризация экранов

Обозначения: **s.** — поле `useStore`, **→** — действие store / вызов API / переход. «Пробел» — чего нет в store/lib и что нужно
сделать (кто делает — в скобках: Ф, А, Б, В, Г).

### 1.1. Календарь и план (поток А)

Общее для `DayScreen`, `WeekScreen`, `MonthScreen`, `YearScreen` — `CalendarChromeProps` (`screens/calendar/types.ts`):
`groupLabel`, `me`, `hasNews`, `insets` из `useChrome('tasks')`; `onOpenList` → `setTasksView('list')`; `onAdd` →
`nav.taskEditor({ date: calendarDate })`; `onChangeView(v)` → `setTasksView(v)`; `onOpenFeed`, `onOpenSettings`, `onNavigate`, `onRec`, `onOpenGroup`.
`PersonFilterProps` (день, неделя): `people = groupPeople(currentGroup)`, `hiddenPeople = s.calendarHidden`, `onTogglePerson` → `toggleCalendarPerson(id)`.

Переходник Task → календарь (`src/adapters/calendar/events.ts`) — ровно по комментарию `src/lib/calendarLayout/index.ts`:
id события = `taskKey` (`id@occ` у повторов), `people = peopleOf`, полоса — `time == null` или `isLong` или план с подзадачами
(сам план в сетке не рисуется), сетка — `minutesOn(task, day)`, `fromPrevDay`/`toNextDay` по `minutesOn` = 0 / 1440,
`parentTitle` — название плана для подзадачи, `done` — `doneAt` или `doneDates ∋ occ`. Скрытые люди (`calendarHidden`):
дело скрывается, если **все** его `people` скрыты.

| Экран / пропсы | Данные (адаптер) | Колбэки → действия | Пробелы |
|---|---|---|---|
| `DayScreen` / `DayScreenProps` | `dayProps(s, clock, { date, hidden })`: `date = s.calendarDate`, `today`, `now` (только если сегодня), `bars` (задевающие день), `events` (по началу) | `onPrev/onNext` → `setCalendarDate(±1)`, `onToday` → `setCalendarDate(today)`; `onOpenEvent(key)` → `nav.taskEditor(parseKey(key))`; `onOpenBar(id)` → план: `nav.planGrid(id)`, иначе `nav.taskEditor` | `calendarHidden: ID[]` вместо `calendarPerson` (Ф) |
| `WeekScreen` / `WeekScreenProps` | `weekProps`: `weekStart` = понедельник `calendarDate`, `events: Record<IsoDate, TimedEvent[]>`, `bars` за неделю | `onPrev/onNext` ±7, `onToday`; `onOpenDay(d)` → `setCalendarDate(d)` + `setTasksView('day')`; `onOpenEvent`, `onOpenBar` как в дне | — |
| `MonthScreen` / `MonthScreenProps` | `monthProps`: `year`, `month` из `calendarDate`; `items` по дням (сначала без времени, потом по времени; подзадачи — строками; план — только `plans`); `plans: MonthPlan[]` (цвет = цвет первого из `peopleOf(plan)`); `agenda` выбранного дня (`time` «09:30» / «—») | `onPrev/onNext` → ±1 месяц (число 1); `onSelectDate` → `setCalendarDate`; `onOpenEvent` → редактор | Повторы — `instancesIn` за видимые 5–6 недель |
| `YearScreen` / `YearScreenProps` | `yearProps`: `people` (+ «ВМЕСТЕ» — это делает экран), `days: Record<IsoDate, YearDay>`: `people` = объединение `peopleOf` дел дня, `level = 0.35 + 0.5·min(1, n/4)` (AUDIT-2 §4.5); `monthCounts` и `total` — число дел (разы повторов считаются, подзадачи считаются, план с подзадачами — нет) | `onPrev/onNext` → ±1 год; `onOpenMonth(m)` → `setCalendarDate(y-m-01)` + `setTasksView('month')` | Производительность: `instancesIn` за год мемоизировать по `tasks` и году |
| `PlanScreen` / `PlanScreenProps` (C-Plan) | `planGridProps(s, planId)`: `caption` «ПЛАН · ГРУППА», `title`, `color`, `rangeLabel` = `periodLabel(plan)` (период дела, не подзадач — AUDIT-2 §6.2), `ownerLabel`, `startDate = plan.date`, `endDate = lastDay(plan)`, `steps` — подзадачи со временем внутри периода | `onBack` → `router.back()`; `onAddStep` → `nav.taskEditor({ parentId, date: startDate })`; `onMore` → `nav.planEditor(id)`; `onChangeMode('list')` → `router.replace` на `nav.planEditor(id)` (список подзадач — это C-EditPlan); `onOpenStep` → редактор подзадачи; `onNavigate`, `onRec`; при открытии `setVoiceParent(id)`, при уходе `null` | Подзадачи вне периода в сетку не попадают (их видно в C-EditPlan); подзадачи без времени — тоже. Принято |

### 1.2. Окна редактирования (поток Б)

Состояние окна — в контейнере: `EditorDraft` (данные) + `EditorUi` (что раскрыто). Логика — чистый редьюсер
`src/adapters/editors/draft.ts`: `draftFromTask(task, s, occ?)`, `draftFromSeed(seed)`, `emptyDraft({ date, time, parentId })`,
`reduceDraft(draft, action: EditorAction)`, `draftToItem(draft): DraftItem` (тип `task`, поля `TaskDraft`: `mine` — «для меня»,
`shared` — «для всех»). `EditorUi = { expanded, dateView: 'month'|'year', cursor: { year, month }, whoMode, remindScope, edge, endFlash }`.

| Экран / пропсы | Данные | Колбэки → действия | Пробелы |
|---|---|---|---|
| `TaskEditorScreen` / `TaskEditorScreenProps` (C-EditDate, -Repeat, -Remind, -Who) | `taskEditorProps(draft, ui, s, clock)`: `caption` «ДЕЛО · ГРУППА», `colors` (`peopleOf` черновика), `when` = `whenLabel`, `end` («11:30» / null), `repeat` = `upper(repeatLabel)` / null, `people`, `remind` (сводка `effectiveSpecs` через `presetChip`/`specsSummary`), `note`, `subtasks` («05 · 1 СДЕЛАНО» / null «+ ПЛАН» / undefined у серии), `notice` — первый конфликт `busyFor` («КАРИНА ЗАНЯТА · Йога · 19:00–20:00», `tone: 'red'`), панели: `whenPanel` (`DatePickerProps`, шаг 5 мин), `repeatPanel`, `remindPanel` (`ReminderItem.when` = `momentText(moment(spec, date, time))`, пресеты C-EditRemind: `m15`, `m30`, `m60`, `d0@09:00`, `d1@20:00`, `d2@18:00`, `used` — уже в списке), `whoPanel` (`WhoMember.meta` «СВОБОДЕН» / «ЗАНЯТА 19:00–20:00 · ЙОГА», `busy`) | `onField(f)` → раскрыть/свернуть; `note` → `InputSheet` (многострочный); `subtasks`: есть подзадачи → `nav.planEditor(id)`, нет → сохранить и `nav.taskEditor({ parentId: id })`; `onClearEnd`; `onBack` → `router.back()` (без сохранения); `onMore` → `openMenu` (Удалить, Только этот раз / Все повторы у серии, Сделать планом); `onDelete` → `deleteTask(id, occ?)` (у серии — меню «этот раз / все»); `onSave` → `saveItems([draftToItem(draft)])` + `router.back()` | **Название не редактируется** в экране: добавить необязательный `onEditTitle?: () => void` в `TaskEditorScreen` и `PlanEditorScreen` → `EditorScaffold` делает заголовок `Pressable` только при наличии колбэка (Б, правка экрана с пересверкой). Новое дело без названия: при открытии сразу `InputSheet`. Правка открытого раза серии меняет всю серию (как в старом приложении) |
| `PlanEditorScreen` / `PlanEditorScreenProps` (C-EditPlan, -Period, -Year) | `planEditorProps`: `period` = `periodLabel`, `periodPanel` (`PeriodPanelProps`: `range` с цветом плана, `edge`, `startLabel`/`endLabel`, `endFlash` — счётчик), `repeat` всегда null (у плана повтора нет, строка не раскрывается), `subtaskSummary`, `subtasks: SubtaskItem[]` (`outside` — дата вне `[plan.date, lastDay(plan)]`, `meta` «СБ 10 ОКТ · ВНЕ ДАТ ПЛАНА»), `notice` — первая вне периода: `{ label: 'ВНЕ ПЕРИОДА', text: '«Сувениры маме» · сб 10 окт', tone: 'warn' }`; при раскрытом периоде описание и список свёрнуты в сводку (как в макетах) | Период: `moveStart` / `moveEnd` из `screens/editors/periodMath.ts` (конец едет, подзадачи — **нет**); `onToggleSubtask` → `toggleTask`; `onOpenSubtask` → редактор подзадачи; `onAddSubtask` → `nav.taskEditor({ parentId })`; `onOpenGrid` → `nav.planGrid(id)`; `onDelete` → `deleteTask(id)` (вместе с подзадачами, с отменой); `onSave` | В store убрать `shiftChildren` (Ф) |

### 1.3. Голос (поток В)

Один хост `src/containers/voice/VoiceHost.tsx` в корневом макете поверх всех экранов. Состояние: `s.voice` (`idle | recording | processing`)
× `s.card` (если `source === 'voice'`). Уровни: `useLevelHistory(40)` — кольцевой буфер последних значений `useVoiceLevel` (0…1 → 0…100);
длительность — от `recordingStartedAt()`. Шапка `VoiceSheetHeader` — `sheetHeader(levels, ms, badge)`.

| Окно / пропсы | Когда | Данные | Колбэки | Пробелы |
|---|---|---|---|---|
| `VoiceCreateSheet` / `VoiceCreateSheetProps` (C-Voice) | идёт запись (`recording: true`, `phrase` ''), обработка (`recording: false`, `phrase` '…'), результат `items` с **одной** записью | `createSheetProps(item, s, clock)`: поля ТИП (ДЕЛО / ХОЧУ / СМОТРЕТЬ / ИДЕЯ / ТЕМА), ЧТО, КОГДА, КТО (`VoicePerson[]`), ГРУППА, НАПОМНИТЬ (`effectiveSpecs` → «ЗА 2 Ч») — только существующие у типа | `onCancel` → запись: `cancelRecording`; результат: `setCard(null)`; `onEdit` → задача: `setEditorSeed(item)` + `nav.taskEditor({})`, остальное — `setCard({ …, editing: true })` (старый `CardSheet`); `onSave` → `saveItems([item])`, переход на вкладку `TAB_FOR[type]`; `onClose` = отмена | Несколько записей в одной фразе — старый `CardSheet` (списком) |
| `AskDeleteSheet` (C-AskDelete) | `changes` из одной правки с `action: 'delete'` | `deleteSheetProps(change, s, clock)`: `task: VoiceTaskCard` (`tag` = `upper(repeatLabel)` у серии или `note`, `meta` «СБ 10 ОКТ · 10:00–11:30 · КАРИНА», `colors`); `onceLabel` «ТОЛЬКО 10 ОКТ», если есть `change.occ` (или `nextOpen` для серии без `occ`) | `onScopeChange` → локальное `scope`; `onDelete` → `applyChanges([scope === 'all' ? withoutOcc(change) : change])`; `onCancel`/`onClose` → `setCard(null)` | — |
| `AskMoveSheet` (C-AskMove) | одна правка `update` / `mark` / `unmark` | `moveSheetProps`: `changes: MoveChange[]` (КОГДА, КОНЕЦ, КТО, НАЗВАНИЕ, ПОВТОР — было → стало; `mark` → СТАТУС «НЕ СДЕЛАНО → СДЕЛАНО»), `conflicts` = `busyFor` нового времени и состава, `confirmLabel` «ПЕРЕНЕСТИ» / «СОХРАНИТЬ» / «ОТМЕТИТЬ» | `onConfirm` → `applyChanges([change])`; `onEdit` → задача: `setEditorSeed(применённый патч)` + `nav.taskEditor({ id })`; `onCancel` | Выбор среди `candidates` не показываем: берётся `chosen` (как и в макетах). Несколько правок — старый `CardSheet` |
| `AskAgendaSheet` (C-AskWeek, C-AskWeekend) | `plans` | `agendaSheetProps(answer, query, s, clock)`: дни периода (`AgendaDay.label` «ПН 05 · СЕГОДНЯ», `today`), строки = дела со временем и подзадачи; период ≤ 2 дней — многодневные и без времени строками «ВЕСЬ» (`multiDay`), длиннее — заметкой дня начала «КОМАНДИРОВКА → ПТ» (AUDIT-2 §4.6); `title` «05—11 ОКТ · МЫ С КАРИНОЙ» / «СБ 10 — ВС 11 ОКТ · САНЯ» (при `who` из одного человека — его имя); `count` «16 ДЕЛ»; `free` — только если `who` = один человек и период ≤ 3 дней: `freeWindows(busyEvents, who[0], …, FREE_OPTS)` → «СБ 18:30 → · ВС ДО 11:00 · СБ 12:00–15:00»; `openLabel` «ОТКРЫТЬ НЕДЕЛЮ» (≥ 3 дней) / «ОТКРЫТЬ ДЕНЬ» | `onOpen` → `selectGroup` (если секция одной другой группы), `setCalendarDate(from)`, `setTasksView('week' | 'day')`, `nav.tab('tasks')`, `setCard(null)`; `onClose` | `answerPlans` должен понимать `scope: 'me'`, `who` и многодневные дела (Ф — обязательно вместе с заголовком API 2, см. 3.4) |
| Ошибки (`problem`) — макета нет | `notUnderstood`, `silence`, `unknownPerson`, `notFound`, `offline`, `server`, `micDenied`, `info` (лимит, ошибки планов) | `VoiceSheet` (экспортирован из `screens/voice`) + одна строка текста: «Не понял», «Не расслышал», «Не нашёл человека «Х»», «Нет связи», текст лимита/ошибки | ЗАКРЫТЬ / ЕЩЁ РАЗ (`startRecording`); `micDenied` — ОТКРЫТЬ НАСТРОЙКИ (`Linking.openSettings`) | Без поясняющих подписей — только сама причина |

`queryWatch`, `queryWish`, `queryIdeas` — без окна, как сейчас (`applyResult` в `lib/voice.ts`): переход и фильтр.
Режим «удерживать» (`micMode = 'hold'`): у `BottomNav` есть только `onRec` → Ф добавляет `RecButtonContext` (см. 2.4).
После каждой команды — `setVoiceQuota` по полю `left` ответа (`/voice`, `/voice/text` его уже отдают).
Android «назад» при открытом окне закрывает окно (`BackHandler` в `VoiceHost`).

### 1.4. Списки (поток Г)

| Экран / пропсы | Данные | Колбэки → действия | Пробелы |
|---|---|---|---|
| `TasksListScreen` / `TasksListScreenProps` (C-List) | `tasksListProps(s, clock, collapsed)`: секции по `sectionFor` (`listInstances`): ПРОШЛО, СЕГОДНЯ, БЕЗ ДАТЫ, ЗАВТРА, НЕДЕЛЯ, ПОЗЖЕ (пустые не показываем); `date` «ПН 05» / «07—11»; `TaskItem.time` «09:30» / «—» / в НЕДЕЛЕ «СБ 15»; `owners` — 1–2 цвета `peopleOf`; план: `PlanItem` (`progress` «1/3», `range` «7—9», `color`, `steps` с `when` «СР 06») | `onChangeView('week')` → `setTasksView('week')`; `onToggleTask(key, done)` → `toggleTask(id, occ)`; `onOpenTask` → `nav.taskEditor`; `onOpenPlan` → `nav.planGrid`; `onAdd` → `nav.taskEditor({})`; `onPickGroup`; общие | Нет группы → `Redirect` на `/onboarding` |
| `WishesScreen` / `WishesScreenProps` (C-Wishes) | `wishesProps(s, colors, { personId, collapsed })`: `caption` «ВИШЛИСТЫ · 4 ЧЕЛОВЕКА» (я + люди всех групп), `people`, `selectedPersonId` (`s.wishPersonId ?? me.id`, или `ALL_PEOPLE`), `wishes` — без отметки (свои: нет `receivedAt`; чужие: нет `giftedBy` и `receivedAt`), `note` = заметка · домен ссылки, `gifted` — `from` «ОТ КАРИНЫ» (`genitive(giftedBy)`; нет `giftedBy` — «ПОЛУЧЕНО»), `wishesOpen`/`giftedOpen` из `collapsedSections` (`wishes.list`, `wishes.gifted`). id строки — `wishKey(w)` = `ownerId/id` | `onSelectPerson` → `setWishPerson`; `onToggleGift(key, g)` → свои: `setReceived(id, g)`, чужие: `giftWish(ownerId, id, g)` (ошибка → `notice`); снять чужой подарок может только подаривший (иначе no-op); `onOpenLink` → `Linking.openURL`; `onOpenWish` → свои: `setCard` с `WishDraft` (старый `CardSheet`), чужие — ничего; `onAdd` → `CardSheet` с пустой хотелкой; `onToggleSection` → `toggleSection` | Поля `giftedBy`/`giftedAt` (Ф), `giftWish` (Ф). Сервер < API 2 → `onToggleGift` для чужих не передаётся |
| `WatchScreen` / `WatchScreenProps` (C-Watch) | `watchProps(s, colors, ui)`: группа текущая; `filter` из `watchFilters.kind` (`[]` → `all`, `['movie']` → `movies`, `['series']` → `series`, иное — `all` + фильтры листа); `queue` (`meta` «ФИЛЬМ · ФАНТАСТИКА · ЗАРУБЕЖНОЕ», `year`, `addedByColor`), `watched` (`date` «28 СЕН»), секции `watch.queue`/`watch.watched` | `onChangeFilter` → `setWatchFilters({ ...f, kind })`; `onOpenFilters` → старый `FilterSheet`; `onToggleWatched` → `toggleWatched`; `onOpenItem` → `CardSheet` (правка); `onAdd` → `CardSheet` | — |
| `IdeasScreen` / `IdeasScreenProps` (C-Ideas) | `ideasProps(s, colors, clock, ui)`: `caption` «БЛОКНОТ · 31 ЗАПИСЬ», `people` (я + владельцы открытых мне тем), `topics` — без `archivedAt` (+ «Без темы» `INBOX` с `ownerColor: null`, если есть идеи без темы), `updated` = `relativeDay(lastActivity)`, `last` — текст последней идеи, `count` `pad2`, `shared` = `groupIds.length > 0`; `archive` — с `archivedAt` (`month` «СЕН») | `onToggleArchive(id, a)` → `archiveTopic(id, a)` (только свои; чужие — no-op); `onOpenTopic` → `nav.topic(id)` (старый экран темы); `onAddTopic` → `CardSheet` с `TopicDraft`; `onSelectPerson` → локальное состояние контейнера; `onToggleSection` | `Topic.archivedAt` (Ф), `archiveTopic` (Ф) |
| `ActivityScreen` / `ActivityScreenProps` (C-Activity) | `activityProps(s, colors, clock)`: дни (СЕГОДНЯ / ВЧЕРА / день недели полностью + «ПН 05»), `FeedEvent.text` = `activityText` (с правкой «перенёс(ла)», AUDIT-2 C-Activity), `time`, `group` (`upper(group.name)`), `fresh` — `id > activitySeen` на момент открытия; `caption` «ВСЕ ГРУППЫ · 30 ДНЕЙ» | При открытии `fetchActivity(true)`, при уходе `markActivitySeen()`; `onBack`; `onOpenEvent` → дело: редактор; хотелка/смотреть: вкладка | Правка `lib/activity.ts` (Г) |

### 1.5. Аккаунт (поток Г)

| Экран / пропсы | Данные | Колбэки → действия | Пробелы |
|---|---|---|---|
| `ProfileScreen` / `ProfileScreenProps` (C-Profile) | `profileProps(s, colors)`: `me` (`name`, `nick`, `email`, `gender`, `color`, `avatar`), `groups` (`memberCount`) | `onEditAvatar`/`onPickCustomColor` → `nav.avatar()` (старый экран); `onPickColor` → `setLook({ color })`; `onEditName`/`onEditNick`/`onEditGender` → `nav.profileEdit(field)` (старая форма, перенесённая в `app/settings/edit.tsx`); `onOpenGroup(id)` → `nav.group(id)`; `onCreateGroup` → `setGroupSheet(true)`; `onOpenAppSettings`; `onChangePassword` → `nav.profileEdit('password')`; `onLogout` / `onDeleteAccount` → `Alert` + `logout` / `deleteAccount` | — |
| `SettingsScreen` / `SettingsScreenProps` (C-Settings) | `settingsProps`: `theme`, `micMode`, `language` (`voiceLang`: `ru-RU`→`ru`, `en-US`→`en`, `auto`), `remindersOn`, `timedReminders`/`allDayReminders` (`specsSummary`), `voiceUsed`/`voiceLimit` из `s.voiceQuota` (нет — 0 / 30), `serverOnline` (`net === 'ok'`), `vpnOn` (`useVpnActive`), `version` «0.1.0 (1)» | `onChangeTheme` → `setTheme`; `onChangeMicMode` → `setMicMode`; `onChangeLanguage` → `setVoiceLang`; `onToggleReminders` → `setReminders({ enabled })`; `onEdit*Reminders` → `nav.reminders()` (старый экран); при фокусе `fetchVoiceQuota()` | `voiceLang`, `voiceQuota` (Ф). Адреса поддержки и политики неизвестны → колбэки не передаём |
| `GroupScreen` / `GroupScreenProps` (C-Group) | `groupProps(s, colors, groupId)`: `name`, `category`, `inviteCode`, `myRole`, `members` (`role` по `ownerId`/`adminIds`, `isMe`), `lists` (дела: открытые; хочу: хотелки участников без отметки; смотреть: без `watchedAt`; идеи: идеи тем с `groupIds ∋ group`) | `onRename` (если `canManageGroup`) → `InputSheet` → `renameGroup`; `onChangeCategory` → `setGroupCategory`; `onCopyCode` → `expo-clipboard` + `notice('Скопировано')`; `onShareCode` → `Share.share`; `onOpenMember` → `openMenu` (админ / исключить по `canRemoveMember`); `onOpenList(key)` → `selectGroup(id)` + `nav.tab`; `onLeave` → `Alert` + `leaveGroup` + `router.back()` | — |
| `CodeScreen` / `CodeScreenProps` (C-Code) | шаг `code` в `app/login.tsx`: `email`, `code`, `error`/`errorText`, `resendIn` (таймер `left`), `busy` | `onChangeCode` → `verifyCode` при полном коде; `onResend` → `sendCode`; `onLogin` → режим входа; `onBack` → шаг `email` | Остальные шаги входа — без макета, остаются старыми |

---

## 2. Навигация

### 2.1. Новое дерево `mobile-prod/app`

```
app/
  _layout.tsx                 корень: Stack без шапок; шрифты useFonts(uiFonts); тема; startSync, watchReminders, фоновая задача;
                              поверх Stack: UndoToast, PullIndicator, VoiceRecorder, VoiceHost, CardSheet, GroupSheet, ActionMenu
  index.tsx                   (как есть) → /login | /onboarding | /tasks
  login.tsx                   (старый; шаг кода → CodeScreen; кнопка VK скрыта в β)
  onboarding.tsx              (старый, без изменений)
  record.tsx                  (как есть) kstatiapp://record → /tasks + startRecording
  (tabs)/
    _layout.tsx               Tabs с tabBar={() => null}: BottomNav рисует каждый экран сам; Redirect на /login без me
    tasks/
      _layout.tsx             Stack (как есть)
      index.tsx               tasksView === 'list' ? <TasksListContainer/> : <CalendarContainer/>  (C-List / C-Day/Week/Month/Year)
      plan/[id].tsx           <PlanContainer id/>  (C-Plan)
    wishes.tsx                <WishesContainer/>  (C-Wishes)
    watch.tsx                 <WatchContainer/>   (C-Watch)
    ideas/
      _layout.tsx             Stack (как есть)
      index.tsx               <IdeasContainer/>   (C-Ideas)
      [id].tsx                старый экран темы (макета нет)
  edit/
    task/[id].tsx             <TaskEditorContainer id occ? date? time? parentId?/>  (id = 'new' для нового)  C-EditDate/Repeat/Remind/Who
    plan/[id].tsx             <PlanEditorContainer id field?/>                       C-EditPlan/Period/Year
  activity.tsx                <ActivityContainer/>  (C-Activity)
  group/[id].tsx              <GroupContainer id/>  (C-Group)
  settings/
    index.tsx                 <ProfileContainer/>   (C-Profile)
    app.tsx                   <SettingsContainer/>  (C-Settings)
    edit.tsx                  старая форма профиля (бывший settings/index.tsx): имя, ник, пол, пароль; ?field= фокусирует поле
    avatar.tsx                старый, без изменений
    reminders.tsx             старый, без изменений
```

Переходы между вкладками — `router.navigate('/tasks' | '/wishes' | '/watch' | '/ideas')` из `onNavigate`. Календарь не разбит на
маршруты: вид хранится в `s.tasksView` (`list | day | week | month | year`, по умолчанию `week`), выбранный день — `s.calendarDate`
(общий с голосом). Редакторы — экраны корневого Stack (`animation: 'slide_from_bottom'`), не листы.

### 2.2. Удаляется из `mobile-prod`

| Что | Почему |
|---|---|
| `app/(tabs)/tasks/[id].tsx` | заменён `tasks/plan/[id].tsx` и `edit/plan/[id].tsx` |
| `app/group.tsx` | заменён `app/group/[id].tsx` |
| содержимое `app/(tabs)/tasks/index.tsx`, `wishes.tsx`, `watch.tsx`, `ideas/index.tsx`, `activity.tsx`, `settings/app.tsx` | файлы переписываются в тонкие маршруты |
| `src/components/BottomBar.tsx`, `Calendar.tsx`, `CalendarStage.tsx`, `TimeGrid.tsx`, `NoGroup.tsx` | заменены `src/ui/BottomNav` и экранами календаря |
| `src/widget/*`, `modules/kstati-widget/`, регистрация `KstatiWidgetConfig` в `index.ts`, `watchWidget()` в `app/_layout.tsx`, плагин `expo-widgets` в `app.json`, `app.config.js` (он только выключал виджет) | виджет в β выключен (раздел 4) |

### 2.3. Остаётся (макета нет)

`app/login.tsx` (кроме шага кода), `app/onboarding.tsx`, `app/settings/avatar.tsx`, `app/settings/reminders.tsx`,
`app/settings/edit.tsx`, `app/(tabs)/ideas/[id].tsx`, `app/record.tsx`; компоненты `CardSheet` (+ `editors`, `TaskEditor`, `pickers`,
`RepeatPanel`, `ReminderEditor`, `TaskRow`, `Sheet`) — для хотелок, «Смотреть», идей, тем и голосовых ответов из нескольких записей;
`GroupSheet` (выбор/создание/вход в группу), `FilterSheet`, `TopicShareSheet`, `ActionMenu`, `UndoToast`, `PullRefresh`, `SwipeRow`,
`ListItem`, `Header` (`BackHeader`), `Avatar`, `Logo`, `CodeInput`, `PasswordMeter`, `VoiceRecorder`, `icons`, `ui`; `src/theme.ts` — для них.
`UndoToast` и `ideas/[id].tsx` переводятся на `useBottomSpace` из `src/containers/common/layout.ts`.

### 2.4. Правки `src/ui` (Ф)

- `BottomNav.tsx`: `export const RecButtonContext = createContext<{ onPressIn?(): void; onPressOut?(): void } | null>(null)`.
  Если контекст есть, `Pressable` REC вызывает `onPressIn/onPressOut` (режим «удерживать»: `holdStart`/`holdEnd`) и не вызывает
  `onRec`. В реестрах провайдера нет — рендер не меняется. Провайдер — в `app/_layout.tsx` по `s.micMode`.
- `InputSheet.tsx` (новый) + экспорт в `src/ui/index.ts`: `BottomSheet` + `TextInput` (Geist 15, рамка 1.5) + ОТМЕНА / СОХРАНИТЬ;
  пропсы `{ visible, value, multiline?, maxLength?, onSubmit(text), onClose }`. Для названия, описания, переименования группы.

---

## 3. API v2, типы, store, синхронизация (всё — Ф)

### 3.1. `src/lib/net.ts` (там живёт `request()`, в `api.ts` — только голос)

- Каждый запрос: `'x-kstati-api': '2'`, `'x-kstati-app': APP_ID` где
  `APP_ID = \`ru.kstati.app/${Constants.expoConfig?.version}(${build})\``, `build` = `Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? '0'` (`expo-constants` есть в зависимостях, `expo-application` — нет).
- `Op` += `{ op: 'wish.gift'; ownerId: ID; id: ID; gifted: boolean }`; `topic.put` → `topic: { id; title; groupIds; archivedAt?: string | null }`;
  `WishOp` += `giftedBy?: ID | null` (новый клиент его не шлёт, тип — для полноты).
- `opKey`: `wish.gift` → `gift:${ownerId}/${id}`.

### 3.2. `src/lib/api.ts`

- `uploadVoice` и `parseOnServer` возвращают и `left?: number`; `uploadVoice` шлёт `lang: s.voiceLang` (`/voice/text` — без языка).
- `fetchVoiceQuota(): Promise<{ limit; used; left } | null>` — `GET /voice/quota` с токеном; ошибка → `null`.
- `fetchHealth(): Promise<{ api: number } | null>` — `GET /health`.

### 3.3. `src/lib/types.ts`

```ts
export type Wish = { …; giftedBy?: ID; giftedAt?: string };          // у чужих — если подарил кто-то; у своих — только после receivedAt
export type Topic = { …; archivedAt?: string | null };               // null — локально «вернули из архива», чтобы ушло в op
export type ChangeDraft = { …; occ?: string };                       // раз серии из фразы (S3); относится к chosen
export type PlansScope = … | { kind: 'me' };                         // только при x-kstati-api: 2
export type PlansQuery = { scope; from; to; query; who?: ID[] };
export type Me = User & { email?: string | null; hasPassword?: boolean; vk?: boolean };   // перенос из store
export type VoiceLang = 'ru-RU' | 'en-US' | 'auto';
```

### 3.4. `src/lib/plans.ts` — обязательно в том же коммите, что и заголовок API 2

Сервер с `x-kstati-api: 2` начнёт присылать `scope: { kind: 'me' }`, а нынешний `resolveGroups` на незнакомом `kind` падает в ветку
`people` и даёт `TypeError` (server-changes-v2, «Совместимость»). Поэтому:
- `resolveGroups`: `me` → все мои группы.
- `answerPlans`: фильтр `who` (участие = `peopleOf`); попадание в период — пересечение `[date, lastDay]` с `[from, to]` через `daysOf`,
  а не `t.date ∈ период` (иначе теряется дело, начавшееся раньше).
- `PlansAnswer` += `who?: ID[]` (нужно окну выходных). Раскладка по дням — в адаптере потока В, `sections` по группам остаются.

### 3.5. `src/lib/store.ts`

Новое состояние: `calendarHidden: ID[]` (вместо `calendarPerson`, сохраняется), `voiceLang: VoiceLang` (`'ru-RU'`, сохраняется),
`voiceQuota: { limit; used; left } | null`, `serverApi: number | null`, `editorSeed: TaskDraft & { id?: ID } | null` (три последних не сохраняются).
`version: 3`, `migrate`: убрать `calendarPerson`. Новые ключи `collapsedSections`: `wishes.list`, `wishes.gifted`, `watch.queue`,
`watch.watched`, `ideas.topics`, `ideas.archive` (по умолчанию открыты).

Действия (полный список: в параллельной фазе `store.ts` заморожен):

| Действие | Что делает |
|---|---|
| `saveItems` | **без `shiftChildren`** (DECISIONS: перенос плана не двигает подзадачи); функцию `shiftChildren` удалить |
| `applyChanges(changes)` | без `shiftChildren`; учитывает `occ` у серии: `delete` + `occ` → `skipDates`; `mark/unmark` + `occ` → `toggleOcc(t, occ)`; `update` + `occ` → `skipDates ∋ occ` и новое дело-копия на `patch.date ?? occ` без повтора (`keepDuration`, `cleanEnd`). Без `occ` — вся серия, как сейчас. «Все повторы» — вызывающий убирает `occ` |
| `giftWish(ownerId, id, gifted): Promise<string \| null>` | сразу `POST /ops` (не через очередь: отказ `already_gifted`/`forbidden` надо показать); оптимистично `giftedBy = me`, `giftedAt = now` (или снять), при отказе откат; тексты: `already_gifted` → «Уже подарили», `forbidden` → «Нельзя», нет связи → `errorText` |
| `setReceived(id, received)` | своя хотелка: `receivedAt = now / null` (= нынешний `toggleWish`, явно) |
| `archiveTopic(id, archived)` | своя тема: `archivedAt = now / null` |
| `toggleCalendarPerson(id)`, `setVoiceLang`, `setVoiceQuota`, `setServerApi`, `setEditorSeed` | сеттеры |

### 3.6. `src/lib/sync.ts`

- `topicOp`: `...(t.archivedAt !== undefined && { archivedAt: t.archivedAt })` — поле уходит, только если его трогали.
- `wishOp` без изменений (`giftedBy` владелец не шлёт — сервер хранит скрытую отметку сам).
- `pendingScopes`: `wish.gift` → `owners.add(o.ownerId)`; запасная ветка `'id' in o` больше не ловит `wish.gift`.
- `startSync` → `checkServer()`: `fetchHealth` → `setServerApi(api)`; если `api < 2` — один раз `notice('Сервер устарел')`, контейнеры
  не передают колбэки подарков и архива.
- `pull` ничего нового не делает: `giftedBy`/`giftedAt`/`archivedAt` проходят как есть.

### 3.7. `src/lib/voice.ts` (поток В)

`applyResult`: `setVoiceQuota` по `left`; `items` с одной записью и `changes` с одной правкой остаются в `s.card` (их рисует `VoiceHost`);
`router.navigate` — через `nav.*`. `CardSheet` пропускает карточки, которые рисует `VoiceHost` (одна запись, одна правка, `plans`, `problem`).

---

## 4. `app.json` / `app.config.js` / шрифты

Уже есть и остаётся: `name` «Кстати β», `slug` `kstati-prod`, `scheme` `kstatiapp` (у старого `kstati`), `ios.bundleIdentifier` и
`android.package` `ru.kstati.app`. Изменения (Ф):

- Добавить `"ios": { "buildNumber": "1" }`, `"android": { "versionCode": 1 }` — для `x-kstati-app` и строки версии в настройках.
- Виджет **выключен**: убрать плагин `expo-widgets` из `plugins`, удалить `app.config.js`, `src/widget/*`, `modules/kstati-widget/`,
  блок `KstatiWidgetConfig` в `index.ts`, `watchWidget` в `app/_layout.tsx`. Группа `group.ru.kstati.app` и
  `ru.kstati.app.widgets` уже свои — при возврате виджета конфликта со старым приложением не будет.
- Шрифты: `@expo-google-fonts/geist` ^0.4.2 и `@expo-google-fonts/geist-mono` ^0.4.3 есть в `package.json`. В `app/_layout.tsx`
  `useFonts(uiFonts)` из `src/ui/fonts.ts` (Geist 400/500/600/700, Mono 400/500/600) вместо нынешних четырёх начертаний —
  старые экраны используют подмножество.
- Остальное без изменений: `expo-audio` (микрофон), `expo-notifications`, `expo-background-task`, `withWorkManagerFix`,
  `withoutPushEntitlement`, `withIpv4First`, `usesCleartextTraffic`.
- На Mac (здесь npm недоступен): `npm uninstall expo-widgets @expo/ui` и `npx expo prebuild --clean` — чтобы lock и нативные
  проекты не тянули виджет.

---

## 5. Порядок работ и потоки

### 5.0. Ф — общая основа (первым, один исполнитель)

**Файлы:** `src/lib/types.ts`, `net.ts`, `api.ts`, `store.ts`, `sync.ts`, `plans.ts` (только 3.4), `colors.ts` + новый `personColors.ts`;
`src/adapters/snapshot.ts`, `src/adapters/common/*` (+ тесты); `src/containers/common/*`; `src/ui/BottomNav.tsx`, `src/ui/InputSheet.tsx`,
`src/ui/index.ts`; `src/components/UndoToast.tsx`, `app/(tabs)/ideas/[id].tsx` (только импорт `useBottomSpace`); **все маршруты** из 2.1,
кроме `login.tsx` и `settings/edit.tsx`; `index.ts`, `app.json`, удаления из 2.2; `scripts/test.sh`, `scripts/typecheck-lite.sh`, `scripts/shims/*`.

**Задачи:**
1. Разделы 3.1–3.6 и 4.
2. Скелет навигации: маршруты из 2.1 и **заглушки контейнеров** (`export function XContainer() { return null; }`) по путям
   из раздела 5.1–5.4 — дальше эти файлы принадлежат потокам.
3. Общие хелперы 0.3–0.4 с тестами (`genitive`, `relativeDay`, `whenLabel`, `parseKey`, `instancesIn` с многодневными, `busyFor`, `colorMap`).
4. `RecButtonContext`, `InputSheet`, `useBottomSpace`; удаление `BottomBar`, `Calendar`, `CalendarStage`, `TimeGrid`, `NoGroup`, виджета.

**Приёмка:** все 6 реестров прогнаны, цифры не хуже нынешних (`BottomNav` проверяется через C-List, C-Wishes, C-Day);
`scripts/test.sh` зелёный; `typecheck-lite.sh` без ошибок; `grep -r "components/BottomBar\|components/Calendar\|TimeGrid\|@/widget" mobile-prod/app mobile-prod/src` пусто;
в `store.ts` нет `shiftChildren`. Приложение собирается на Mac и показывает пустые экраны с работающей навигацией.

После Ф файлы Ф **заморожены**. Нужна правка в них — заявка владельцу Ф, правка в коротком последовательном окне между слияниями.

### 5.1. Поток А — календарь и план

**Файлы:** `src/adapters/calendar/{events,day,week,month,year,plan}.ts` + `*.test.ts`;
`src/containers/calendar/{CalendarContainer,DayContainer,WeekContainer,MonthContainer,YearContainer,PlanContainer}.tsx`.

**Задачи:** таблица 1.1. `CalendarContainer` выбирает вид по `s.tasksView`. Мемоизация: `instancesIn` по (`tasks`, группа, период).
`setVoiceParent` в `PlanContainer`.

**Приёмка:** `node design/harness/run.mjs mobile-prod/design-registry.calendar.tsx` ≤ 2% (сейчас ≤ 0.27%); тесты адаптеров:
`Snapshot`, собранный из данных макетов, даёт `events`/`bars`/`items`/`plans` фикстур `fixtures/calendar/*` (id и порядок, `fromPrevDay`,
`parentTitle`, скрытые люди, повторы как `id@occ`, план только полосой). На устройстве: переключение ДЕНЬ/НЕДЕЛЯ/МЕСЯЦ/ГОД и СПИСОК;
‹ › и СЕГОДНЯ; вкладки людей; линия «сейчас» сдвигается через минуту; тап по делу открывает редактор, по плану — C-Plan;
REC внутри C-Plan создаёт подзадачу; год листается без задержки > 300 мс на 300 делах.

### 5.2. Поток Б — окна редактирования

**Файлы:** `src/adapters/editors/{draft,taskEditor,planEditor,panels,labels}.ts` + тесты;
`src/containers/editors/{TaskEditorContainer,PlanEditorContainer,useEditorState}.tsx`; правка (только необязательный `onEditTitle`)
`src/screens/editors/TaskEditorScreen.tsx`, `PlanEditorScreen.tsx`, `components/EditorScaffold.tsx`.

**Задачи:** таблица 1.2. Новое дело из «+», из календаря (дата дня), подзадача (`parentId`), из голоса (`editorSeed`, потом `setEditorSeed(null)`).
Шаг колеса — 5 минут. «Для меня / для всех» → `mine` / `shared`. Снимок «ВСЕ В ГРУППЕ» = `people: group.memberIds` (AUDIT-2 S11 не делаем).

**Приёмка:** `design-registry.editors.tsx` ≤ 2% (все 7 состояний) — в том числе после добавления `onEditTitle`; тесты: `reduceDraft`
(конец едет за началом, `moveStart` у плана, подзадачи не двигаются, повтор без даты сбрасывается), `planEditorProps` даёт «ВНЕ ПЕРИОДА»
для подзадачи вне периода, `whoPanel` — «ЗАНЯТА 19:00–20:00 · ЙОГА». На устройстве: колесо (инерция, щелчок на каждом шаге), раскрыта
только одна строка, клавиатура не закрывает InputSheet, «назад» без сохранения ничего не меняет, удаление серии «этот раз / все»,
напоминание «для меня» не уходит другим участникам (проверить на втором телефоне).

### 5.3. Поток В — голос

**Файлы:** `src/adapters/voice/{header,create,change,agenda,free,problem}.ts` + тесты; `src/containers/voice/{VoiceHost,useLevelHistory}.tsx`;
`src/lib/voice.ts`; `src/components/CardSheet.tsx` (только пропуск карточек, которые рисует `VoiceHost`); `src/lib/mockParser.ts`
(демо-режим: `occ` и `scope 'me'` для фраз из макетов — по желанию).

**Задачи:** таблица 1.3 и 3.7. «Свободно» — только через `freeWindows` с `FREE_OPTS`.

**Приёмка:** `design-registry.voice.tsx` ≤ 2%; тесты: `agendaSheetProps` на данных макета даёт дни и заметки C-AskWeek («КОМАНДИРОВКА → ПТ»,
«16 ДЕЛ») и строки «ВЕСЬ» C-AskWeekend; многодневное дело, начавшееся до периода, попадает в ответ; `free` для выходных с окном 09:00–22:00
и порогом 60 мин (данные макета не согласованы — AUDIT-2 §4.7: тест проверяет правило, а не строку макета); `deleteSheetProps` с `occ`.
На устройстве (сервер API 2): «В субботу в семь ужин у родителей» → сохранить; «Удали йогу в субботу» → только этот раз → в календаре
пропал один раз; «Перенеси стоматолога на пятницу на два и добавь Карину» → предупреждения о занятости; «Что у нас на этой неделе?» →
ОТКРЫТЬ НЕДЕЛЮ; «Что я делаю на выходных?» → «Свободно» и ОТКРЫТЬ ДЕНЬ; режим «удерживать»; отказ микрофона; авиарежим → «Нет связи»;
лимит → текст лимита; счётчик в настройках уменьшился; виджетная ссылка `kstatiapp://record` начинает запись.

### 5.4. Поток Г — списки и аккаунт

**Файлы:** `src/adapters/lists/{tasksList,wishes,watch,ideas,activity}.ts`, `src/adapters/account/{profile,settings,group}.ts` + тесты;
`src/containers/lists/{TasksListContainer,WishesContainer,WatchContainer,IdeasContainer,ActivityContainer}.tsx`,
`src/containers/account/{ProfileContainer,SettingsContainer,GroupContainer}.tsx`; `app/login.tsx`; `app/settings/edit.tsx` (перенос старой формы
профиля, `?field=`); `src/lib/activity.ts` («перенёс(ла)»); `src/lib/ideas.ts` (пункт «В архив» в меню темы — по желанию).

**Задачи:** таблицы 1.4–1.5. В `login.tsx` шаг `code` рисует `CodeScreen`, кнопка VK скрыта (раздел 6, п. 2).

**Приёмка:** `design-registry.tsx` (C-Wishes), `design-registry.lists.tsx`, `design-registry.account.tsx` ≤ 2%; тесты: `wishesProps`
(сюрприз: своя хотелка, подаренная Кариной, остаётся в «Хочу», пока я не отметил получение; после — «ОТ КАРИНЫ»; чужая подаренная — в «Подарено»),
`ideasProps` (архив отдельно, «Без темы» серой полосой), `tasksListProps` (план со шагами, «1/3», «7—9»), `groupProps` (счётчики), `genitive`.
На устройстве: подарок чужой хотелки со второго аккаунта — владелец не видит до «получил»; одновременный подарок двумя людьми → второму «Уже подарили»;
архив темы и возврат; старое приложение (`mobile/`) после этого переименовывает тему и правит хотелку — архив и «от кого» не стёрлись;
регистрация по коду из письма и повторная отправка через 60 с; копирование и отправка кода приглашения; выход и удаление аккаунта.

### 5.5. Слияние

Потоки А–Г не пересекаются по файлам и сливаются в любом порядке. После всех — общий проход (владелец Ф): все реестры, `test.sh`,
`typecheck-lite.sh`; на Mac `npm run typecheck`, `npx expo run:android` и `run:ios`; дымовой прогон на устройстве: вход → онбординг →
по одному сценарию на экран; оба приложения на одном телефоне (разные иконки и имена, `kstati://` и `kstatiapp://` открывают каждое своё,
двойные напоминания допустимы — DECISIONS).

---

## 6. Риски и открытые вопросы

Блокирующих разработку вопросов нет. Ниже — что выбрано по умолчанию.

1. **Нативный код модулей не в репозитории (блокирует только сборку Android).** В `modules/kstati-net` и `modules/kstati-widget` есть
   только `index.ts` и `expo-module.config.json`. Kotlin-классы (`expo.modules.kstatinet.KstatiNetModule`) не закоммичены, видимо, их
   отрезал `.gitignore` на Mac. Автолинковка сошлётся на отсутствующий класс, и сборка упадёт. По умолчанию: `kstati-widget` удаляется
   (раздел 4). Для `kstati-net` на Mac скопировать `mobile/modules/kstati-net/android` в `mobile-prod/modules/kstati-net/`. Если папки нет,
   удалить модуль, а `vpnOn` будет всегда `false`.
2. **Вход через VK в β.** У сервера одна схема `APP_SCHEME=kstati`. Пункт «несколько схем» пропущен по решению (server-changes-v2, S8),
   поэтому в проде `/auth/vk/start` ответит `bad_redirect` на `kstatiapp://auth`. По умолчанию кнопка VK в β скрыта, вход только по почте.
   Включить можно серверной правкой со списком схем; для старого приложения она обратно совместима.
3. **Без tsc в контейнере.** Ошибки контейнеров найдутся только на Mac. Защита: типизированные адаптеры (`DataOf<…>`),
   `typecheck-lite` по адаптерам и экранам, приёмка каждого потока на Mac через `npm run typecheck`.
4. **Старый `CardSheet` для хотелок, «Смотреть», идей и составных голосовых ответов.** Он визуально выбивается из нового стиля, зато
   принят как временный: макетов для этих окон нет.
5. **Сервер ниже API 2.** Подарки и архив не сохранятся: старый zod молча срежет поля. Поэтому проверяется `/health` (3.6), и при
   `api < 2` эти действия выключаются.
6. **Определения по умолчанию.** Год считает дела, а не дни. Уровень дня: `0.35 + 0.5·min(1, n/4)`. «Свободно»: 09:00–22:00, окна от 60 мин,
   только для одного человека и периода не длиннее 3 дней. Изменение открытого раза серии в редакторе меняет всю серию. Среди
   `candidates` голосовой правки берётся `chosen`. У плана повтора нет. «ВСЕ В ГРУППЕ» — снимок участников. Ссылки поддержки и политики
   не показываются, пока владелец не даст адреса.
7. **Данные телефона.** У β своя песочница: файл `kstati-state.json` не пересекается со старым приложением. Новые поля берутся из
   начального состояния при слиянии `persist`, версия 3 убирает `calendarPerson`.
