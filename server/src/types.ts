// Те же типы, что в приложении (mobile/src/lib/types.ts, mockParser.ts) — формат ответа общий.

export type ItemType = 'task' | 'wish' | 'watch';
export type Kind = 'movie' | 'series' | 'cartoon' | 'show' | 'standup';
export type Genre =
  | 'comedy' | 'drama' | 'action' | 'thriller' | 'horror'
  | 'scifi' | 'detective' | 'romance' | 'adventure' | 'documentary';
export type Origin = 'ru' | 'foreign';
export type Freshness = 'new' | 'old';

export const KINDS: Kind[] = ['movie', 'series', 'cartoon', 'show', 'standup'];
export const GENRES: Genre[] = ['comedy', 'drama', 'action', 'thriller', 'horror', 'scifi', 'detective', 'romance', 'adventure', 'documentary'];
export const ORIGINS: Origin[] = ['ru', 'foreign'];

export type TaskDraft = { title: string; date: string | null; time: string | null; note: string };
export type WishDraft = { title: string; note: string; link: string };
export type WatchDraft = { title: string; kind: Kind | null; genres: Genre[]; origin: Origin | null; year: number | null };

export type DraftItem =
  | { key: string; type: 'task'; data: TaskDraft }
  | { key: string; type: 'wish'; data: WishDraft }
  | { key: string; type: 'watch'; data: WatchDraft };

export type ChangeAction = 'update' | 'mark' | 'unmark' | 'delete';
export type ChangeDraft = {
  key: string;
  action: ChangeAction;
  type: ItemType;
  candidates: string[];
  chosen: string;
  patch?: Partial<{ title: string; date: string | null; time: string | null }>;
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
    tasks: { id: string; title: string; date: string | null; time: string | null; done?: boolean }[];
    watch: { id: string; title: string; done?: boolean }[];
    wishes: { id: string; title: string; done?: boolean }[];
  };
};
