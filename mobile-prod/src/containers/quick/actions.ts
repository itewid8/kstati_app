/**
 * Действия окна быстрых действий: плитки, ряд «ПЕРЕНЕСТИ» / «В ТЕМУ», УДАЛИТЬ. Сначала окно закрывается, потом —
 * действие хранилища, переход или следующее окно (меню удаления серии, старая карточка правки).
 * Что меняет списки без своей отмены (перенос, копия, «в дела», тема), получает «ОТМЕНИТЬ» в нижнем сообщении.
 */
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { shiftDay } from '@/adapters/calendar/events';
import { wishKey } from '@/adapters/lists/wishes';
import {
  NO_TOPIC,
  giftTaskTitle,
  isMoveKey,
  moveChange,
  moveToDate,
  splitIdea,
  taskCopy,
  undatedTask,
  type QuickIdeaView,
  type QuickTaskView,
  type QuickView,
  type QuickWatchView,
  type QuickWishView,
} from '@/adapters/quick';
import type { IsoDate } from '@/lib/calendarLayout';
import { taskWhen } from '@/lib/dates';
import { syncParent } from '@/lib/edits';
import { uid } from '@/lib/ids';
import { instance } from '@/lib/recur';
import { useStore } from '@/lib/store';
import type { ChangePatch, ID, Task, TaskDraft } from '@/lib/types';
import { captureList, isEmptyUndo, revertList, type ListUndo } from '@/lib/undo';
import type { QuickTileKey } from '@/screens/quick';
import { toPlanGrid } from '../common/go';
import { nav } from '../common/nav';
import { openItem } from '../lists/WatchContainer';
import { openWish } from '../lists/WishesContainer';
import { closeQuickActions } from './quickStore';

/** Раз серии, который переносят на выбранный день (окно даты в хосте) */
export type DatePick = { id: ID; occ: IsoDate };

type Lists = Pick<ReturnType<typeof useStore.getState>, 'tasks' | 'wishes' | 'watch' | 'ideas'>;
type Plan = { [K in keyof Lists]: ListUndo<Lists[K][number]> };

/** Выполнить правку и предложить «ОТМЕНИТЬ»: откатываются только затронутые записи (чужие правки остаются) */
const withUndo = (label: string, run: () => void): void => {
  const before = useStore.getState();
  run();
  const after = useStore.getState();
  const plan: Plan = {
    tasks: captureList(before.tasks, after.tasks),
    wishes: captureList(before.wishes, after.wishes),
    watch: captureList(before.watch, after.watch),
    ideas: captureList(before.ideas, after.ideas),
  };
  if (isEmptyUndo(plan.tasks) && isEmptyUndo(plan.wishes) && isEmptyUndo(plan.watch) && isEmptyUndo(plan.ideas)) return;
  const restore = () => {
    const cur = useStore.getState();
    useStore.setState({
      tasks: revertList(cur.tasks, plan.tasks),
      wishes: revertList(cur.wishes, plan.wishes),
      watch: revertList(cur.watch, plan.watch),
      ideas: revertList(cur.ideas, plan.ideas),
      undo: null,
    });
  };
  useStore.setState({ undo: { label, at: Date.now(), restore } });
};

/** Новое дело без даты в текущей группе; групп нет — сообщение */
const addTask = (data: TaskDraft): void => {
  withUndo('Добавлено в дела', () => {
    const saved = useStore.getState().saveItems([{ key: uid(), type: 'task', data }]);
    if (!saved.length) useStore.getState().notice('Нет группы');
  });
};

/* ---------- Дело ---------- */

const moveTask = (v: Pick<QuickTaskView, 'task' | 'occ'>, patch: ChangePatch): void => {
  const when = taskWhen(patch.date ?? null, patch.time ?? null);
  withUndo(when ? `Перенесено · ${when}` : 'Перенесено', () => useStore.getState().applyChanges([moveChange(v.task, v.occ, patch)]));
};

const taskTile = (v: QuickTaskView, key: QuickTileKey): void => {
  const st = useStore.getState();
  const { task, occ } = v;
  switch (key) {
    case 'done':
      return st.toggleTask(task.id, occ ?? undefined);
    case 'edit':
      // План правится в окне плана (период, подзадачи)
      if (v.planId === task.id) return void router.push(nav.planEditor(task.id));
      return void router.push(nav.taskEditor(occ ? { id: task.id, occ } : { id: task.id }));
    case 'plan':
      // Как «Сделать планом» в окне дела: окно плана, поверх — новая подзадача
      router.push(nav.planEditor(task.id));
      return void router.push(nav.taskEditor({ parentId: task.id, date: task.date }));
    case 'openPlan':
      if (v.planId) toPlanGrid(v.planId);
      return;
    case 'remind':
      // Чужое дело: окно дела только с моими напоминаниями
      return void router.push(nav.taskEditor({ ...(occ ? { id: task.id, occ } : { id: task.id }), field: 'remind' }));
    case 'copy': {
      const me = st.me;
      if (!me) return;
      const copy: Task = taskCopy(task, { id: uid(), meId: me.id, now: new Date().toISOString() });
      // Копия подзадачи — в том же плане: план снова не сделан, если копия не отмечена
      return withUndo('Копия создана', () => useStore.setState({ tasks: syncParent([...useStore.getState().tasks, copy], copy.parentId) }));
    }
    default:
      return;
  }
};

