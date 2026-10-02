// Те же типы, что в приложении (mobile/src/lib/types.ts, mockParser.ts) — формат ответа общий.

/** Записи, которые голос может менять. Идеи — только перенос в другую тему и удаление */
export type ItemType = 'task' | 'wish' | 'watch' | 'idea';
export type Kind = 'movie' | 'series' | 'cartoon' | 'show' | 'standup';
export type Genre =
  | 'comedy' | 'drama' | 'action' | 'thriller' | 'horror'
  | 'scifi' | 'detective' | 'romance' | 'adventure' | 'documentary';
export type Origin = 'ru' | 'foreign';
export type Freshness = 'new' | 'old';

export const KINDS: Kind[] = ['movie', 'series', 'cartoon', 'show', 'standup'];
export const GENRES: Genre[] = ['comedy', 'drama', 'action', 'thriller', 'horror', 'scifi', 'detective', 'romance', 'adventure', 'documentary'];
export const ORIGINS: Origin[] = ['ru', 'foreign'];

import type { Repeat } from './repeat.js';

/**
 * Дело. Конец: endTime — время окончания, endDate — дата окончания, если не в тот же день (многодневное).
 * people — кто занят (id участников группы); нет — автор. parentId — дело, внутри плана которого это подзадача.
 */
export type TaskDraft = {
  title: string;
  date: string | null;
  time: string | null;
  note: string;
  repeat?: Repeat | null;
  endDate?: string | null;
  endTime?: string | null;
  people?: string[];
  parentId?: string | null;
};
export type WishDraft = { title: string; note: string; link: string };
export type WatchDraft = { title: string; kind: Kind | null; genres: Genre[]; origin: Origin | null; year: number | null };

/** Идея: title — её текст; тема — существующая (topicId) или новая (newTopic, создастся при сохранении); обе null — «Без темы» */
export type IdeaDraft = { title: string; topicId: string | null; newTopic: string | null };
export type TopicDraft = { title: string };

export type DraftItem =
  | { key: string; type: 'task'; data: TaskDraft }
  | { key: string; type: 'wish'; data: WishDraft }
  | { key: string; type: 'watch'; data: WatchDraft }
  | { key: string; type: 'idea'; data: IdeaDraft }
  | { key: string; type: 'topic'; data: TopicDraft };

export type ChangeAction = 'update' | 'mark' | 'unmark' | 'delete';
export type ChangeDraft = {
  key: string;
  action: ChangeAction;
  type: ItemType;
  candidates: string[];
  chosen: string;
  patch?: Partial<{
    title: string;
    date: string | null;
    time: string | null;
    repeat: Repeat | null;
    endDate: string | null;
    endTime: string | null;
    people: string[];
    topicId: string | null;
    newTopic: string | null;
  }>;
};

export type GroupCategory = 'couple' | 'family' | 'parents' | 'friends' | 'other';
export const CATEGORIES: GroupCategory[] = ['couple', 'family', 'parents', 'friends', 'other'];

export type PlansScope =
  | { kind: 'us' }
  | { kind: 'current' }
  | { kind: 'category'; category: GroupCategory }
  | { kind: 'groups'; names: string[] }
  | { kind: 'people'; names: string[] };
export type PlansQuery = { scope: PlansScope; from: string; to: string; query: string };

export type WatchFilters = { kind: Kind[]; genre: Genre[]; origin: Origin[]; fresh: Freshness[] };

export type ParseResult =
  | { type: 'items'; items: DraftItem[] }
  | { type: 'queryWatch'; filters: WatchFilters }
  | { type: 'queryWish'; personId: string }
  | { type: 'unknownPerson'; name: string }
  | { type: 'changes'; changes: ChangeDraft[] }
  | { type: 'notFound'; query: string }
  | { type: 'queryPlans'; plans: PlansQuery }
  /** «Покажи идеи для подарков»: тема (id), 'inbox' — «Без темы», null — список тем */
  | { type: 'queryIdeas'; topicId: string | null }
  | { type: 'unknown' };

/** Контекст запроса. Пока нет базы — приходит от приложения; потом сервер будет собирать его сам. */
export type Context = {
  today: string; // YYYY-MM-DD по времени телефона
  now: string; // HH:MM
  me: { id: string; name: string };
  people: { id: string; name: string }[];
  /** Мои группы с категориями — для вопросов о планах */
  groups?: { name: string; category: GroupCategory }[];
  existing: {
    tasks: {
      id: string;
      title: string;
      date: string | null;
      time: string | null;
      done?: boolean;
      endDate?: string | null;
      endTime?: string | null;
      /** Имена участников дела */
      people?: string[];
      parentId?: string | null;
    }[];
    watch: { id: string; title: string; done?: boolean }[];
    wishes: { id: string; title: string; done?: boolean }[];
    /** Мои идеи (последние): для переноса и удаления голосом */
    ideas?: { id: string; text: string; topicId: string | null }[];
  };
  /** Мои темы идей */
  topics?: { id: string; title: string }[];
  /** Тема, открытая на экране: идея без названной темы идёт в неё */
  currentTopicId?: string | null;
  /** Участники текущей группы (id) — для «мы», «у нас» */
  groupMembers?: string[];
  /** План (большое дело), открытый на экране: новое дело без названного плана становится его подзадачей */
  currentParentId?: string | null;
};
