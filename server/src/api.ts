/**
 * Данные приложения: синхронизация и изменения.
 *
 * POST /sync — телефон присылает, какие ревизии групп и людей у него есть;
 *   сервер отвечает списком групп и людей и полностью отдаёт дела/«Смотреть» только тех групп
 *   и хотелки только тех людей, где ревизия поменялась. Данных у пары мало — так проще и надёжнее.
 * POST /ops — пачка изменений по порядку (офлайн-очередь телефона). id записей придумывает телефон,
 *   поэтому повтор той же операции безопасен.
 * Все права проверяются здесь: телефону доверять нельзя.
 */
import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, meView, requireUser } from './auth.js';
import { grev, publicUser, urev, type Activity, type Group, type Item, type Store, type Task, type User, type Wish } from './store/index.js';
import { CATEGORIES } from './types.js';

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
/** Повтор дела — см. mobile/src/lib/types.ts (Repeat) */
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
  groupId: Id,
  title: z.string().trim().min(1).max(200),
  date: Date10,
  time: Time5,
  note: z.string().max(2000).optional(),
  doneAt: Stamp,
  repeat: RepeatIn.nullable().optional(),
  doneDates: z.array(Day).max(400).optional(),
  skipDates: z.array(Day).max(400).optional(),
  reminders: z.array(Spec).max(10).nullable().optional(),
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
});