/** ДАТА…: у раза серии — окно даты (переносится только этот раз), у плана — его период, иначе окно дела с раскрытой датой */
const taskSegment = (v: QuickTaskView, key: string): DatePick | null => {
  if (!isMoveKey(key)) return null;
  if (key === 'date') {
    if (v.occ) return { id: v.task.id, occ: v.occ };
    if (v.planId === v.task.id) router.push(nav.planEditor(v.task.id, 'period'));
    else router.push(nav.taskEditor({ id: v.task.id, field: 'when' }));
    return null;
  }
  const patch = v.moves[key];
  if (patch) moveTask(v, patch);
  return null;
};

/** Выбран день в окне даты: раз серии — на этот день, время прежнее */
export const moveOccurrence = (pick: DatePick, date: IsoDate): void => {
  const st = useStore.getState();
  const task = st.tasks.find((t) => t.id === pick.id);
  if (!task) return;
  const patch = moveToDate(instance(task, pick.occ), date);
  if (patch) moveTask({ task, occ: pick.occ }, patch);
};

/** Серия — спросить, как в окне дела: только этот раз / этот и все следующие / все повторы */
const deleteTask = (v: QuickTaskView): void => {
  const st = useStore.getState();
  const { task, occ } = v;
  if (!occ) return st.deleteTask(task.id);
  st.setMenu({
    title: `Удалить «${task.title}»?`,
    actions: [
      { label: 'Только этот раз', danger: true, onPress: () => useStore.getState().deleteTask(task.id, occ) },
      { label: 'Этот и все следующие', danger: true, onPress: () => useStore.getState().endSeries(task.id, shiftDay(occ, -1)) },
      { label: 'Все повторы', danger: true, onPress: () => useStore.getState().deleteTask(task.id) },
    ],
  });
};

/* ---------- Хотелка, «Смотреть», идея ---------- */

const wishTile = (v: QuickWishView, key: QuickTileKey): void => {
  const st = useStore.getState();
  const { wish } = v;
  switch (key) {
    case 'gift':
      void st.giftWish(wish.ownerId, wish.id, true).then((err) => {
        if (err) useStore.getState().notice(err);
      });
      return;
    case 'received':
      return withUndo('Получено', () => useStore.getState().setReceived(wish.id, true));
    case 'link':
      if (v.link) Linking.openURL(v.link).catch(() => {});
      return;
    case 'toTask':
      return addTask(undatedTask(giftTaskTitle(wish.title), v.link ?? ''));
    case 'edit':
      return openWish(wishKey(wish));
    default:
      return;
  }
};

const watchTile = (v: QuickWatchView, key: QuickTileKey): void => {
  const { item } = v;
  switch (key) {
    case 'watched':
      return withUndo(item.watchedAt ? 'Снова в очереди' : 'Посмотрели', () => useStore.getState().toggleWatched(item.id));
    case 'edit':
      return openItem(item.id);
    case 'toTask':
      return addTask(undatedTask(item.title));
    default:
      return;
  }
};

/** Идея в другую тему или «Без темы» (как правка в карточке идеи) */
const moveIdea = (v: QuickIdeaView, key: string): void => {
  const st = useStore.getState();
  const topicId = key === NO_TOPIC ? null : key;
  const topic = topicId ? st.topics.find((t) => t.id === topicId) : undefined;
  if (topicId && !topic) return;
  const { idea } = v;
  withUndo(topic ? `Перенесено в «${topic.title}»` : 'Перенесено в «Без темы»', () =>
    useStore.getState().saveItems([{ key: idea.id, id: idea.id, type: 'idea', data: { title: idea.text, topicId, newTopic: null } }]),
  );
};

const ideaTile = (v: QuickIdeaView, key: QuickTileKey): void => {
  const { idea, own } = v;
  switch (key) {
    case 'edit':
      if (own) router.push(nav.note(idea.id));
      return;
    case 'toTask': {
      const { title, note } = splitIdea(idea.text);
      return addTask(undatedTask(title, note));
    }
    case 'copy':
      // Чужая идея копируется к себе «Без темы»
      return withUndo('Копия создана', () =>
        useStore.getState().saveItems([{ key: uid(), type: 'idea', data: { title: idea.text, topicId: own ? idea.topicId : null, newTopic: null } }]),
      );
    default:
      return;
  }
};

/* ---------- Вход из хоста ---------- */

export const runTile = (v: QuickView, key: QuickTileKey): void => {
  closeQuickActions();
  if (v.kind === 'task') taskTile(v, key);
  else if (v.kind === 'wish') wishTile(v, key);
  else if (v.kind === 'watch') watchTile(v, key);
  else ideaTile(v, key);
};

/** Ряд под плитками. Вернёт раз серии, если нужно окно даты */
export const runSegment = (v: QuickView, key: string): DatePick | null => {
  closeQuickActions();
  if (v.kind === 'task') return taskSegment(v, key);
  if (v.kind === 'idea' && v.own) moveIdea(v, key);
  return null;
};

export const runDelete = (v: QuickView): void => {
  closeQuickActions();
  const st = useStore.getState();
  if (v.kind === 'task') deleteTask(v);
  else if (v.kind === 'wish') {
    if (v.own) st.deleteWish(v.wish.id);
  } else if (v.kind === 'watch') st.deleteWatch(v.item.id);
  else if (v.own) st.deleteIdea(v.idea.id);
};
