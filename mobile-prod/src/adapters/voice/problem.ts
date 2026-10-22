/**
 * Окно ошибки голосовой команды (макета нет): только сама причина и действие — «ЕЩЁ РАЗ» или «ОТКРЫТЬ НАСТРОЙКИ».
 * Лимит команд на день — без повтора: текст «Лимит на сегодня: 30 из 30» (GET /voice/quota).
 * Не понял, не нашёл, нет связи, сбой сервера — ещё и «ДОБАВИТЬ»: записать сказанное вручную (как в старом окне).
 */

export type VoiceProblem = 'notUnderstood' | 'silence' | 'unknownPerson' | 'notFound' | 'offline' | 'server' | 'micDenied' | 'info';

/** Карточка ошибки в хранилище (Card с problem) */
export type ProblemCard = { transcript: string; problem: VoiceProblem; person?: string; query?: string; detail?: string };

/** detail у карточки info: лимит голосовых команд на сегодня исчерпан */
export const QUOTA_DETAIL = 'quota';

export type ProblemAction = 'retry' | 'settings' | null;

/** «ДОБАВИТЬ»: меню типов записи с заголовком prompt, название новой записи — title */
export type ProblemAdd = { prompt: string; title: string };

export type ProblemSheetData = {
  /** Что сказали (без кавычек); пусто — запись не распознана */
  phrase: string;
  /** Причина одной строкой */
  text: string;
  /** Главная кнопка: ЕЩЁ РАЗ, ОТКРЫТЬ НАСТРОЙКИ или только ЗАКРЫТЬ */
  action: ProblemAction;
  /** Вторая кнопка «ДОБАВИТЬ»; нет — нечего добавлять */
  add?: ProblemAdd;
};

/** «купить хлеб» → «Купить хлеб» */
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Лимит на сегодня: 30 из 30»; счётчик неизвестен — текст сервера */
export function quotaText(q: { limit: number; used: number } | null, fallback?: string): string {
  if (q) return `Лимит на сегодня: ${Math.min(q.used, q.limit)} из ${q.limit}`;
  return fallback?.trim() || 'Лимит на сегодня исчерпан';
}

const TEXT: Record<Exclude<VoiceProblem, 'unknownPerson' | 'notFound' | 'info'>, string> = {
  notUnderstood: 'Не понял',
  silence: 'Не расслышал',
  offline: 'Нет связи',
  server: 'Не получилось',
  micDenied: 'Нет доступа к микрофону',
};

export function problemSheet(card: ProblemCard): ProblemSheetData {
  const phrase = card.transcript.trim();
  switch (card.problem) {
    case 'unknownPerson':
      return { phrase, text: `Не нашёл человека «${card.person?.trim() || '?'}»`, action: 'retry' };
    case 'notFound': {
      const query = card.query?.trim() ?? '';
      return {
        phrase,
        text: query ? `Не нашёл «${query}»` : 'Не нашёл',
        action: 'retry',
        add: { prompt: 'Добавить вручную', title: upperFirst(query || phrase) },
      };
    }
    case 'info':
      return { phrase, text: card.query?.trim() || TEXT.server, action: card.detail === QUOTA_DETAIL ? null : 'retry' };
    case 'micDenied':
      return { phrase, text: TEXT.micDenied, action: 'settings' };
    case 'notUnderstood':
      return { phrase, text: TEXT.notUnderstood, action: 'retry', add: { prompt: 'Добавить как…', title: upperFirst(phrase) } };
    case 'offline':
    case 'server':
      return { phrase, text: TEXT[card.problem], action: 'retry', add: { prompt: 'Добавить вручную', title: upperFirst(phrase) } };
    default:
      return { phrase, text: TEXT[card.problem], action: 'retry' };
  }
}
