/**
 * Подписки, выданные вручную (близким, на время тестов): администратор (почта в ADMIN_EMAILS) выдаёт и забирает их
 * на странице /admin. Подписка — поле plan у аккаунта: до даты включительно или бессрочно (until: null).
 * Список выданных — запись subs#list (id аккаунтов); удалённые аккаунты из него просто пропадают при чтении.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, passwordLogin, requireUser, signToken } from './auth.js';
import { config } from './config.js';
import { readDays, type DayStat } from './spend.js';
import type { Store, User } from './store/types.js';

/** День по Москве — как у суточного лимита */
export const mskDay = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

/** Подписка действует сегодня */
export const hasPlan = (u: User, today = mskDay()): boolean => !!u.plan && (u.plan.until === null || u.plan.until >= today);

/** Суточный лимит удачных голосовых команд: с подпиской — PAID_DAILY_LIMIT (не меньше бесплатного) */
export const voiceLimitOf = (u: User): number => (hasPlan(u) ? Math.max(config.paidDailyLimit, config.voiceDailyLimit) : config.voiceDailyLimit);

const LIST = 'subs#list';
/** Запись живёт «вечно»: putTemp удаляет по сроку, срок — 100 лет */
const FOREVER = 100 * 365 * 24 * 3600;

const isAdmin = (u: User) => !!u.email && config.adminEmails.includes(u.email.toLowerCase());

/**
 * Только токен страницы подписок (POST /admin/login): его выдают по паролю на час. Токен приложения сюда не подходит —
 * украденный с телефона токен, вход через VK или ошибка в веб-версии не дают выдавать подписки
 */
async function requireAdmin(req: Parameters<typeof requireUser>[0], store: Store): Promise<User> {
  const user = await requireUser(req, store, 'admin');
  if (!isAdmin(user)) throw new HttpError(403, 'forbidden', 'Нет доступа');
  return user;
}

async function listIds(store: Store): Promise<string[]> {
  return (await store.getTemp<string[]>(LIST)) ?? [];
}

const view = (u: User) => ({ id: u.id, name: u.name, email: u.email ?? null, until: u.plan?.until ?? null, grantedAt: u.plan?.grantedAt ?? null, note: u.plan?.note ?? '', active: hasPlan(u) });

export function registerSubs(app: FastifyInstance, store: Store) {
  /** Вход на страницу подписок: почта администратора и пароль → токен на час */
  app.post('/admin/login', async (req) => {
    const b = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().max(200) }).parse(req.body);
    const user = await passwordLogin(store, b.email, b.password);
    if (!isAdmin(user)) {
      req.log.warn({ userId: user.id }, 'Вход на страницу подписок без прав');
      throw new HttpError(403, 'forbidden', 'Нет доступа');
    }
    req.log.info({ userId: user.id }, 'Вход на страницу подписок');
    return { token: signToken(user.id, 'admin') };
  });

  /** Расходы всех за N дней: по дням и по людям (больше всего потратившие — первыми) */
  app.get('/admin/stats', async (req) => {
    await requireAdmin(req, store);
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }).parse(req.query);
    type Part = { n: number; tokens: number; kop: number };
    const list = await readDays<DayStat & { users?: Record<string, Part> }>(store, 'all', days);
    const per = new Map<string, Part>();
    for (const d of list)
      for (const [id, p] of Object.entries(d.users ?? {})) {
        const was = per.get(id) ?? { n: 0, tokens: 0, kop: 0 };
        per.set(id, { n: was.n + p.n, tokens: was.tokens + p.tokens, kop: was.kop + p.kop });
      }
    const users = await store.getUsers([...per.keys()]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const people = [...per.entries()]
      .map(([id, p]) => ({ id, name: byId.get(id)?.name ?? 'Удалён', email: byId.get(id)?.email ?? null, plan: byId.get(id) ? hasPlan(byId.get(id)!) : false, ...p }))
      .sort((a, b) => b.kop - a.kop);
    return { days: list.map(({ users: _u, ...d }) => d), people };
  });

  /** Список выданных подписок (и истёкших — их можно продлить) */
  app.get('/admin/subs', async (req) => {
    await requireAdmin(req, store);
    const users = await store.getUsers(await listIds(store));
    return { subs: users.filter((u) => u.plan).map(view).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru')) };
  });

  /** Выдать или продлить: по почте аккаунта; until — ГГГГ-ММ-ДД включительно или null (бессрочно) */
  app.post('/admin/subs', async (req) => {
    const admin = await requireAdmin(req, store);
    const b = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(req.body);
    const id = await store.getKey(`email#${b.email}`);
    const user = id ? await store.getUser(id) : null;
    if (!user) throw new HttpError(404, 'not_found', 'Аккаунта с такой почтой нет');
    user.plan = { until: b.until, grantedAt: user.plan?.grantedAt ?? new Date().toISOString(), note: b.note ?? user.plan?.note ?? '' };
    await store.putUser(user);
    const ids = await listIds(store);
    if (!ids.includes(user.id)) await store.putTemp(LIST, [...ids, user.id], FOREVER);
    req.log.info({ adminId: admin.id, userId: user.id, until: b.until }, 'Подписка выдана');
    return { sub: view(user) };
  });

  /** Забрать подписку */
  app.delete('/admin/subs/:id', async (req) => {
    const admin = await requireAdmin(req, store);
    const { id } = z.object({ id: z.string().min(1).max(100) }).parse(req.params);
    const user = await store.getUser(id);
    if (user?.plan) {
      delete user.plan;
      await store.putUser(user);
    }
    const ids = await listIds(store);
    if (ids.includes(id)) await store.putTemp(LIST, ids.filter((x) => x !== id), FOREVER);
    req.log.info({ adminId: admin.id, userId: id }, 'Подписка отозвана');
    return { ok: true };
  });
}
