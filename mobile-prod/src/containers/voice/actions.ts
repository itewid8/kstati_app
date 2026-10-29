/**
 * Действия голосовых окон: сохранить, применить правку, открыть редактор или календарь.
 * Окно закрывается до изменения данных — иначе на миг его подхватил бы CardSheet (запись стала дубликатом, дело пропало).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { emptyDraft } from '@/components/CardSheet';
import { openMenu } from '@/components/ActionMenu';
import { deleteChange, editItem, editSeed, occOfChange } from '@/adapters/voice/change';
import type { AgendaSheetData } from '@/adapters/voice/agenda';
import type { Snapshot } from '@/adapters/snapshot';
import type { DeleteScope } from '@/screens/voice';
import { track } from '@/lib/analytics';
import type { PlansAnswer } from '@/lib/plans';
import { useStore } from '@/lib/store';
import { INBOX, type ChangeDraft, type DraftItem, type ID, type ItemType } from '@/lib/types';
import { TAB_FOR, beginRecording, cancelVoice } from '@/lib/voice';
import { toPlanGrid, toTabRoute, toTopic } from '../common/go';
import { nav } from '../common/nav';

const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

export const closeCard = () => useStore.getState().setCard(null);

/** Закрыть всё голосовое: запись или разбор — отменить, окно ссылки или ответа — закрыть (автомат adapters/voice/recording) */
export const closeVoice = () => cancelVoice();

export const retryVoice = () => void beginRecording();

export function openMicSettings() {
  closeCard();
  Linking.openSettings().catch(() => {});
}

/** Тема первой из только что созданных идей (куда перейти после сохранения); не идея — null */
export function createdIdeaTopic(created: readonly ID[]): ID | null {
  const idea = useStore.getState().ideas.find((x) => created.includes(x.id));
  return idea ? (idea.topicId ?? INBOX) : null;
}

/** Дело и «Смотреть» живут в группе: без неё запись не сохранилась — говорим об этом в том же окне, а не закрываем молча */
function showNoGroup(transcript: string) {
  useStore.getState().setCard({ source: 'voice', transcript, problem: 'info', query: 'Нет группы' });
}

/** C-Voice «Сохранить»: запись → вкладка её типа (идея — в тему, подзадача — в план) */
export function saveVoiceItem(item: DraftItem, transcript = '') {
  const s = useStore.getState();
  s.setCard(null);
  const created = s.saveItems([item]);
  if (!created.length) return showNoGroup(transcript);
  track('save', { type: item.type, source: 'voice' });
  success();
  if (item.type === 'idea') toTopic(createdIdeaTopic(created) ?? INBOX);
  else if (item.type === 'task' && item.data.parentId) toPlanGrid(item.data.parentId);
  else toTabRoute(TAB_FOR[item.type]);
}

/** C-Voice «Изменить»: дело — полный редактор с черновиком, остальное — старое окно правки */
export function editVoiceItem(item: DraftItem, transcript: string) {
  const s = useStore.getState();
  if (item.type !== 'task') {
    s.setCard({ source: 'voice', transcript, items: [item], editing: true });
    return;
  }
  s.setCard(null);
  s.setEditorSeed({ ...item.data, ...(item.id ? { id: item.id } : null) });
  router.push(nav.taskEditor({}));
}

/** C-AskDelete «Удалить»: этот раз или вся серия */
export function applyDelete(change: ChangeDraft, scope: DeleteScope, occ: string | null) {
  const s = useStore.getState();
  s.setCard(null);
  s.applyChanges([deleteChange(change, scope, occ)]);
  success();
  toTabRoute(TAB_FOR[change.type]);
}

/** C-AskMove: перенести / сохранить / отметить */
export function applyMove(change: ChangeDraft) {
  const s = useStore.getState();
  s.setCard(null);
  s.applyChanges([change]);
  success();
  toTabRoute(TAB_FOR[change.type]);
}

/**
 * C-AskMove «Изменить». Дело: правка всей серии или обычного дела — редактор с применённой правкой (назад — ничего не меняет);
 * перенос одного раза серии — раз отделяется (как «Перенести») и открывается уже он. Отметка — редактор этого дела.
 * Хотелка, «Смотреть», идея — старое окно правки
 */
export function editChange(change: ChangeDraft, s: Snapshot) {
  const store = useStore.getState();
  if (change.type !== 'task') {
    const item = editItem(change, s);
    store.setCard(item ? { source: 'edit', items: [item], editing: true } : null);
    return;
  }
  const occ = occOfChange(change, s);
  if (change.action !== 'update') {
    store.setCard(null);
    router.push(nav.taskEditor({ id: change.chosen, ...(occ ? { occ } : null) }));
    return;
  }
  if (occ) {
    const before = new Set(store.tasks.map((t) => t.id));
    store.setCard(null);
    store.applyChanges([change]);
    const moved = useStore.getState().tasks.find((t) => !before.has(t.id));
    router.push(nav.taskEditor({ id: moved?.id ?? change.chosen }));
    return;
  }
  const seed = editSeed(change, s);
  store.setCard(null);
  if (seed) store.setEditorSeed(seed);
  router.push(nav.taskEditor({ id: change.chosen }));
}

/** C-AskWeek / C-AskWeekend «Открыть неделю / день» */
export function openAgenda(answer: PlansAnswer, data: Pick<AgendaSheetData, 'groupId' | 'view'>) {
  const s = useStore.getState();
  s.setCard(null);
  if (data.groupId) s.selectGroup(data.groupId);
  s.setCalendarDate(answer.from);
  s.setTasksView(data.view);
  toTabRoute(nav.tab('tasks'));
}

/** Что можно добавить вручную из окна ошибки: дело, хотелку, фильм, идею (как «Не понял → добавить как…» в старом окне) */
const ADD_AS: ReadonlyArray<{ type: ItemType; label: string }> = [
  { type: 'task', label: 'Дело' },
  { type: 'wish', label: 'Хотелку' },
  { type: 'watch', label: 'Фильм или сериал' },
  { type: 'idea', label: 'Заметку' },
];

/** Новая запись с готовым названием: дело — полный редактор (черновик через editorSeed), остальное — старое окно правки */
function addManually(type: ItemType, title: string) {
  const s = useStore.getState();
  s.setCard(null);
  if (type === 'task') {
    s.setEditorSeed({ title, date: null, time: null });
    router.push(nav.taskEditor({}));
    return;
  }
  s.setCard({ source: 'manual', items: [emptyDraft(type, title)], editing: true });
}

/** Окно ошибки «ДОБАВИТЬ»: выбор типа записи; title — сказанное (или то, что не нашлось) */
export function openAddMenu(menuTitle: string, title: string) {
  openMenu({ title: menuTitle, actions: ADD_AS.map(({ type, label }) => ({ label, onPress: () => addManually(type, title) })) });
}
