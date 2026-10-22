/**
 * Лента активности: как записать событие по-человечески.
 * «Карина добавила дело «Баня» на сб 4 окт · 15:00», «Саша отметил «Баня» (сб 4 окт)», «перенесла «Йога» на пн 5 окт · 19:00».
 */
import { shortDate, taskWhen } from './dates';
import { pastEnd, type Activity, type User } from './types';

const FIELD: Record<string, string> = {
  title: 'название',
  date: 'дату',
  time: 'время',
  note: 'описание',
  repeat: 'повтор',
  reminders: 'общие напоминания',
  end: 'длительность',
  people: 'кто участвует',
};

const q = (s?: string) => `«${s ?? '—'}»`;

/** Правка только даты, времени или длительности — это перенос */
const MOVE_FIELDS = new Set(['date', 'time', 'end']);

/** «перенёс» / «перенесла» / «перенёс(ла)»: у глагола беглая «ё» — окончание pastEnd не подходит */
const moved = (u?: Pick<User, 'gender'> | null) => (u?.gender === 'f' ? 'перенесла' : u?.gender === 'm' ? 'перенёс' : 'перенёс(ла)');

/** Действие без имени: «добавила дело «Баня» на сб 4 окт» */
export function activityText(e: Activity, actor: User | undefined, users: User[]): string {
  const end = pastEnd(actor);
  const v = (stem: string) => `${stem}${end}`;
  const when = e.date ? taskWhen(e.date, e.time ?? null) : '';
  switch (e.kind) {
    case 'task.add':
      return `${v('добавил')} дело ${q(e.title)}${when ? ` на ${when}` : ''}`;
    case 'task.done':
      return `${v('отметил')} ${q(e.title)}${e.date ? ` (${shortDate(e.date)})` : ''}`;
    case 'task.undone':
      return `${v('снял')} отметку с ${q(e.title)}`;
    case 'task.edit': {
      if (e.fields?.length && e.fields.every((x) => MOVE_FIELDS.has(x)) && when) return `${moved(actor)} ${q(e.title)} на ${when}`;
      const f = (e.fields ?? []).map((x) => FIELD[x]).filter(Boolean);
      return `${v('изменил')} ${q(e.title)}${f.length ? `: ${f.join(', ')}` : ''}${e.fields?.some((x) => x === 'date' || x === 'time') && when ? ` → ${when}` : ''}`;
    }
    case 'task.delete':
      return e.fields?.includes('occurrence') ? `${v('удалил')} один раз ${q(e.title)} (${e.date ? shortDate(e.date) : ''})` : `${v('удалил')} дело ${q(e.title)}`;
    case 'watch.add':
      return `${v('добавил')} в «Смотреть» ${q(e.title)}`;
    case 'watch.done':
      return `${v('посмотрел')} ${q(e.title)}`;
    case 'watch.delete':
      return `${v('удалил')} из «Смотреть» ${q(e.title)}`;
    case 'wish.add':
      return `${v('добавил')} в «Хочу» ${q(e.title)}`;
    case 'wish.done':
      return `${v('отметил')} хотелку ${q(e.title)} как подаренную`;
    case 'wish.delete':
      return `${v('удалил')} хотелку ${q(e.title)}`;
    case 'member.join':
      return `${v('вступил')} в группу`;
    case 'member.leave':
      return actor?.gender === 'f' ? 'вышла из группы' : actor?.gender === 'm' ? 'вышел из группы' : 'вышел(а) из группы';
    case 'member.remove':
      return `${v('исключил')} ${users.find((u) => u.id === e.target)?.name ?? 'участника'}`;
    case 'group.rename':
      return `${v('переименовал')} группу в ${q(e.title)}`;
    case 'topic.share':
      return `${v('открыл')} тему ${q(e.title)} группе`;
  }
}
