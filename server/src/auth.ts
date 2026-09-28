/**
 * Вход и аккаунты.
 *   Почта: регистрация по коду из письма + пароль; вход по паролю; «забыли пароль» — код из письма и новый пароль.
 *   VK ID: OAuth 2.1 с PKCE. Приложение открывает /auth/vk/start в браузере, VK возвращает человека
 *     на /auth/vk/callback, сервер обменивает код, создаёт сессию и отправляет в приложение
 *     kstati://auth?ticket=…; приложение меняет билет на токен через /auth/vk/finish.
 *   Токен — JWT (HS256) на 90 дней, в заголовке Authorization: Bearer …
 */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from './config.js';
import { sendMail, mailConfigured } from './mail.js';
import { publicUser, type Store, type User } from './store/index.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/* ---------- пароли ---------- */

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 32);
  return `s1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string | undefined): Promise<boolean> {
  if (!stored?.startsWith('s1$')) return false;
  const [, s, h] = stored.split('$');
  const hash = await scrypt(pw, Buffer.from(s, 'base64'), 32);
  const want = Buffer.from(h, 'base64');
  return hash.length === want.length && timingSafeEqual(hash, want);
}

/* ---------- токены ---------- */

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const TOKEN_DAYS = 90;

export function signToken(userId: string): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_DAYS * 86400 }));
  const sig = b64url(createHmac('sha256', config.jwtSecret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return null;
  const want = b64url(createHmac('sha256', config.jwtSecret).update(`${head}.${body}`).digest());
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof p.sub !== 'string' || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null;
    return p.sub;
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Кто делает запрос. Нет или неверный токен — 401 */
export async function requireUser(req: FastifyRequest, store: Store): Promise<User> {
  const h = req.headers.authorization ?? '';
  const id = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  const user = id ? await store.getUser(id) : null;
  if (!user) throw new HttpError(401, 'unauthorized');
  return user;
}

/** Что приложение получает о себе */
export const meView = (u: User) => ({ ...publicUser(u), email: u.email ?? null, hasPassword: !!u.passHash, vk: !!u.vkId });

/* ---------- коды из писем ---------- */

const normEmail = (e: string) => e.trim().toLowerCase();
const codeHash = (email: string, code: string) => createHash('sha256').update(`${email}|${code}|${config.jwtSecret}`).digest('hex');
type CodeRec = { hash: string; attempts: number };
const CODE_TTL = 15 * 60;

async function sendCode(store: Store, purpose: 'register' | 'reset', email: string): Promise<string | undefined> {
  // Не чаще раза в минуту на адрес
  if (await store.getTemp(`cooldown#${purpose}#${email}`)) throw new HttpError(429, 'too_often', 'Код уже отправлен, подождите минуту');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await store.putTemp(`code#${purpose}#${email}`, { hash: codeHash(email, code), attempts: 0 } satisfies CodeRec, CODE_TTL);
  await store.putTemp(`cooldown#${purpose}#${email}`, 1, 60);
  const subject = purpose === 'register' ? `Код для регистрации: ${code}` : `Код для сброса пароля: ${code}`;
  const text =
    purpose === 'register'
      ? `Ваш код для регистрации в «Кстати»: ${code}\n\nКод действует 15 минут. Если вы не регистрировались — просто проигнорируйте письмо.`
      : `Ваш код для сброса пароля в «Кстати»: ${code}\n\nКод действует 15 минут. Если вы не запрашивали сброс — просто проигнорируйте письмо, пароль останется прежним.`;
  await sendMail(email, subject, text);
  // На Mac без почты код возвращается в ответе — чтобы проверять без писем
  return !config.isProd && !mailConfigured() ? code : undefined;
}

async function checkCode(store: Store, purpose: 'register' | 'reset', email: string, code: string) {
  const key = `code#${purpose}#${email}`;
  const rec = await store.getTemp<CodeRec>(key);
  if (!rec) throw new HttpError(400, 'code_expired', 'Код устарел — запросите новый');
  if (rec.attempts >= 5) {
    await store.deleteTemp(key);
    throw new HttpError(400, 'code_expired', 'Слишком много попыток — запросите новый код');
  }
  if (rec.hash !== codeHash(email, code.trim())) {
    await store.putTemp(key, { ...rec, attempts: rec.attempts + 1 }, CODE_TTL);
    throw new HttpError(400, 'code_wrong', 'Неверный код');
  }
  await store.deleteTemp(key);
}

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8, 'Пароль — не короче 8 символов').max(200);
const Name = z.string().trim().min(1).max(40);

