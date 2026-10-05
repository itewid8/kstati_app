/**
 * Надёжность пароля: 0 — ненадёжный, 1 — средний, 2 — надёжный.
 * Считаем длину и разнообразие символов, штрафуем повторы, последовательности («1234», «abcd», «qwerty»)
 * и пароли из списка самых частых. Имя и почта человека внутри пароля тоже делают его ненадёжным.
 */
export type Strength = 0 | 1 | 2;

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344', '12121212',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty12', 'qwerty123', 'qwertyui', 'qwertyuiop',
  'asdfghjk', 'zxcvbnm1', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'qazwsxedc', 'iloveyou', 'admin123', 'welcome1',
  'sunshine', 'football', 'baseball', 'princess', 'dragon12', 'monkey12', 'letmein1', 'abc12345', 'abcd1234',
  'пароль', 'пароль123', 'йцукен', 'йцукенгш', 'йцукенгшщз', 'фывапрол', 'ячсмитьб', 'любовь', 'привет123',
]);

/** Ряды клавиатуры и алфавиты — для поиска последовательностей вроде «qwer», «4321», «абвг» */
const RUNS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];

/** Доля символов, входящих в последовательности длиной от 4 (в любую сторону) */
function runShare(pw: string): number {
  const s = pw.toLowerCase();
  const marked = new Array<boolean>(s.length).fill(false);
  for (let i = 0; i + 4 <= s.length; i++) {
    const chunk = s.slice(i, i + 4);
    const back = [...chunk].reverse().join('');
    if (RUNS.some((r) => r.includes(chunk) || r.includes(back))) for (let j = i; j < i + 4; j++) marked[j] = true;
  }
  return marked.filter(Boolean).length / Math.max(1, s.length);
}

/** Доля символов, повторяющих предыдущий («aaaa», «1111») */
function repeatShare(pw: string): number {
  let n = 0;
  for (let i = 1; i < pw.length; i++) if (pw[i] === pw[i - 1]) n++;
  return n / Math.max(1, pw.length);
}

export function passwordStrength(pw: string, personal: string[] = []): Strength {
  if (pw.length < 8) return 0;
  const low = pw.toLowerCase();
  if (COMMON.has(low) || new Set(low).size <= 2) return 0;
  // Имя или начало почты внутри пароля
  if (personal.some((p) => p.length >= 3 && low.includes(p.toLowerCase()))) return 0;

  const classes = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^A-Za-zА-Яа-яЁё\d]/].filter((re) => re.test(pw)).length;
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (runShare(pw) > 0.5 || repeatShare(pw) > 0.3) score -= 2;
  else if (runShare(pw) > 0.25) score--;

  if (score >= 4 || (score >= 3 && pw.length >= 12)) return 2;
  return score >= 1 ? 1 : 0;
}

export const STRENGTH_LABEL: Record<Strength, string> = { 0: 'Ненадёжный', 1: 'Средний', 2: 'Надёжный' };
