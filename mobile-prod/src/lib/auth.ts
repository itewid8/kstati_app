/**
 * Вход: почта с паролем (регистрация и сброс — по коду из письма) и VK ID.
 * Успешный вход кладёт токен в хранилище (signIn), дальше данные приходят синхронизацией.
 */
import * as Linking from 'expo-linking';
import { uuid } from 'expo-modules-core';
import * as WebBrowser from 'expo-web-browser';
import { API_URL } from './config';
import { ApiError, errorText, request } from './net';
import { challengeS256 } from './pkce';
import { useStore, type Me } from './store';

export type AuthResult = { ok: true } | { ok: false; error: string };
type Session = { token: string; me: Me };

const done = (s: Session): AuthResult => {
  useStore.getState().signIn(s.token, s.me);
  return { ok: true };
};
const failed = (e: unknown): AuthResult => ({ ok: false, error: errorText(e) });

/** Код на почту. devCode приходит только с сервера на Mac без настроенной почты */
export async function sendCode(email: string, purpose: 'register' | 'reset'): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  try {
    const r = await request<{ devCode?: string }>('/auth/email/code', { body: { email, purpose } });
    return { ok: true, devCode: r.devCode };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}

/** Проверить код до ввода пароля: код не гасится, его потом предъявляют при регистрации или сбросе */
export async function verifyCode(email: string, purpose: 'register' | 'reset', code: string): Promise<{ ok: true } | { ok: false; error: string; expired: boolean }> {
  try {
    await request('/auth/email/verify', { body: { email, purpose, code } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e), expired: e instanceof ApiError && e.code === 'code_expired' };
  }
}

export async function register(p: { email: string; code: string; name: string; password: string }): Promise<AuthResult> {
  try {
    return done(await request<Session>('/auth/register', { body: p }));
  } catch (e) {
    return failed(e);
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    return done(await request<Session>('/auth/login', { body: { email, password } }));
  } catch (e) {
    return failed(e);
  }
}

export async function resetPassword(p: { email: string; code: string; password: string }): Promise<AuthResult> {
  try {
    return done(await request<Session>('/auth/reset', { body: p }));
  } catch (e) {
    return failed(e);
  }
}

/** Случайная hex-строка из n UUID v4 (122 случайных бита в каждом): их делает система — SecureRandom / arc4random */
const randomHex = (n: number) => Array.from({ length: n }, () => uuid.v4().replace(/-/g, '')).join('');

/**
 * VK ID: открываем страницу входа VK во встроенном браузере. Сервер после входа возвращает
 * в приложение по адресу kstati://auth?state=…&ticket=…, билет меняем на токен.
 * Адрес kstati:// может перехватить чужое приложение, поэтому вход привязан к этому запуску (PKCE):
 * на сервер уходит только SHA-256 от code_verifier, а сам он предъявляется лишь в /auth/vk/finish.
 */
export async function loginWithVk(): Promise<AuthResult | { ok: false; error: '' }> {
  const failedVk = 'Не удалось войти через VK. Попробуйте ещё раз.';
  const verifier = randomHex(2);
  const state = randomHex(1);
  const redirect = Linking.createURL('auth');
  const url =
    `${API_URL}/auth/vk/start?redirect=${encodeURIComponent(redirect)}` +
    `&state=${state}&code_challenge=${challengeS256(verifier)}&code_challenge_method=S256`;
  const res = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (res.type !== 'success') return { ok: false, error: '' }; // закрыли окно — молча
  const params = new URL(res.url.replace(/^[\w+.-]+:\/\/?/, 'https://x/')).searchParams;
  // Ответ не на этот вход (например, чужая ссылка kstati://auth?ticket=…, пока открыт браузер) — не принимаем
  if (params.get('state') !== state) return { ok: false, error: failedVk };
  const ticket = params.get('ticket');
  if (!ticket) return { ok: false, error: params.get('error') === 'cancelled' ? '' : failedVk };
  try {
    return done(await request<Session>('/auth/vk/finish', { body: { ticket, code_verifier: verifier } }));
  } catch (e) {
    return failed(e);
  }
}
