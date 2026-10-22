// Моковые данные для этапа дизайна. Будут заменены синхронизацией с сервером.
import { addDays, toISODate } from './dates';
import type { Group, Task, User, WatchItem, Wish } from './types';

const d = (n: number) => toISODate(addDays(new Date(), n));
const ts = (n: number) => addDays(new Date(), n).toISOString();
/** Ближайший день недели (0 — вс, 6 — сб), не раньше сегодня */
const nextDow = (dow: number) => d((dow - new Date().getDay() + 7) % 7);

export const ME: User = { id: 'u1', name: 'Саша', nick: 'саша', gender: 'm' };

export const USERS: User[] = [
  ME,
  { id: 'u2', name: 'Маша', nick: 'masha_k', gender: 'f' },
  { id: 'u3', name: 'Дима', nick: 'дима.п', gender: 'm' },
  { id: 'u4', name: 'Лена', nick: 'lena', gender: 'f' },
  { id: 'u5', name: 'Олег', nick: 'oleg', gender: 'm' },
  { id: 'u6', name: 'Мама', nick: 'мама', gender: 'f' },
];

export const GROUPS: Group[] = [
  { id: 'g1', name: 'Семья', category: 'couple', inviteCode: 'K7P2QX', memberIds: ['u1', 'u2'], ownerId: 'u1', adminIds: [] },
  { id: 'g2', name: 'Друзья', category: 'friends', inviteCode: 'M4ZT9A', memberIds: ['u1', 'u3', 'u4'], ownerId: 'u3', adminIds: ['u1'] },
  { id: 'g3', name: 'Футбол', category: 'friends', inviteCode: 'F8UT6B', memberIds: ['u1', 'u3', 'u5'], ownerId: 'u5', adminIds: [] },
  { id: 'g4', name: 'Родители', category: 'parents', inviteCode: 'R0D1TL', memberIds: ['u1', 'u2', 'u6'], ownerId: 'u6', adminIds: ['u1'] },
];

export const TASKS: Task[] = [
  { id: 't1', groupId: 'g1', title: 'Оплатить интернет', date: d(-2), time: null, createdBy: 'u1', doneAt: null, createdAt: ts(-5) },
  { id: 't2', groupId: 'g1', title: 'Забрать посылку', date: d(0), time: '18:30', createdBy: 'u2', doneAt: null, createdAt: ts(-1) },
  { id: 't3', groupId: 'g1', title: 'Ужин у родителей', date: d(1), time: '19:00', createdBy: 'u1', doneAt: null, createdAt: ts(-2) },
  { id: 't4', groupId: 'g1', title: 'Поездка на дачу', date: d(8), time: null, note: 'Взять мангал и удочки. Выезжаем в 9 утра от дома.', createdBy: 'u2', doneAt: null, createdAt: ts(-3) },
  { id: 't5', groupId: 'g1', title: 'Забрать документы', date: d(14), time: null, createdBy: 'u1', doneAt: null, createdAt: ts(-1) },
  { id: 't6', groupId: 'g1', title: 'Позвонить в управляющую компанию', date: null, time: null, createdBy: 'u1', doneAt: null, createdAt: ts(-4) },
  { id: 't7', groupId: 'g1', title: 'Купить лампочки', date: null, time: null, createdBy: 'u2', doneAt: null, createdAt: ts(-6) },
  { id: 't8', groupId: 'g1', title: 'Записаться к стоматологу', date: d(-1), time: '10:00', createdBy: 'u2', doneAt: ts(-1), createdAt: ts(-7) },
  { id: 't9', groupId: 'g2', title: 'Боулинг', date: d(2), time: '20:00', createdBy: 'u3', doneAt: null, createdAt: ts(-1) },
  { id: 't10', groupId: 'g2', title: 'День рождения Лены', date: d(21), time: null, createdBy: 'u3', doneAt: null, createdAt: ts(-2) },
  // Ближайшие выходные — чтобы было что спросить у ассистента
  { id: 't11', groupId: 'g2', title: 'Шашлыки у Димы', date: nextDow(6), time: '14:00', createdBy: 'u3', doneAt: null, createdAt: ts(-1) },
  { id: 't12', groupId: 'g3', title: 'Игра в футбол', date: nextDow(0), time: '11:00', createdBy: 'u5', doneAt: null, createdAt: ts(-2) },
  { id: 't13', groupId: 'g1', title: 'Кино вдвоём', date: nextDow(6), time: '21:00', createdBy: 'u2', doneAt: null, createdAt: ts(-1) },
  { id: 't14', groupId: 'g4', title: 'Обед у мамы', date: nextDow(0), time: '13:00', note: 'Привезти торт', createdBy: 'u6', doneAt: null, createdAt: ts(-2) },
];

