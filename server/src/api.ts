/**
 * Данные приложения: синхронизация и изменения.
 *
 * POST /sync — телефон присылает, какие ревизии групп и людей у него есть;
 *   сервер отвечает списком групп и людей и полностью отдаёт дела/«Смотреть» только тех групп
 *   и хотелки только тех людей, где ревизия поменялась. Данных у пары мало — так проще и надёжнее.
 *   Идеи (темы и записи) — так же по ревизиям людей: свои целиком, чужие — только темы, открытые нашим общим группам.
 * POST /ops — пачка изменений по порядку (офлайн-очередь телефона). id записей придумывает телефон,
 *   поэтому повтор той же операции безопасен.
 * Все права проверяются здесь: телефону доверять нельзя.
 */
import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, meView, requireUser } from './auth.js';
import { apiLevel } from './client.js';
import { lookupFilm, type FilmDeps, type FilmLookup } from './films.js';
import { giftrev, grev, irev, migrated, PERSON_COLORS, publicUser, TASK_KINDS, trev, urev, type Activity, type Group, type Idea, type Item, type Note, type Store, type Task, type Topic, type User, type WatchItem, type Wish } from './store/index.js';
import { CATEGORIES } from './types.js';
import { ownerPart, PERSONAL, visibleIn } from './visibility.js';

const NICK_RULE = /^[A-Za-zА-Яа-яЁё0-9_.]{3,20}$/;
const nickKey = (n: string) => `nick#${n.toLowerCase().replace(/ё/g, 'е')}`;

const canManage = (g: Group, uid: string) => g.ownerId === uid || g.adminIds.includes(uid);
const canRemove = (g: Group, uid: string, target: string) => {
  if (target === uid || target === g.ownerId) return false;
  if (g.ownerId === uid) return true;
  return g.adminIds.includes(uid) && !g.adminIds.includes(target);
};
/** Группа глазами участника: код приглашения видят только создатель и админы, остальным — пустая строка */
const groupView = (g: Group, uid: string): Group => (canManage(g, uid) ? g : { ...g, inviteCode: '' });

const Id = z.string().min(1).max(64);
const Date10 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const Time5 = z.string().regex(/^\d{2}:\d{2}$/).nullable();
const Stamp = z.string().max(40).nullable();

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Повтор дела — см. mobile-prod/src/lib/types.ts (Repeat) */
const RepeatIn = z.object({
  freq: z.enum(['day', 'week', 'month', 'year']),
  every: z.number().int().min(1).max(99),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  monthDays: z.array(z.number().int().min(-1).max(31)).max(32).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  until: Day.nullable().optional(),
  count: z.number().int().min(1).max(999).nullable().optional(),
});
/** Напоминание: «m90», «d1@20:00», «M1@20:00» */
const Spec = z.string().regex(/^(m\d{1,4}|[dM]\d{1,3}@\d{2}:\d{2})$/);

const TaskIn = z.object({
  id: Id,
  /** Группа, где создали; «@me» — личный календарь (API 3) */
  groupId: Id,
  /** Чьё дело (API 3): для чужого — владелец; нет — моё или ищется по группе (старое приложение) */
  ownerId: Id.optional(),
  /** «Только я» и отметки по группам — меняет только владелец (API 3) */
  only: z.boolean().optional(),
  share: z.record(Id, z.boolean()).refine((r) => Object.keys(r).length <= 100).optional(),
  title: z.string().trim().min(1).max(200),
  date: Date10,
  time: Time5,
  note: z.string().max(2000).optional(),
  doneAt: Stamp,
  repeat: RepeatIn.nullable().optional(),
  doneDates: z.array(Day).max(400).optional(),
  skipDates: z.array(Day).max(400).optional(),
  reminders: z.array(Spec).max(10).nullable().optional(),
  endDate: Date10.optional(),
  endTime: Time5.optional(),
  people: z.array(Id).max(50).optional(),
  parentId: Id.nullable().optional(),
  /** Тип дела: обычное, день рождения, важный день, путешествие. Нет поля — как было (старое приложение) */
  kind: z.enum(TASK_KINDS).optional(),
  /** Именинник: участник группы или имя; null — убрать; нет поля — как было */
  celebrant: z.object({ id: Id.optional(), name: z.string().trim().min(1).max(80) }).nullable().optional(),
  /** Откуда перенесено (календарь телефона): календарь, событие, отпечаток содержимого; null — убрать; нет поля — как было */
  ext: z.object({ cal: z.string().max(200), id: z.string().max(200), h: z.string().max(64) }).nullable().optional(),
});
const WatchIn = z.object({
  id: Id,
  groupId: Id,
  title: z.string().trim().min(1).max(200),
  kind: z.string().max(20).nullable(),
  genres: z.array(z.string().max(20)).max(5),
  origin: z.string().max(20).nullable(),
  year: z.number().int().min(1880).max(2100).nullable(),
  watchedAt: Stamp,
});
const WishIn = z.object({
  id: Id,
  title: z.string().trim().min(1).max(200),
  note: z.string().max(1000),
  link: z.string().max(1000),
  receivedAt: Stamp,
  /**
   * S1: от кого подарок — владелец указывает, когда сам отмечает «получил». Нет поля — не трогать (старое приложение),
   * null — убрать. Пока хотелка не получена, поле от владельца не принимается: он не видит чужую отметку и не должен её стереть
   */
  giftedBy: Id.nullable().optional(),
});

/** Тема идей: название и группы, которым она открыта (только чтение) */
const TopicIn = z.object({
  id: Id,
  title: z.string().trim().min(1).max(80),
  groupIds: z.array(Id).max(20),
  /** S2: в архиве с этого момента; null — вернуть из архива; нет поля — не трогать (старое приложение) */
  archivedAt: Stamp.optional(),
  /** Тема — сама заметка: её текст (строки с разметкой, как у заметки). Нет поля — не трогать (старое приложение) */
  body: z.string().max(20000).optional(),
});
/** Идея (заметка внутри темы): текст и тема (null — «Без темы») */
const IdeaIn = z.object({
  id: Id,
  topicId: Id.nullable(),
  text: z.string().trim().min(1).max(20000),
});