/* ---------- VK ID ---------- */

const pkce = () => {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

type VkState = { verifier: string; redirect: string };

async function vkExchange(code: string, verifier: string, deviceId: string, state: string) {
  const redirectUri = `${config.publicUrl}/auth/vk/callback`;
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: config.vkClientId,
    device_id: deviceId,
    redirect_uri: redirectUri,
    state,
  });
  const tokRes = await fetch('https://id.vk.com/oauth2/auth', { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
  const tok = (await tokRes.json()) as { access_token?: string; user_id?: number | string; error?: string; error_description?: string };
  if (!tok.access_token) throw new Error(`VK обмен кода: ${tok.error ?? tokRes.status} ${tok.error_description ?? ''}`);
  const infoRes = await fetch('https://id.vk.com/oauth2/user_info', {
    method: 'POST',
    body: new URLSearchParams({ client_id: config.vkClientId, access_token: tok.access_token }),
    signal: AbortSignal.timeout(10_000),
  });
  const info = (await infoRes.json()) as { user?: { user_id?: string | number; first_name?: string; email?: string; sex?: number } };
  const u = info.user ?? {};
  return {
    vkId: String(u.user_id ?? tok.user_id ?? ''),
    name: (u.first_name ?? '').trim(),
    email: u.email ? normEmail(u.email) : undefined,
    gender: u.sex === 1 ? ('f' as const) : u.sex === 2 ? ('m' as const) : undefined,
  };
}

/* ---------- маршруты ---------- */

export function registerAuth(app: FastifyInstance, store: Store) {
  const issue = (u: User) => ({ token: signToken(u.id), me: meView(u) });

  /** Шаг 1 регистрации или сброса: отправить код на почту */
  app.post('/auth/email/code', async (req) => {
    const { email, purpose } = z.object({ email: Email, purpose: z.enum(['register', 'reset']) }).parse(req.body);
    const exists = !!(await store.getKey(`email#${email}`));
    if (purpose === 'register' && exists) throw new HttpError(409, 'email_taken', 'Этот адрес уже зарегистрирован — войдите или сбросьте пароль');
    // Для сброса не выдаём, есть ли такой адрес: ответ одинаковый
    const devCode = purpose === 'reset' && !exists ? undefined : await sendCode(store, purpose, email);
    return { ok: true, ...(devCode && { devCode }) };
  });

  /** Шаг 2 регистрации: код + имя + пароль → аккаунт */
  app.post('/auth/register', async (req) => {
    const b = z.object({ email: Email, code: z.string(), name: Name, password: Password }).parse(req.body);
    await checkCode(store, 'register', b.email, b.code);
    const user: User = { id: randomUUID(), name: b.name, email: b.email, passHash: await hashPassword(b.password), createdAt: new Date().toISOString() };
    if (!(await store.claimKey(`email#${b.email}`, user.id))) throw new HttpError(409, 'email_taken', 'Этот адрес уже зарегистрирован');
    await store.putUser(user);
    return issue(user);
  });

  app.post('/auth/login', async (req) => {
    const b = z.object({ email: Email, password: z.string().max(200) }).parse(req.body);
    const id = await store.getKey(`email#${b.email}`);
    const user = id ? await store.getUser(id) : null;
    // Ограничение перебора: 10 неудачных попыток за 15 минут на адрес
    const failKey = `loginfail#${b.email}`;
    const fails = (await store.getTemp<number>(failKey)) ?? 0;
    if (fails >= 10) throw new HttpError(429, 'too_many', 'Слишком много попыток — подождите 15 минут или сбросьте пароль');
    if (!user || !(await verifyPassword(b.password, user.passHash))) {
      await store.putTemp(failKey, fails + 1, 15 * 60);
      throw new HttpError(401, 'bad_credentials', 'Неверная почта или пароль');
    }
    await store.deleteTemp(failKey);
    return issue(user);
  });

  /** Сброс пароля: код из письма + новый пароль → сразу вход */
  app.post('/auth/reset', async (req) => {
    const b = z.object({ email: Email, code: z.string(), password: Password }).parse(req.body);
    await checkCode(store, 'reset', b.email, b.code);
    const id = await store.getKey(`email#${b.email}`);
    const user = id ? await store.getUser(id) : null;
    if (!user) throw new HttpError(400, 'code_expired');
    user.passHash = await hashPassword(b.password);
    await store.putUser(user);
    await store.deleteTemp(`loginfail#${b.email}`);
    return issue(user);
  });

  /** VK ID, шаг 1: браузер уходит на страницу входа VK */
  app.get('/auth/vk/start', async (req, reply: FastifyReply) => {
    if (!config.vkClientId) throw new HttpError(503, 'vk_disabled', 'Вход через VK ещё не настроен');
    const { redirect } = z.object({ redirect: z.string().max(300) }).parse(req.query);
    if (!redirect.startsWith(`${config.appScheme}://`) && !/^exp\+[\w-]+:\/\//.test(redirect)) throw new HttpError(400, 'bad_redirect');
    const state = randomBytes(24).toString('base64url');
    const { verifier, challenge } = pkce();
    await store.putTemp(`vk#${state}`, { verifier, redirect } satisfies VkState, 10 * 60);
    const url = new URL('https://id.vk.com/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.vkClientId,
      redirect_uri: `${config.publicUrl}/auth/vk/callback`,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'email',
    }).toString();
    return reply.redirect(url.toString());
  });

  /** VK ID, шаг 2: VK вернул код — создаём или находим аккаунт и отправляем в приложение с билетом */
  app.get('/auth/vk/callback', async (req, reply: FastifyReply) => {
    const q = req.query as Record<string, string | undefined>;
    const st = q.state ? await store.getTemp<VkState>(`vk#${q.state}`) : null;
    if (!st) return reply.code(400).type('text/html; charset=utf-8').send('<p>Ссылка устарела. Вернитесь в приложение и попробуйте ещё раз.</p>');
    await store.deleteTemp(`vk#${q.state}`);
    const back = (params: Record<string, string>) => reply.redirect(`${st.redirect}${st.redirect.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`);
    if (!q.code || !q.device_id) return back({ error: q.error ?? 'cancelled' });
    try {
      const vk = await vkExchange(q.code, st.verifier, q.device_id, q.state!);
      if (!vk.vkId) throw new Error('VK не вернул id');
      let userId = await store.getKey(`vk#${vk.vkId}`);
      // Та же почта уже зарегистрирована — привязываем VK к этому аккаунту (почта у VK подтверждена)
      if (!userId && vk.email) userId = await store.getKey(`email#${vk.email}`);
      let user = userId ? await store.getUser(userId) : null;
      if (!user) {
        user = { id: randomUUID(), name: vk.name || 'Без имени', gender: vk.gender, createdAt: new Date().toISOString() };
        if (vk.email && (await store.claimKey(`email#${vk.email}`, user.id))) user.email = vk.email;
      }
      if (!user.vkId) {
        user.vkId = vk.vkId;
        await store.claimKey(`vk#${vk.vkId}`, user.id);
      }
      await store.putUser(user);
      const ticket = randomBytes(24).toString('base64url');
      await store.putTemp(`ticket#${ticket}`, user.id, 120);
      return back({ ticket });
    } catch (e) {
      req.log.error(e);
      return back({ error: 'vk_failed' });
    }
  });

  /** VK ID, шаг 3: приложение меняет одноразовый билет на токен */
  app.post('/auth/vk/finish', async (req) => {
    const { ticket } = z.object({ ticket: z.string().max(100) }).parse(req.body);
    const userId = await store.getTemp<string>(`ticket#${ticket}`);
    if (!userId) throw new HttpError(400, 'ticket_expired', 'Попробуйте войти ещё раз');
    await store.deleteTemp(`ticket#${ticket}`);
    const user = await store.getUser(userId);
    if (!user) throw new HttpError(400, 'ticket_expired');
    return issue(user);
  });

  app.get('/me', async (req) => meView(await requireUser(req, store)));

  /** Задать или сменить пароль (например, после входа через VK) */
  app.post('/me/password', async (req) => {
    const user = await requireUser(req, store);
    const b = z.object({ old: z.string().max(200).optional(), password: Password }).parse(req.body);
    if (user.passHash && !(await verifyPassword(b.old ?? '', user.passHash))) throw new HttpError(401, 'bad_credentials', 'Неверный текущий пароль');
    user.passHash = await hashPassword(b.password);
    await store.putUser(user);
    return { ok: true };
  });
}