export const WISHES: Wish[] = [
  { id: 'w1', ownerId: 'u1', title: 'Новые наушники', note: '', link: '', receivedAt: null, createdAt: ts(-3) },
  { id: 'w2', ownerId: 'u1', title: 'Кроссовки New Balance 574', note: 'размер 42, серые', link: 'https://www.newbalance.com', receivedAt: null, createdAt: ts(-2) },
  { id: 'w3', ownerId: 'u2', title: 'Кофемолка', note: 'ручная, керамические жернова', link: '', receivedAt: null, createdAt: ts(-4) },
  { id: 'w4', ownerId: 'u2', title: 'Абонемент в бассейн', note: '', link: '', receivedAt: null, createdAt: ts(-2) },
  { id: 'w5', ownerId: 'u2', title: 'Книга «Мастер и Маргарита»', note: 'подарочное издание', link: 'https://example.com', receivedAt: null, createdAt: ts(-1) },
  { id: 'w6', ownerId: 'u3', title: 'Настольная игра Каркассон', note: '', link: '', receivedAt: null, createdAt: ts(-1) },
];

export const WATCH: WatchItem[] = [
  { id: 'm1', groupId: 'g1', title: 'Интерстеллар', kind: 'movie', genres: ['scifi', 'drama'], origin: 'foreign', year: 2014, addedBy: 'u1', watchedAt: null, createdAt: ts(-1) },
  { id: 'm2', groupId: 'g1', title: 'Слово пацана', kind: 'series', genres: ['drama'], origin: 'ru', year: 2023, addedBy: 'u2', watchedAt: null, createdAt: ts(-2) },
  { id: 'm3', groupId: 'g1', title: 'Тед Лассо', kind: 'series', genres: ['comedy', 'drama'], origin: 'foreign', year: 2020, addedBy: 'u2', watchedAt: null, createdAt: ts(-3) },
  { id: 'm4', groupId: 'g1', title: 'Шрэк', kind: 'cartoon', genres: ['comedy', 'adventure'], origin: 'foreign', year: 2001, addedBy: 'u1', watchedAt: null, createdAt: ts(-4) },
  { id: 'm5', groupId: 'g1', title: 'Ирония судьбы', kind: 'movie', genres: ['comedy', 'romance'], origin: 'ru', year: 1975, addedBy: 'u2', watchedAt: null, createdAt: ts(-5) },
  { id: 'm6', groupId: 'g1', title: 'Сёгун', kind: 'series', genres: ['drama', 'adventure'], origin: 'foreign', year: new Date().getFullYear() - 1, addedBy: 'u1', watchedAt: null, createdAt: ts(-6) },
  { id: 'm7', groupId: 'g1', title: 'Какая-то новинка', kind: null, genres: [], origin: null, year: null, addedBy: 'u1', watchedAt: null, createdAt: ts(-7) },
  { id: 'm8', groupId: 'g1', title: 'Оппенгеймер', kind: 'movie', genres: ['drama'], origin: 'foreign', year: 2023, addedBy: 'u2', watchedAt: ts(-3), createdAt: ts(-10) },
  { id: 'm9', groupId: 'g2', title: 'Джентльмены', kind: 'movie', genres: ['comedy', 'action'], origin: 'foreign', year: 2019, addedBy: 'u3', watchedAt: null, createdAt: ts(-1) },
];

// Один уже подаренный пункт — чтобы было видно блок «Подарили»
WISHES.push({ id: 'w7', ownerId: 'u1', title: 'Термокружка', note: '', link: '', receivedAt: ts(-10), createdAt: ts(-30) });
WISHES.push(
  { id: 'w8', ownerId: 'u1', title: 'Походный рюкзак', note: '40–50 литров', link: '', receivedAt: null, createdAt: ts(-2) },
  { id: 'w9', ownerId: 'u4', title: 'Сертификат в книжный', note: '', link: '', receivedAt: null, createdAt: ts(-3) },
);