const Op = z.discriminatedUnion('op', [
  z.object({ op: z.literal('task.put'), task: TaskIn }),
  z.object({ op: z.literal('watch.put'), watch: WatchIn }),
  z.object({ op: z.literal('item.delete'), groupId: Id, id: Id, ownerId: Id.optional() }),
  z.object({ op: z.literal('wish.put'), wish: WishIn }),
  z.object({ op: z.literal('wish.delete'), id: Id }),
  // S1: отметить чужую хотелку подаренной (или снять свою отметку). Владельцу не видно до его «получил»
  z.object({ op: z.literal('wish.gift'), ownerId: Id, id: Id, gifted: z.boolean() }),
  z.object({ op: z.literal('topic.put'), topic: TopicIn }),
  z.object({ op: z.literal('topic.delete'), id: Id }),
  z.object({ op: z.literal('idea.put'), idea: IdeaIn }),
  z.object({ op: z.literal('idea.delete'), id: Id }),
  z.object({ op: z.literal('group.create'), group: z.object({ id: Id, name: z.string().trim().min(1).max(40), category: z.enum(CATEGORIES as [string, ...string[]]) }) }),
  z.object({ op: z.literal('group.update'), id: Id, name: z.string().trim().min(1).max(40).optional(), category: z.enum(CATEGORIES as [string, ...string[]]).optional() }),
  z.object({ op: z.literal('group.join'), code: z.string().trim().min(4).max(12) }),
  z.object({ op: z.literal('group.leave'), id: Id }),
  z.object({ op: z.literal('group.admin'), id: Id, userId: Id, admin: z.boolean() }),
  z.object({ op: z.literal('group.remove'), id: Id, userId: Id }),
  // Мой режим в группе (API 3): true — «Только выбранные», false — «Все, кроме скрытых»
  z.object({ op: z.literal('group.mode'), id: Id, selectOnly: z.boolean() }),
  // Личные напоминания: настройки по умолчанию и напоминания для отдельных дел (null — убрать своё)
  z.object({
    op: z.literal('prefs'),
    reminders: z.object({ enabled: z.boolean(), timed: z.array(Spec).max(10), allDay: z.array(Spec).max(10) }).optional(),
    overrides: z.record(Id, z.array(Spec).max(10).nullable()).optional(),
  }),
  z.object({
    op: z.literal('profile'),
    name: z.string().trim().min(1).max(40).optional(),
    nick: z.string().trim().max(20).nullable().optional(),
    gender: z.enum(['m', 'f']).nullable().optional(),
    color: z
      .union([z.enum(PERSON_COLORS), z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((v) => v.toLowerCase() as `#${string}`)])
      .nullable()
      .optional(),
    // Буква или эмодзи (эмодзи бывает из нескольких символов, например флаг или семья)
    avatar: z.string().trim().max(16).nullable().optional(),
  }),
]);
export type OpIn = z.infer<typeof Op>;

/** Какие поля дела поменялись (для ленты: «изменил(а) дату») */
function taskChanges(a: Task, b: Task): string[] {
  const norm = (t: Task) => ({
    title: t.title,
    date: t.date ?? null,
    time: t.time ?? null,
    note: t.note ?? '',
    repeat: JSON.stringify(t.repeat ?? null),
    reminders: JSON.stringify(t.reminders ?? null),
    end: `${t.endDate ?? ''} ${t.endTime ?? ''}`,
    people: [...(t.people ?? [])].sort().join(','),
  });
  const x = norm(a);
  const y = norm(b);
  return (Object.keys(x) as (keyof typeof x)[]).filter((k) => x[k] !== y[k]);
}

/**
 * Хотелка глазами viewer (S1).
 * Владелец: пока сам не отметил «получил», не видит, что её подарили и кто (сюрприз) — полей giftedBy/giftedAt нет вовсе.
 * Остальные видят всё. Старому приложению (api 1) подарок показываем через receivedAt — других полей оно не знает,
 * а чужие хотелки оно не отправляет на сервер, так что это ничего не перезапишет.
 */
export function wishView(w: Wish, viewerId: string, api: number): Wish {
  const { giftedBy, giftedAt, ...rest } = w;
  if (w.ownerId === viewerId) return w.receivedAt ? w : rest;
  if (!giftedBy && !giftedAt) return w;
  if (api < 2 && !w.receivedAt) return { ...w, receivedAt: giftedAt ?? w.updatedAt };
  return w;
}

/** Поля фильма из ПоискКино поверх записи: пустые год, жанры, вид и страна заполняются, свои — остаются */
function withFilm(
  w: { year: number | null; genres: string[]; kind: string | null; origin: string | null },
  { film, suggest }: FilmLookup,
  now: string,
): Partial<WatchItem> {
  return {
    ...(film && {
      year: w.year ?? film.year,
      genres: w.genres.length ? w.genres : film.genres,
      kind: w.kind ?? film.kind,
      origin: w.origin ?? film.origin,
    }),
    rating: film?.rating ?? null,
    kpId: film?.kpId ?? null,
    description: film?.description ?? '',
    suggestion: suggest,
    kpAt: now,
  };
}

/** Название не меняли — данные фильма как были */
const keepFilm = (p: WatchItem): Partial<WatchItem> => ({
  rating: p.rating ?? null,
  kpId: p.kpId ?? null,
  ...(p.description !== undefined && { description: p.description }),
  suggestion: p.suggestion ?? null,
  ...(p.kpAt && { kpAt: p.kpAt }),
});

export class Data {
  constructor(
    private store: Store,
    private films: FilmDeps = {},
  ) {}

  /** Запись в ленту активности. Ошибка ленты не должна ломать саму правку */
  private async log(user: User, a: Omit<Activity, 'id' | 'at' | 'actor'>) {
    await this.logTo(user, [a.scope], a);
  }

  /** Одна запись в несколько лент (дело видно нескольким группам) — с одним id: activity() не покажет её дважды */
  private async logTo(user: User, scopes: string[], a: Omit<Activity, 'id' | 'at' | 'actor' | 'scope'> & { scope?: string }) {
    if (!scopes.length) return;
    const at = new Date().toISOString();
    const id = `${at}#${randomInt(1_000_000).toString(36)}`;
    for (const scope of scopes) {
      try {
        await this.store.addActivity({ ...a, scope, ...(scope !== a.scope && !scope.startsWith('u:') && { groupId: scope }), actor: user.id, at, id });
      } catch (e) {
        console.warn('Лента активности:', (e as Error).message);
      }
    }
  }