const Op = z.discriminatedUnion('op', [
  z.object({ op: z.literal('task.put'), task: TaskIn }),
  z.object({ op: z.literal('watch.put'), watch: WatchIn }),
  z.object({ op: z.literal('item.delete'), groupId: Id, id: Id }),
  z.object({ op: z.literal('wish.put'), wish: WishIn }),
  z.object({ op: z.literal('wish.delete'), id: Id }),
  z.object({ op: z.literal('group.create'), group: z.object({ id: Id, name: z.string().trim().min(1).max(40), category: z.enum(CATEGORIES as [string, ...string[]]) }) }),
  z.object({ op: z.literal('group.update'), id: Id, name: z.string().trim().min(1).max(40).optional(), category: z.enum(CATEGORIES as [string, ...string[]]).optional() }),
  z.object({ op: z.literal('group.join'), code: z.string().trim().min(4).max(12) }),
  z.object({ op: z.literal('group.leave'), id: Id }),
  z.object({ op: z.literal('group.admin'), id: Id, userId: Id, admin: z.boolean() }),
  z.object({ op: z.literal('group.remove'), id: Id, userId: Id }),
  z.object({
    op: z.literal('profile'),
    name: z.string().trim().min(1).max(40).optional(),
    nick: z.string().trim().max(20).nullable().optional(),
    gender: z.enum(['m', 'f']).nullable().optional(),
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
  });
  const x = norm(a);
  const y = norm(b);
  return (Object.keys(x) as (keyof typeof x)[]).filter((k) => x[k] !== y[k]);
}

export class Data {
  constructor(private store: Store) {}

  /** Запись в ленту активности. Ошибка ленты не должна ломать саму правку */
  private async log(user: User, a: Omit<Activity, 'id' | 'at' | 'actor'>) {
    try {
      const at = new Date().toISOString();
      await this.store.addActivity({ ...a, actor: user.id, at, id: `${at}#${randomInt(1_000_000).toString(36)}` });
    } catch (e) {
      console.warn('Лента активности:', (e as Error).message);
    }
  }

  /** Лента для человека: события в его группах и хотелки соучастников. Свои действия не показываем */
  async activity(user: User, since: string) {
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
    const events = lists
      .flat()
      .filter((a) => a.actor !== user.id)
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 150);
    return { events };
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
      for (const it of await this.store.listItems(g.id)) {
        const author = it.type === 'task' ? it.createdBy : it.addedBy;
        if (author === userId) await this.store.deleteItem(g.id, it.id);
      }
    }
    if (rotateInvite) {
      const oldCode = g.inviteCode;
      g.inviteCode = await this.newInviteCode(g.id, oldCode);
      await this.store.deleteKey(`invite#${oldCode}`);
    }
    await this.store.putGroup(g);
    await this.store.incr(grev(g.id));
  }

  async apply(user: User, op: OpIn): Promise<unknown> {
    const now = new Date().toISOString();
    const s = this.store;
    switch (op.op) {
      case 'task.put': {
        await this.memberGroup(user, op.task.groupId);
        const old = await s.getItem(op.task.groupId, op.task.id);
        if (old && old.type !== 'task') throw new HttpError(409, 'conflict');
        const task: Item = {
          type: 'task',
          ...op.task,
          note: op.task.note ?? '',
          createdBy: old?.type === 'task' ? old.createdBy : user.id,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        };
        await s.putItem(task);
        await s.incr(grev(op.task.groupId));
        const base = { scope: task.groupId, groupId: task.groupId, itemId: task.id, title: task.title, date: task.date, time: task.time };
        if (!old || old.type !== 'task') await this.log(user, { ...base, kind: 'task.add' });
        else {
          const t = task as Task;
          if (!old.doneAt && t.doneAt) await this.log(user, { ...base, kind: 'task.done' });
          if (old.doneAt && !t.doneAt) await this.log(user, { ...base, kind: 'task.undone' });
          // Повторы: отметки отдельных раз и удаление одного раза
          const had = new Set(old.doneDates ?? []);
          const has = new Set(t.doneDates ?? []);
          for (const d of has) if (!had.has(d)) await this.log(user, { ...base, date: d, kind: 'task.done' });
          for (const d of had) if (!has.has(d) && d >= new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10)) await this.log(user, { ...base, date: d, kind: 'task.undone' });
          const skipped = (t.skipDates ?? []).filter((d) => !(old.skipDates ?? []).includes(d));
          for (const d of skipped) await this.log(user, { ...base, date: d, kind: 'task.delete', fields: ['occurrence'] });
          const fields = taskChanges(old, t);
          if (fields.length) await this.log(user, { ...base, kind: 'task.edit', fields });
        }
        return {};
      }
      case 'watch.put': {
        await this.memberGroup(user, op.watch.groupId);
        const old = await s.getItem(op.watch.groupId, op.watch.id);
        if (old && old.type !== 'watch') throw new HttpError(409, 'conflict');
        const item: Item = {
          type: 'watch',
          ...op.watch,
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
        await this.memberGroup(user, op.groupId);
        const old = await s.getItem(op.groupId, op.id);
        await s.deleteItem(op.groupId, op.id);
        await s.incr(grev(op.groupId));
        if (old)
          await this.log(user, {
            scope: op.groupId,
            groupId: op.groupId,
            itemId: op.id,
            title: old.title,
            kind: old.type === 'task' ? 'task.delete' : 'watch.delete',
            ...(old.type === 'task' && { date: old.date, time: old.time }),
          });
        return {};
      }
      case 'wish.put': {
        const old = await s.getWish(user.id, op.wish.id);
        const w: Wish = { ...op.wish, ownerId: user.id, createdAt: old?.createdAt ?? now, updatedAt: now };
        await s.putWish(w);
        await s.incr(urev(user.id));
        const base = { scope: `u:${user.id}`, itemId: w.id, title: w.title };
        if (!old) await this.log(user, { ...base, kind: 'wish.add' });
        else if (!old.receivedAt && w.receivedAt) await this.log(user, { ...base, kind: 'wish.done' });
        return {};
      }
      case 'wish.delete': {
        const old = await s.getWish(user.id, op.id);
        await s.deleteWish(user.id, op.id);
        await s.incr(urev(user.id));
        if (old) await this.log(user, { scope: `u:${user.id}`, itemId: op.id, title: old.title, kind: 'wish.delete' });
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
        await s.putUser(user);
        await s.incr(urev(user.id));
        return { me: meView(user) };
      }
    }
  }

  /** Всё, что телефону нужно знать; содержимое — только там, где ревизия поменялась */
  async sync(user: User, known: { groups: Record<string, number>; owners: Record<string, number> }) {
    const s = this.store;
    const groups = await s.getGroups(await s.listMemberships(user.id));
    const mine = groups.filter((g) => g.memberIds.includes(user.id));
    const peopleIds = [...new Set([user.id, ...mine.flatMap((g) => g.memberIds)])];
    const [users, counters] = await Promise.all([
      s.getUsers(peopleIds),
      s.getCounters([...mine.map((g) => grev(g.id)), ...peopleIds.map(urev)]),
    ]);
    const revs = {
      groups: Object.fromEntries(mine.map((g) => [g.id, counters[grev(g.id)] ?? 0])),
      owners: Object.fromEntries(peopleIds.map((id) => [id, counters[urev(id)] ?? 0])),
    };
    const changedGroups = mine.filter((g) => known.groups[g.id] !== revs.groups[g.id]);
    const changedOwners = peopleIds.filter((id) => known.owners[id] !== revs.owners[id]);
    const [itemLists, wishLists] = await Promise.all([
      Promise.all(changedGroups.map((g) => s.listItems(g.id))),
      Promise.all(changedOwners.map((id) => s.listWishes(id))),
    ]);
    return {
      me: meView(user),
      groups: mine.map((g) => groupView(g, user.id)),
      users: users.map(publicUser),
      revs,
      items: Object.fromEntries(changedGroups.map((g, i) => [g.id, itemLists[i]])),
      wishes: Object.fromEntries(changedOwners.map((id, i) => [id, wishLists[i]])),
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
      .object({ groups: z.record(z.number()).default({}), owners: z.record(z.number()).default({}) })
      .parse(req.body ?? {});
    return data.sync(user, known);
  });

  /** Лента активности: что сделали другие за последние 30 дней (или с since) */
  app.get('/activity', async (req) => {
    const user = await requireUser(req, store);
    const q = z.object({ since: z.string().max(40).optional() }).parse(req.query ?? {});
    const floor = new Date(Date.now() - 30 * 86400000).toISOString();
    const since = q.since && q.since > floor ? q.since : floor;
    return data.activity(user, since);
  });

  /** Пачка изменений. Ошибка одной операции не мешает остальным */
  app.post('/ops', async (req) => {
    const user = await requireUser(req, store);
    const { ops } = z.object({ ops: z.array(z.unknown()).max(200) }).parse(req.body);
    const results: unknown[] = [];
    for (const raw of ops) {
      const parsed = Op.safeParse(raw);
      if (!parsed.success) {
        results.push({ ok: false, error: 'bad_request', message: parsed.error.issues[0]?.message });
        continue;
      }
      try {
        // Профиль мог поменяться предыдущей операцией
        const fresh = (await store.getUser(user.id)) ?? user;
        results.push({ ok: true, ...((await data.apply(fresh, parsed.data)) as object) });
      } catch (e) {
        if (e instanceof HttpError) results.push({ ok: false, error: e.code, message: e.message });
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
