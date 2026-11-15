/**
 * Голос и связи записей: «привяжи список продуктов к ужину», «что нужно купить?», «что я покупал на свадьбу?».
 * Запись ищем сами по словам фразы и по связям из контекста — модели достаточно понять вид вопроса
 * (а простые формулировки разбирают правила ниже, без модели).
 */
import { sameStem, spokenPeriod, titleStems } from './spoken.js';
import type { Context, ParseResult, RefLite } from './types.js';

type Rec = { ref: RefLite; title: string; date: string | null };
type Raw = { intent: string } & Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const DAY = 86_400_000;

/** Все записи контекста: дела, фильмы, хотелки, темы и заметки */
function records(ctx: Context): Rec[] {
  const ex = ctx.existing;
  return [
    ...ex.tasks.map((t) => ({ ref: { type: 'task' as const, id: t.id }, title: t.title, date: t.date })),
    ...ex.watch.map((w) => ({ ref: { type: 'watch' as const, id: w.id }, title: w.title, date: null })),
    ...ex.wishes.map((w) => ({ ref: { type: 'wish' as const, id: w.id }, title: w.title, date: null })),
    ...(ctx.topics ?? []).map((t) => ({ ref: { type: 'note' as const, id: t.id }, title: t.title, date: null })),
    ...(ex.ideas ?? []).map((i) => ({ ref: { type: 'note' as const, id: i.id }, title: i.text.split('\n')[0]!.replace(/^#\s*/, ''), date: null })),
  ];
}

/** Сколько слов названия прозвучало */
const score = (title: string, said: string[]) => titleStems(title).filter((w) => said.some((x) => sameStem(w, x))).length;

/** Связанное с записью (по связям контекста) */
export function linkedOf(ref: RefLite, ctx: Context): RefLite[] {
  const out: RefLite[] = [];
  for (const l of ctx.links ?? []) {
    const other = l.a.id === ref.id ? l.b : l.b.id === ref.id ? l.a : null;
    if (other && !out.some((x) => x.id === other.id)) out.push(other);
  }
  return out;
}

/** Запись по id или по названию (лучшее совпадение слов); не нашлось — null */
export function findRecord(name: string, ctx: Context): Rec | null {
  const all = records(ctx);
  const byId = all.find((r) => r.ref.id === name.replace(/^(task|watch|wish|idea|topic|note):/, ''));
  if (byId) return byId;
  const said = titleStems(name);
  if (!said.length) return null;
  let best: Rec | null = null;
  let bestScore = 0;
  for (const r of all) {
    const sc = score(r.title, said);
    if (sc > bestScore) [best, bestScore] = [r, sc];
  }
  return best;
}

/**
 * Вопрос через связи. about — о какой записи спросили (пусто — не сказали): ищем по словам, из нескольких —
 * ту, что в названном периоде, иначе ближайшую по времени к сегодня. Не сказали — ближайшее предстоящее дело,
 * с которым связано искомое (нет — последнее прошедшее). want — что ищут: note — списки и заметки («купить»)
 */
export function queryLinked(about: string, want: RefLite['type'] | null, ctx: Context, transcript: string): ParseResult {
  const today = Date.parse(ctx.today);
  const period = spokenPeriod(transcript, ctx.today);
  const has = (r: Rec) => linkedOf(r.ref, ctx).some((x) => !want || x.type === want);
  const dist = (r: Rec) => {
    if (!r.date) return 10_000;
    const d = (Date.parse(r.date) - today) / DAY;
    if (period && r.date >= period.from && r.date <= period.to) return -1;
    // Предстоящее чуть ближе прошедшего на то же число дней
    return d >= 0 ? d : -d + 0.5;
  };
  let anchor: Rec | null = null;
  if (about) {
    const said = titleStems(about);
    const hits = records(ctx)
      .map((r) => ({ r, sc: score(r.title, said) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc || Number(has(b.r)) - Number(has(a.r)) || Number(b.r.ref.type === 'task') - Number(a.r.ref.type === 'task') || dist(a.r) - dist(b.r));
    anchor = hits[0]?.r ?? null;
    if (!anchor) return { type: 'notFound', query: about };
  } else {
    const tasks = records(ctx).filter((r) => r.ref.type === 'task' && has(r));
    const future = tasks.filter((r) => r.date && r.date >= ctx.today).sort((a, b) => a.date!.localeCompare(b.date!));
    const past = tasks.filter((r) => !r.date || r.date < ctx.today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    anchor = (period ? tasks.find((r) => r.date && r.date >= period.from && r.date <= period.to) : null) ?? future[0] ?? past[0] ?? null;
    if (!anchor) return { type: 'notFound', query: want === 'note' ? 'список покупок к делу' : 'связанные записи' };
  }
  const all = linkedOf(anchor.ref, ctx);
  const wanted = want ? all.filter((x) => x.type === want) : all;
  return { type: 'queryLinked', anchor: anchor.ref, items: wanted.length ? wanted : all, want };
}

/** «Привяжи A к B»: обе записи по названию или id; одинаковый вид или не нашлось — notFound */
export function linkPair(a: string, b: string, ctx: Context): ParseResult {
  const ra = findRecord(a, ctx);
  const rb = findRecord(b, ctx);
  if (!ra) return { type: 'notFound', query: a };
  if (!rb) return { type: 'notFound', query: b };
  if (ra.ref.type === rb.ref.type) return { type: 'notFound', query: `${a} и ${b}` };
  return { type: 'link', a: ra.ref, b: rb.ref };
}

const WANT: Record<string, RefLite['type']> = { note: 'note', idea: 'note', list: 'note', task: 'task', watch: 'watch', wish: 'wish' };
export const wantOf = (v: unknown): RefLite['type'] | null => WANT[str(v)] ?? null;

/**
 * Простые формулировки — без модели (своя модель этих вопросов ещё не знает):
 *   «привяжи список продуктов к ужину», «свяжи Дюну с заметкой про кино»;
 *   «что нужно купить», «что купить к ужину в субботу», «что взять в поход»;
 *   «что я покупал на свадьбу», «что мы брали в поход»;
 *   «что связано с ужином», «покажи список к ужину»
 */
export function linkRules(text: string): Raw[] | null {
  const t = text.toLowerCase().replace(/ё/g, 'е').replace(/[?!.]+$/, '').trim();
  let m = /^(?:привяжи|свяжи|прикрепи|соедини)\s+(.+?)\s+(?:к|с|со)\s+(.+)$/.exec(t);
  if (m) return [{ intent: 'link', a: m[1], b: m[2] }];
  m = /^(?:а\s+)?(?:что|чего)\s+(?:(?:мне|нам)\s+)?(?:еще\s+)?(?:нужно|надо|осталось|не хватает)?\s*(?:купить|докупить|взять|приготовить)(?:\s+(?:к|на|для|в|с собой в|с собой на)\s+(.+))?$/.exec(t);
  if (m) return [{ intent: 'query_linked', about: m[1] ?? '', want: 'note' }];
  m = /^(?:а\s+)?что\s+(?:я|мы)\s+(?:покупал[аи]?|брал[аи]?|готовил[аи]?|заказывал[аи]?)\s+(?:к|на|для|в)\s+(.+)$/.exec(t);
  if (m) return [{ intent: 'query_linked', about: m[1], want: 'note' }];
  m = /^(?:что\s+(?:связано|прикреплено|привязано)\s+(?:с|со|к)|покажи\s+(?:список|списки|связанное|заметки?)\s+(?:к|для|на))\s+(.+)$/.exec(t);
  if (m) return [{ intent: 'query_linked', about: m[1], want: /^покажи\s+списк/.test(t) ? 'note' : null }];
  return null;
}

/** Ответ модели или правил с intent link / query_linked → результат; нет таких — null */
export function normalizeLinks(actions: Raw[], ctx: Context, transcript: string): ParseResult | null {
  const lk = actions.find((a) => a.intent === 'link');
  if (lk) {
    const ids = Array.isArray(lk.target) ? lk.target.map(String) : [];
    return linkPair(str(lk.a) || ids[0] || '', str(lk.b) || ids[1] || str(lk.with), ctx);
  }
  const ql = actions.find((a) => a.intent === 'query_linked');
  if (ql) return queryLinked(str(ql.about), wantOf(ql.want), ctx, transcript);
  return null;
}