  /**
   * Лента для человека: события в его группах и хотелки соучастников. Свои действия не показываем.
   * api 1: подарок (wish.done от дарителя в ленте хотелок владельца, S1) отдаём от имени владельца — старое приложение
   * считает автора wish.* владельцем хотелки («Маша отметила хотелку как подаренную» и переход к хотелкам Маши)
   */
  async activity(user: User, since: string, api = 1) {
    const s = this.store;
    const groups = (await s.getGroups(await s.listMemberships(user.id))).filter((g) => g.memberIds.includes(user.id));
    const people = [...new Set(groups.flatMap((g) => g.memberIds))].filter((id) => id !== user.id);
    const scopes = [...groups.map((g) => g.id), ...people.map((id) => `u:${id}`)];
    const lists = await Promise.all(
      scopes.map((sc) =>
        s.listActivity(sc, since, 60).catch((e) => {
          console.warn('Лента активности:', (e as Error).message);
          return [] as Activity[];
        }),
      ),
    );
    const seen = new Set<string>();
    const events = lists
      .flat()
      .filter((a) => a.actor !== user.id && !seen.has(a.id) && !!seen.add(a.id))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 150);
    if (api >= 2) return { events };
    const giftOwner = (a: Activity) => (a.kind === 'wish.done' && a.scope.startsWith('u:') && a.scope.slice(2) !== a.actor ? a.scope.slice(2) : null);
    return { events: events.map((a) => (giftOwner(a) ? { ...a, actor: giftOwner(a)! } : a)) };
  }

  /**
   * Есть ли у двух людей общая группа. Читаем только группы, общие по спискам членства, и по 20 за раз до первой
   * подходящей: wish.gift и wish.put зовут это на каждую операцию (до 200 в /ops), а групп у человека может быть
   * сколько угодно — чтение всех его групп на операцию давало ×200 обращений к базе (docs/security/REVIEW-v2.md, V2-3)
   */
  private async shareGroup(a: string, b: string): Promise<boolean> {
    const [ma, mb] = await Promise.all([this.store.listMemberships(a), this.store.listMemberships(b)]);
    const theirs = new Set(mb);
    const common = [...new Set(ma)].filter((g) => theirs.has(g));
    for (let i = 0; i < common.length; i += 20) {
      const groups = await this.store.getGroups(common.slice(i, i + 20));
      if (groups.some((g) => g.memberIds.includes(a) && g.memberIds.includes(b))) return true;
    }
    return false;
  }

  private async memberGroup(user: User, groupId: string): Promise<Group> {
    const g = await this.store.getGroup(groupId);
    if (!g || !g.memberIds.includes(user.id)) throw new HttpError(403, 'not_member', 'Нет доступа к группе');
    return g;
  }

  /** avoid — прежний код группы: он тоже указывает на неё, claimKey его «займёт», а он вот-вот будет удалён */
  private async newInviteCode(groupId: string, avoid?: string): Promise<string> {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 6 }, () => abc[randomInt(abc.length)]).join('');
      if (code !== avoid && (await this.store.claimKey(`invite#${code}`, groupId))) return code;
    }
    throw new Error('Не удалось придумать код приглашения');
  }

  /**
   * Удалить участника из группы; последний ушёл — группа удаляется целиком.
   * rotateInvite — исключили не по своей воле: старый код он знает, поэтому группе выдаётся новый,
   * а старый перестаёт работать (иначе исключённый сразу вернётся через group.join)
   */
  private async dropMember(g: Group, userId: string, removeTheirItems: boolean, rotateInvite = false) {
    g.memberIds = g.memberIds.filter((m) => m !== userId);
    g.adminIds = g.adminIds.filter((m) => m !== userId);
    await this.store.removeMembership(userId, g.id);
    if (!g.memberIds.length) {
      await this.store.deleteKey(`invite#${g.inviteCode}`);
      await this.store.deleteGroup(g.id);
      return;
    }
    if (g.ownerId === userId) g.ownerId = g.adminIds[0] ?? g.memberIds[0];
    g.adminIds = g.adminIds.filter((m) => m !== g.ownerId);
    if (removeTheirItems) {
      // Дела человека лежат в его личном календаре — из группы они пропадают сами (visibility.ts); «Смотреть» — удаляем
      for (const it of await this.store.listItems(g.id)) if (it.type === 'watch' && it.addedBy === userId) await this.store.deleteItem(g.id, it.id);
    }
    if (rotateInvite) {
      const oldCode = g.inviteCode;
      g.inviteCode = await this.newInviteCode(g.id, oldCode);
      await this.store.deleteKey(`invite#${oldCode}`);
    }
    await this.store.putGroup(g);
    await this.store.incr(grev(g.id));
  }

  /* ---------- личный календарь (API 3, visibility.ts) ---------- */

  /** Группы, где человек состоит */
  private async groupsOf(userId: string): Promise<Group[]> {
    return (await this.store.getGroups(await this.store.listMemberships(userId))).filter((g) => g.memberIds.includes(userId));
  }

  /** Дела человека (его раздел) */
  private async ownerTasks(userId: string): Promise<Task[]> {
    return (await this.store.listItems(ownerPart(userId))).filter((t): t is Task => t.type === 'task');
  }

  /**
   * Старые дела лежали в разделе группы. Один раз на группу переносим их владельцам: видно по-прежнему только
   * этой группе (в остальных группах владельца — отметка «скрыть», чтобы режим «Все» ничего не открыл)
   */
  private async ensureMigrated(groups: Group[]) {
    if (!groups.length) return;
    const done = await this.store.getCounters(groups.map((g) => migrated(g.id)));
    for (const g of groups) {
      if (done[migrated(g.id)]) continue;
      const owners = new Set<string>();
      for (const it of await this.store.listItems(g.id)) {
        if (it.type !== 'task') continue;
        const owner = it.createdBy;
        const theirs = await this.store.listMemberships(owner);
        const share = Object.fromEntries(theirs.map((gid) => [gid, gid === g.id]));
        share[g.id] = true;
        if (!(await this.store.getItem(ownerPart(owner), it.id))) await this.store.putItem({ ...it, groupId: ownerPart(owner), home: g.id, share });
        await this.store.deleteItem(g.id, it.id);
        owners.add(owner);
      }
      for (const o of owners) await this.store.incr(trev(o));
      await this.store.incr(migrated(g.id));
    }
  }

  /**
   * Дело по id. ownerId известен (API 3) — сразу в его разделе; иначе (старое приложение) — моё,
   * а потом дела участников группы groupId
   */
  private async findTask(user: User, id: string, ownerId: string | undefined, groupId: string): Promise<Task | null> {
    const get = async (uid: string) => {
      const it = await this.store.getItem(ownerPart(uid), id);
      return it?.type === 'task' ? it : null;
    };
    if (ownerId) return get(ownerId);
    const mine = await get(user.id);
    if (mine || groupId === PERSONAL) return mine;
    const g = await this.store.getGroup(groupId);
    if (!g?.memberIds.includes(user.id)) return null;
    await this.ensureMigrated([g]);
    for (const m of g.memberIds) {
      if (m === user.id) continue;
      const t = await get(m);
      if (t) return t;
    }
    return null;
  }

  /** Права на чужое дело: владелец; админ группы, где оно видно; просто участник такой группы (только «сделано») */
  private async roleFor(user: User, t: Task): Promise<'owner' | 'admin' | 'member' | null> {
    if (t.createdBy === user.id) return 'owner';
    const shared = (await this.groupsOf(user.id)).filter((g) => visibleIn(t, g));
    if (shared.some((g) => canManage(g, user.id))) return 'admin';
    return shared.length ? 'member' : null;
  }

  /** Дела владельца поменялись: его ревизия и ревизии всех его групп (их участники заберут новое) */
  private async bumpOwner(owner: string, groups: Group[]) {
    await this.store.incr(trev(owner));
    for (const g of groups) await this.store.incr(grev(g.id));
  }

  /** Лента: что поменялось в деле */
  private async logTaskChanges(user: User, old: Task, t: Task, scopes: string[]) {
    const base = { itemId: t.id, title: t.title, date: t.date, time: t.time };
    if (!old.doneAt && t.doneAt) await this.logTo(user, scopes, { ...base, kind: 'task.done' });
    if (old.doneAt && !t.doneAt) await this.logTo(user, scopes, { ...base, kind: 'task.undone' });
    // Повторы: отметки отдельных раз и удаление одного раза
    const had = new Set(old.doneDates ?? []);
    const has = new Set(t.doneDates ?? []);
    for (const d of has) if (!had.has(d)) await this.logTo(user, scopes, { ...base, date: d, kind: 'task.done' });
    for (const d of had) if (!has.has(d) && d >= new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10)) await this.logTo(user, scopes, { ...base, date: d, kind: 'task.undone' });
    const skipped = (t.skipDates ?? []).filter((d) => !(old.skipDates ?? []).includes(d));
    for (const d of skipped) await this.logTo(user, scopes, { ...base, date: d, kind: 'task.delete', fields: ['occurrence'] });
    const fields = taskChanges(old, t);
    if (fields.length) await this.logTo(user, scopes, { ...base, kind: 'task.edit', fields });
  }

  /**
   * Все дела, которые видит человек: свои (все) и чужие, видные хотя бы одной общей группе.
   * in — в каких из его групп дело видно
   */
  private async visibleTasks(user: User, mine: Group[]): Promise<{ task: Task; in: string[] }[]> {
    const people = [...new Set([user.id, ...mine.flatMap((g) => g.memberIds)])];
    const lists = await Promise.all(people.map((id) => this.ownerTasks(id)));
    const out: { task: Task; in: string[] }[] = [];
    people.forEach((id, i) => {
      for (const t of lists[i]) {
        const groups = mine.filter((g) => visibleIn(t, g)).map((g) => g.id);
        if (id === user.id || groups.length) out.push({ task: t, in: groups });
      }
    });
    return out;
  }

  /**
   * Дело глазами человека. API 3: groupId — где создано («@me» — личное), in — его группы, где видно;
   * чужим — без отметок видимости (кому ещё владелец показал или скрыл — не их дело).
   * Старое приложение: одна группа (где создано, если видно там) — оно знает только дела групп
   */
  private taskView(t: Task, inGroups: string[], viewer: string, api: number): Task | null {
    const { home, only, share, ext, ...rest } = t;
    if (api < 3) {
      const g = home && inGroups.includes(home) ? home : inGroups[0];
      return g ? { ...rest, groupId: g } : null;
    }
    if (t.createdBy === viewer) return { ...rest, groupId: home ?? PERSONAL, ...(only && { only }), ...(share && { share }), ...(ext && { ext }), in: inGroups } as Task;
    return { ...rest, groupId: inGroups[0] ?? PERSONAL, in: inGroups } as Task;
  }

  /** Записи группы для голосового разбора: «Смотреть», дела, видные группе, и все мои */
  async groupItems(user: User, groupId: string): Promise<Item[]> {
    const mine = await this.groupsOf(user.id);
    await this.ensureMigrated(mine);
    const [watch, tasks] = await Promise.all([this.store.listItems(groupId), this.visibleTasks(user, mine)]);
    return [
      ...watch.filter((w) => w.type === 'watch'),
      ...tasks.filter((x) => x.in.includes(groupId) || x.task.createdBy === user.id).map((x) => ({ ...x.task, groupId })),
    ];
  }

  async apply(user: User, op: OpIn, api = 1): Promise<unknown> {
    const now = new Date().toISOString();
    const s = this.store;
    switch (op.op) {
      case 'task.put': {
        const inT = op.task;
        const personal = inT.groupId === PERSONAL;
        const old = await this.findTask(user, inT.id, inT.ownerId, inT.groupId);
        if (!old) {
          // Новое дело — всегда своё; из группы — только если я в ней
          if (inT.ownerId && inT.ownerId !== user.id) throw new HttpError(403, 'forbidden', 'Дело не найдено');
          if (!personal) await this.memberGroup(user, inT.groupId);
        }
        const role = old ? await this.roleFor(user, old) : 'owner';
        if (!role) throw new HttpError(403, 'forbidden', 'Нет доступа к делу');
        const owner = old?.createdBy ?? user.id;
        const ownerGroups = await this.groupsOf(owner);
        const visibleBefore = old ? ownerGroups.filter((g) => visibleIn(old, g)).map((g) => g.id) : [];
        if (role === 'member') {
          // Участник группы (не админ) может только отметить «сделано»: остальное берём как было
          const t: Task = { ...old!, doneAt: inT.doneAt, doneDates: inT.doneDates ?? old!.doneDates, updatedAt: now };
          await s.putItem(t);
          await this.bumpOwner(owner, ownerGroups);
          await this.logTaskChanges(user, old!, t, visibleBefore);
          return {};
        }
        const home = old ? (old.home ?? null) : personal ? null : inT.groupId;
        // Видимость меняет только владелец; старое приложение о ней не знает — его новое дело видно только своей группе
        let only = old?.only ?? false;
        let share = old?.share;
        if (role === 'owner') {
          if (api >= 3) {
            if (inT.only !== undefined) only = inT.only;
            if (inT.share !== undefined) {
              const ids = new Set(ownerGroups.map((g) => g.id));
              share = Object.fromEntries(Object.entries(inT.share).filter(([gid]) => ids.has(gid)));
            }
          } else if (!old) share = Object.fromEntries(ownerGroups.map((g) => [g.id, g.id === home]));
        }
        // Создали в группе — группа его видит, даже если там режим «Только выбранные»
        if (!old && home && share?.[home] === undefined) share = { ...share, [home]: true };
        // Кто занят — только люди из групп владельца
        const circle = new Set([owner, ...ownerGroups.flatMap((g) => g.memberIds)]);
        const people = inT.people ? [...new Set(inT.people)].filter((p) => circle.has(p)) : undefined;
        // Подзадача — только у обычного дела того же владельца (один уровень вложенности)
        let parentId = inT.parentId ?? null;
        if (parentId) {
          const parent = parentId === inT.id ? null : await s.getItem(ownerPart(owner), parentId);
          if (parent?.type !== 'task' || parent.parentId) parentId = null;
        }
        // Конец раньше начала не бывает
        const endDate = inT.endDate && inT.date && inT.endDate > inT.date ? inT.endDate : null;
        const endTime = inT.endTime && (endDate || (inT.time && inT.endTime > inT.time)) ? inT.endTime : null;
        const { ownerId: _o, only: _on, share: _sh, groupId: _g, kind: kindIn, celebrant: celebrantIn, ext: extIn, ...fields } = inT;
        // Откуда перенесено — только у своего дела; нет поля — как было
        const ext = role === 'owner' ? (extIn === undefined ? (old?.type === 'task' ? old.ext : undefined) : extIn) : old?.type === 'task' ? old.ext : undefined;
        // Тип: нет поля — как было; обычное дело не храним
        const kind = kindIn ?? (old?.type === 'task' ? old.kind : undefined);
        // Именинник — только у дня рождения; id — только человек из круга владельца
        const celebrantRaw = celebrantIn === undefined ? (old?.type === 'task' ? old.celebrant : undefined) : celebrantIn;
        const celebrant =
          kind === 'birthday' && celebrantRaw
            ? { ...(celebrantRaw.id && circle.has(celebrantRaw.id) && { id: celebrantRaw.id }), name: celebrantRaw.name }
            : undefined;
        const task: Task = {
          type: 'task',
          ...fields,
          groupId: ownerPart(owner),
          endDate,
          endTime,
          ...(people && { people }),
          parentId,
          note: inT.note ?? '',
          home,
          ...(only && { only }),
          ...(share && Object.keys(share).length && { share }),
          ...(kind && kind !== 'task' && { kind }),
          ...(celebrant && { celebrant }),
          ...(ext && { ext }),
          createdBy: owner,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        await s.putItem(task);
        await this.bumpOwner(owner, ownerGroups);
        const visibleNow = ownerGroups.filter((g) => visibleIn(task, g)).map((g) => g.id);
        if (!old) await this.logTo(user, visibleNow, { kind: 'task.add', itemId: task.id, title: task.title, date: task.date, time: task.time });
        else await this.logTaskChanges(user, old, task, [...new Set([...visibleBefore, ...visibleNow])]);
        return {};
      }
      case 'watch.put': {
        await this.memberGroup(user, op.watch.groupId);
        const old = await s.getItem(op.watch.groupId, op.watch.id);
        if (old && old.type !== 'watch') throw new HttpError(409, 'conflict');
        // Рейтинг Кинопоиска и пустые поля — из ПоискКино: для новой записи или нового названия; иначе как было
        const prev = old?.type === 'watch' ? old : null;
        const fresh = !prev || prev.title !== op.watch.title;
        const found = fresh ? await lookupFilm(s, op.watch.title, op.watch.year, this.films) : null;
        const item: Item = {
          type: 'watch',
          ...op.watch,
          // Новое название, но поиск не состоялся — данные прежнего фильма убираем, запись дополнится позже (/watch/enrich)
          ...(found ? withFilm(op.watch, found, now) : fresh ? { rating: null, kpId: null, description: '', suggestion: null } : prev ? keepFilm(prev) : {}),
          addedBy: old?.type === 'watch' ? old.addedBy : user.id,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        await s.putItem(item);
        await s.incr(grev(op.watch.groupId));
        const base = { scope: item.groupId, groupId: item.groupId, itemId: item.id, title: item.title };
        if (!old) await this.log(user, { ...base, kind: 'watch.add' });
        else if (old.type === 'watch' && !old.watchedAt && op.watch.watchedAt) await this.log(user, { ...base, kind: 'watch.done' });
        return {};
      }
      case 'item.delete': {
        // «Смотреть» лежит в разделе группы
        const watch = op.groupId !== PERSONAL ? await s.getItem(op.groupId, op.id) : null;
        if (watch?.type === 'watch') {
          await this.memberGroup(user, op.groupId);
          await s.deleteItem(op.groupId, op.id);
          await s.incr(grev(op.groupId));
          await this.log(user, { scope: op.groupId, groupId: op.groupId, itemId: op.id, title: watch.title, kind: 'watch.delete' });
          return {};
        }
        const old = await this.findTask(user, op.id, op.ownerId, op.groupId);
        if (!old) return {};
        const role = await this.roleFor(user, old);
        if (role !== 'owner' && role !== 'admin') throw new HttpError(403, 'forbidden', 'Удалить дело могут владелец и админы группы');
        const ownerGroups = await this.groupsOf(old.createdBy);
        await s.deleteItem(ownerPart(old.createdBy), old.id);
        await this.bumpOwner(old.createdBy, ownerGroups);
        const scopes = ownerGroups.filter((g) => visibleIn(old, g)).map((g) => g.id);
        await this.logTo(user, scopes, { kind: 'task.delete', itemId: old.id, title: old.title, date: old.date, time: old.time });
        return {};
      }
      case 'wish.put': {
        const old = await s.getWish(user.id, op.wish.id);
        const { giftedBy: giftIn, ...fields } = op.wish;
        // Подарок (S1). По умолчанию — как было: старое приложение полей подарка не шлёт и не должно их стирать
        let giftedBy = old?.giftedBy ?? null;
        let giftedAt = old?.giftedAt ?? null;
        if (old?.receivedAt && !fields.receivedAt) {
          // Владелец снял «получил» — хотелка снова открыта для всех
          giftedBy = null;
          giftedAt = null;
        } else if (fields.receivedAt && giftIn !== undefined && giftIn !== giftedBy && (old?.receivedAt || !giftedBy)) {
          // Менять «от кого» владелец может, только если видит его: скрытый от него подарок при «получил» не затирается
          if (giftIn && (giftIn === user.id || !(await this.shareGroup(user.id, giftIn))))
            throw new HttpError(400, 'bad_member', 'Подарить мог только человек из ваших групп');
          giftedBy = giftIn;
          giftedAt = giftIn ? (giftedAt ?? fields.receivedAt) : null;
        }
        const w: Wish = {
          ...fields,
          ownerId: user.id,
          ...(giftedBy && { giftedBy }),
          ...(giftedAt && { giftedAt }),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        await s.putWish(w);
        await s.incr(urev(user.id));
        const base = { scope: `u:${user.id}`, itemId: w.id, title: w.title };
        if (!old) await this.log(user, { ...base, kind: 'wish.add' });
        else if (!old.receivedAt && w.receivedAt) await this.log(user, { ...base, kind: 'wish.done' });
        return {};
      }
      case 'wish.gift': {
        if (op.ownerId === user.id) throw new HttpError(400, 'own_wish', 'Свою хотелку отмечайте как полученную');
        if (!(await this.shareGroup(user.id, op.ownerId))) throw new HttpError(403, 'forbidden', 'Нет общей группы с владельцем хотелки');
        const w = await s.getWish(op.ownerId, op.id);
        if (!w) throw new HttpError(404, 'not_found', 'Хотелка не найдена');
        if (op.gifted) {
          if (w.giftedBy === user.id) return {};
          if (w.giftedBy || w.receivedAt) throw new HttpError(409, 'already_gifted', 'Эту хотелку уже подарили');
          w.giftedBy = user.id;
          w.giftedAt = now;
        } else {
          if (!w.giftedBy) return {};
          if (w.giftedBy !== user.id) throw new HttpError(403, 'forbidden', 'Снять отметку может только тот, кто подарил');
          if (w.receivedAt) throw new HttpError(409, 'received', 'Владелец уже отметил подарок полученным');
          delete w.giftedBy;
          delete w.giftedAt;
        }
        // updatedAt и urev владельца не трогаем: по ним он догадался бы о подарке. Остальным — своя ревизия (giftrev)
        await s.putWish(w);
        await s.incr(giftrev(op.ownerId));
        // В ленту хотелок владельца: её видят все, кроме него самого (activity не показывает человеку его scope u:<id>)
        if (op.gifted) await this.log(user, { scope: `u:${op.ownerId}`, itemId: w.id, title: w.title, kind: 'wish.done' });
        return {};
      }
      case 'wish.delete': {
        const old = await s.getWish(user.id, op.id);
        await s.deleteWish(user.id, op.id);
        await s.incr(urev(user.id));
        if (old) await this.log(user, { scope: `u:${user.id}`, itemId: op.id, title: old.title, kind: 'wish.delete' });
        return {};
      }
      case 'topic.put': {
        const old = await s.getNote(user.id, op.topic.id);
        if (old && old.kind !== 'topic') throw new HttpError(409, 'conflict');
        // Открыть тему можно только своим группам
        const mine = new Set(await s.listMemberships(user.id));
        const groupIds = [...new Set(op.topic.groupIds)].filter((g) => mine.has(g));
        // Архив (S2): менять может только владелец — тема пишется только в его идеи. Нет поля — как было
        const archivedAt = op.topic.archivedAt === undefined ? (old?.kind === 'topic' ? (old.archivedAt ?? null) : null) : op.topic.archivedAt;
        const body = op.topic.body === undefined ? (old?.kind === 'topic' ? (old.body ?? '') : '') : op.topic.body.replace(/\s+$/, '');
        const t: Topic = {
          kind: 'topic',
          id: op.topic.id,
          ownerId: user.id,
          title: op.topic.title,
          groupIds,
          ...(archivedAt && { archivedAt }),
          ...(body && { body }),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        await s.putNote(t);
        await s.incr(irev(user.id));
        // В ленту — только момент, когда темой поделились с группой
        const before = new Set(old?.kind === 'topic' ? old.groupIds : []);
        for (const gid of groupIds.filter((g) => !before.has(g)))
          await this.log(user, { scope: gid, groupId: gid, itemId: t.id, title: t.title, kind: 'topic.share' });
        return {};
      }
      case 'topic.delete': {
        // Тема удаляется вместе со своими идеями
        const all = await s.listNotes(user.id);
        for (const n of all) if (n.id === op.id || (n.kind === 'idea' && n.topicId === op.id)) await s.deleteNote(user.id, n.id);
        await s.incr(irev(user.id));
        return {};
      }
      case 'idea.put': {
        const old = await s.getNote(user.id, op.idea.id);
        if (old && old.kind !== 'idea') throw new HttpError(409, 'conflict');
        // Тему могли удалить на другом телефоне — тогда идея уходит во «Без темы», а не теряется
        let topicId = op.idea.topicId;
        if (topicId) {
          const t = await s.getNote(user.id, topicId);
          if (t?.kind !== 'topic') topicId = null;
        }
        const idea: Idea = { kind: 'idea', id: op.idea.id, ownerId: user.id, topicId, text: op.idea.text, createdAt: old?.createdAt ?? now, updatedAt: now };
        await s.putNote(idea);
        await s.incr(irev(user.id));
        return {};
      }
      case 'idea.delete': {
        await s.deleteNote(user.id, op.id);
        await s.incr(irev(user.id));
        return {};
      }
      case 'group.create': {
        const exists = await s.getGroup(op.group.id);
        if (exists) {
          if (!exists.memberIds.includes(user.id)) throw new HttpError(409, 'conflict');
          return { group: groupView(exists, user.id) };
        }
        const g: Group = {
          id: op.group.id,
          name: op.group.name,
          category: op.group.category as Group['category'],
          inviteCode: await this.newInviteCode(op.group.id),
          ownerId: user.id,
          adminIds: [],
          memberIds: [user.id],
          createdAt: now,
        };
        await s.putGroup(g);
        await s.addMembership(user.id, g.id);
        await s.incr(grev(g.id));
        return { group: g };
      }
      case 'group.update': {
        const g = await this.memberGroup(user, op.id);
        if (!canManage(g, user.id)) throw new HttpError(403, 'forbidden', 'Менять группу могут создатель и админы');
        const renamed = !!op.name && op.name !== g.name;
        if (op.name) g.name = op.name;
        if (op.category) g.category = op.category as Group['category'];
        await s.putGroup(g);
        await s.incr(grev(g.id));
        if (renamed) await this.log(user, { scope: g.id, groupId: g.id, title: g.name, kind: 'group.rename' });
        return {};
      }
      case 'group.join': {
        const gid = await s.getKey(`invite#${op.code.toUpperCase()}`);
        const g = gid ? await s.getGroup(gid) : null;
        if (!g) throw new HttpError(404, 'bad_code', 'Такого кода нет — проверьте его у того, кто пригласил');
        if (!g.memberIds.includes(user.id)) {
          if (g.memberIds.length >= 50) throw new HttpError(409, 'group_full', 'В группе уже 50 человек');
          g.memberIds.push(user.id);
          await s.putGroup(g);
          await s.addMembership(user.id, g.id);
          await s.incr(grev(g.id));
          await this.log(user, { scope: g.id, groupId: g.id, kind: 'member.join' });
        }
        return { group: groupView(g, user.id) };
      }
      case 'group.leave': {
        const g = await s.getGroup(op.id);
        if (g?.memberIds.includes(user.id)) {
          await this.dropMember(g, user.id, false);
          if (g.memberIds.length) await this.log(user, { scope: g.id, groupId: g.id, kind: 'member.leave' });
        }
        else await s.removeMembership(user.id, op.id);
        return {};
      }
      case 'group.admin': {
        const g = await this.memberGroup(user, op.id);
        if (g.ownerId !== user.id) throw new HttpError(403, 'forbidden', 'Назначать админов может только создатель');
        if (!g.memberIds.includes(op.userId) || op.userId === g.ownerId) throw new HttpError(400, 'bad_member');
        g.adminIds = g.adminIds.filter((a) => a !== op.userId);
        if (op.admin) g.adminIds.push(op.userId);
        await s.putGroup(g);
        await s.incr(grev(g.id));
        return {};
      }
      case 'group.remove': {
        const g = await this.memberGroup(user, op.id);
        if (!g.memberIds.includes(op.userId)) return {};
        if (!canRemove(g, user.id, op.userId)) throw new HttpError(403, 'forbidden', 'Нет прав исключить этого участника');
        await this.dropMember(g, op.userId, true, true);
        await this.log(user, { scope: g.id, groupId: g.id, kind: 'member.remove', target: op.userId });
        return {};
      }
      case 'group.mode': {
        const g = await this.memberGroup(user, op.id);
        const rest = (g.selectOnly ?? []).filter((m) => m !== user.id);
        g.selectOnly = op.selectOnly ? [...rest, user.id] : rest;
        await s.putGroup(g);
        await s.incr(grev(g.id));
        return {};
      }
      case 'prefs': {
        const cur = (await s.getPrefs(user.id)) ?? { reminders: null, overrides: {}, updatedAt: now };
        if (op.reminders) cur.reminders = op.reminders;
        for (const [id, v] of Object.entries(op.overrides ?? {})) {
          if (v) cur.overrides[id] = v;
          else delete cur.overrides[id];
        }
        // Не даём записи расти бесконечно: храним не больше 2000 дел с личными напоминаниями
        const keys = Object.keys(cur.overrides);
        if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete cur.overrides[k];
        cur.updatedAt = now;
        await s.putPrefs(user.id, cur);
        return {};
      }
      case 'profile': {
        if (op.nick !== undefined) {
          const nick = op.nick?.replace(/^@/, '') || null;
          const oldNick = user.nick;
          if (nick && nickKey(nick) !== (oldNick ? nickKey(oldNick) : '')) {
            if (!NICK_RULE.test(nick)) throw new HttpError(400, 'bad_nick', 'От 3 до 20 символов: буквы, цифры, «_» и «.»');
            if (!(await s.claimKey(nickKey(nick), user.id))) throw new HttpError(409, 'nick_taken', 'Этот никнейм занят');
            if (oldNick) await s.deleteKey(nickKey(oldNick));
          } else if (!nick && oldNick) await s.deleteKey(nickKey(oldNick));
          user.nick = nick ?? undefined;
        }
        if (op.name) user.name = op.name;
        if (op.gender !== undefined) user.gender = op.gender ?? undefined;
        if (op.color !== undefined) user.color = op.color ?? undefined;
        if (op.avatar !== undefined) user.avatar = op.avatar || undefined;
        await s.putUser(user);
        await s.incr(urev(user.id));
        return { me: meView(user) };
      }
    }
  }

  /** Всё, что телефону нужно знать; содержимое — только там, где ревизия поменялась */
  /**
   * Идеи человека owner глазами user: свои — все; чужие — темы, открытые общим группам, и идеи в них.
   * common — id общих групп (для чужих)
   */
  private visibleNotes(notes: Note[], own: boolean, common: Set<string>) {
    const topics = notes.filter((n): n is Topic => n.kind === 'topic' && (own || n.groupIds.some((g) => common.has(g))));
    const ids = new Set(topics.map((t) => t.id));
    const ideas = notes.filter((n): n is Idea => n.kind === 'idea' && (own || (!!n.topicId && ids.has(n.topicId))));
    // Чужим не показываем, каким ещё группам открыта тема
    return { topics: own ? topics : topics.map((t) => ({ ...t, groupIds: t.groupIds.filter((g) => common.has(g)) })), ideas };
  }

  /**
   * «Смотреть» группы: записи, которые ещё не искали в ПоискКино (старые, или поиск тогда не состоялся), — дополнить.
   * За раз не больше limit; left — сколько осталось. Поиск не состоялся (нет ключа, лимит) — останавливаемся
   */
  async enrichWatch(user: User, groupId: string, limit = 8): Promise<{ updated: number; left: number }> {
    await this.memberGroup(user, groupId);
    const s = this.store;
    const todo = (await s.listItems(groupId)).filter((x): x is WatchItem => x.type === 'watch' && !x.kpAt);
    let updated = 0;
    for (const w of todo.slice(0, limit)) {
      const found = await lookupFilm(s, w.title, w.year, this.films);
      if (!found) break;
      const now = new Date().toISOString();
      await s.putItem({ ...w, ...withFilm(w, found, now), updatedAt: now });
      updated++;
    }
    if (updated) await s.incr(grev(groupId));
    return { updated, left: todo.length - updated };
  }

  async sync(user: User, known: { groups: Record<string, number>; owners: Record<string, number>; ideas?: Record<string, string> }, api = 1) {
    const s = this.store;
    const groups = await s.getGroups(await s.listMemberships(user.id));
    const mine = groups.filter((g) => g.memberIds.includes(user.id));
    await this.ensureMigrated(mine);
    const peopleIds = [...new Set([user.id, ...mine.flatMap((g) => g.memberIds)])];
    const [users, counters] = await Promise.all([
      s.getUsers(peopleIds),
      s.getCounters([...mine.map((g) => grev(g.id)), ...peopleIds.map(urev), ...peopleIds.map(irev), ...peopleIds.map(giftrev), trev(user.id)]),
    ]);
    // Ревизия идей: счётчик человека и общие с ним группы (вышли из группы — чужие темы надо убрать)
    const commonWith = (id: string) => new Set(mine.filter((g) => g.memberIds.includes(id)).map((g) => g.id));
    const ideaRevs = Object.fromEntries(
      peopleIds.map((id) => [id, id === user.id ? `${counters[irev(id)] ?? 0}` : `${counters[irev(id)] ?? 0}|${[...commonWith(id)].sort().join(',')}`]),
    );
    // Старые версии приложения идей не знают (не присылают ideas) — им и не отдаём
    const knownIdeas = known.ideas ?? {};
    const changedIdeaOwners = known.ideas ? peopleIds.filter((id) => knownIdeas[id] !== ideaRevs[id]) : [];
    const revs = {
      // API 3: «@me» — ревизия моего личного календаря (дела без групп меняют только её)
      groups: { ...Object.fromEntries(mine.map((g) => [g.id, counters[grev(g.id)] ?? 0])), ...(api >= 3 && { [PERSONAL]: counters[trev(user.id)] ?? 0 }) } as Record<string, number>,
      // Чужим хотелкам — ещё и подарки (giftrev); своя ревизия подарков не включает: сюрприз (S1, REVIEW-v2 V2-2).
      // Сумма двух растущих счётчиков тоже только растёт — телефон по-прежнему сравнивает одно число
      owners: Object.fromEntries(peopleIds.map((id) => [id, (counters[urev(id)] ?? 0) + (id === user.id ? 0 : (counters[giftrev(id)] ?? 0))])),
    };
    const changedGroups = mine.filter((g) => known.groups[g.id] !== revs.groups[g.id]);
    const changedOwners = peopleIds.filter((id) => known.owners[id] !== revs.owners[id]);
    // Дела: API 3 — одним списком всех видимых, если поменялась хоть одна группа или личный календарь;
    // старое приложение — по группам, каждое дело в одной группе
    const tasksChanged = changedGroups.length > 0 || (api >= 3 && known.groups[PERSONAL] !== revs.groups[PERSONAL]);
    const [itemLists, visible, wishLists, prefs, noteLists] = await Promise.all([
      Promise.all(changedGroups.map((g) => s.listItems(g.id).then((xs) => xs.filter((x): x is WatchItem => x.type === 'watch')))),
      tasksChanged ? this.visibleTasks(user, mine) : Promise.resolve([]),
      Promise.all(changedOwners.map((id) => s.listWishes(id))),
      s.getPrefs(user.id),
      // Идеи не должны ломать остальную синхронизацию (например, пока таблица создаётся после обновления)
      Promise.all(changedIdeaOwners.map((id) => s.listNotes(id))).catch((e) => {
        console.warn('Идеи:', (e as Error).message);
        return null;
      }),
    ]);
    const ideaOwners = noteLists ? changedIdeaOwners : [];
    return {
      me: meView(user),
      groups: mine.map((g) => groupView(g, user.id)),
      users: users.map(publicUser),
      revs,
      items: Object.fromEntries(
        changedGroups.map((g, i) => [
          g.id,
          api >= 3
            ? itemLists[i]
            : [...itemLists[i], ...visible.flatMap((x) => {
                const v = this.taskView(x.task, x.in, user.id, api);
                return v && v.groupId === g.id ? [v] : [];
              })],
        ]),
      ),
      ...(api >= 3 && tasksChanged && { tasks: visible.flatMap((x) => this.taskView(x.task, x.in, user.id, api) ?? []) }),
      wishes: Object.fromEntries(changedOwners.map((id, i) => [id, wishLists[i].map((w) => wishView(w, user.id, api))])),
      // Личные напоминания — всегда целиком (их немного); null — телефон ещё ни разу не присылал
      prefs,
      // Идеи: ревизии (не смогли прочитать — прежние, чтобы телефон спросил ещё раз) и содержимое изменившихся
      ideaRevs: noteLists ? ideaRevs : Object.fromEntries(peopleIds.map((id) => [id, knownIdeas[id] ?? ''])),
      notes: Object.fromEntries(ideaOwners.map((id, i) => [id, this.visibleNotes(noteLists![i], id === user.id, commonWith(id))])),
    };
  }

  /** Удалить аккаунт: выйти из всех групп (его записи в группах удаляются), стереть хотелки и ключи */
  async deleteAccount(user: User) {
    const s = this.store;
    for (const gid of await s.listMemberships(user.id)) {
      const g = await s.getGroup(gid);
      if (g) await this.dropMember(g, user.id, true);
      else await s.removeMembership(user.id, gid);
    }
    for (const w of await s.listWishes(user.id)) await s.deleteWish(user.id, w.id);
    for (const t of await s.listItems(ownerPart(user.id))) await s.deleteItem(ownerPart(user.id), t.id);
    for (const n of await s.listNotes(user.id)) await s.deleteNote(user.id, n.id);
    await s.deletePrefs(user.id);
    if (user.email) await s.deleteKey(`email#${user.email}`);
    if (user.vkId) await s.deleteKey(`vk#${user.vkId}`);
    if (user.nick) await s.deleteKey(nickKey(user.nick));
    await s.deleteUser(user.id);
  }

  /** Люди из всех моих групп и сами группы — для голосового контекста */
  async circle(user: User) {
    const s = this.store;
    const groups = (await s.getGroups(await s.listMemberships(user.id))).filter((g) => g.memberIds.includes(user.id));
    const ids = [...new Set(groups.flatMap((g) => g.memberIds))].filter((id) => id !== user.id);
    const people = await s.getUsers(ids);
    return { groups, people };
  }
}

export function registerData(app: FastifyInstance, store: Store, data: Data) {
  app.post('/sync', async (req) => {
    const user = await requireUser(req, store);
    const known = z
      .object({ groups: z.record(z.number()).default({}), owners: z.record(z.number()).default({}), ideas: z.record(z.string().max(2000)).optional() })
      .parse(req.body ?? {});
    return data.sync(user, known, apiLevel(req));
  });

  /** Дополнить «Смотреть» группы рейтингом и описанием из ПоискКино (старые записи) */
  app.post('/watch/enrich', async (req) => {
    const user = await requireUser(req, store);
    const body = z.object({ groupId: z.string().min(1).max(64) }).parse(req.body ?? {});
    return data.enrichWatch(user, body.groupId);
  });

  /** Лента активности: что сделали другие за последние 30 дней (или с since) */
  app.get('/activity', async (req) => {
    const user = await requireUser(req, store);
    const q = z.object({ since: z.string().max(40).optional() }).parse(req.query ?? {});
    const floor = new Date(Date.now() - 30 * 86400000).toISOString();
    const since = q.since && q.since > floor ? q.since : floor;
    return data.activity(user, since, apiLevel(req));
  });

  /** Пачка изменений. Ошибка одной операции не мешает остальным */
  app.post('/ops', async (req) => {
    const user = await requireUser(req, store);
    const { ops } = z.object({ ops: z.array(z.unknown()).max(200) }).parse(req.body);
    const results: unknown[] = [];
    for (const raw of ops) {
      const parsed = Op.safeParse(raw);
      if (!parsed.success) {
        // Отклонённые операции пишем в журнал: телефон их больше не повторит, и без записи потерю не найти
        req.log.warn({ op: (raw as { op?: unknown })?.op, issue: parsed.error.issues[0] }, 'Операция отклонена: неверный формат');
        results.push({ ok: false, error: 'bad_request', message: parsed.error.issues[0]?.message });
        continue;
      }
      try {
        // Профиль мог поменяться предыдущей операцией
        const fresh = (await store.getUser(user.id)) ?? user;
        results.push({ ok: true, ...((await data.apply(fresh, parsed.data, apiLevel(req))) as object) });
      } catch (e) {
        if (e instanceof HttpError) {
          req.log.warn({ op: parsed.data.op, code: e.code }, `Операция отклонена: ${e.message}`);
          results.push({ ok: false, error: e.code, message: e.message });
        }
        else throw e;
      }
    }
    return { results };
  });

  app.get('/nick/check', async (req) => {
    const user = await requireUser(req, store);
    const { nick } = z.object({ nick: z.string().max(40) }).parse(req.query);
    const n = nick.trim().replace(/^@/, '');
    if (!NICK_RULE.test(n)) return { status: 'invalid' };
    const owner = await store.getKey(nickKey(n));
    return { status: !owner ? 'free' : owner === user.id ? 'same' : 'taken' };
  });

  app.delete('/me', async (req) => {
    const user = await requireUser(req, store);
    await data.deleteAccount(user);
    return { ok: true };
  });
}
