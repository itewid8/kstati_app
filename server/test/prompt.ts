/**
 * Компактный промпт (src/prompt.ts): нужные части правил на месте, лишних нет, промпт заметно короче полного.
 */
import assert from 'node:assert/strict';
import { checkTarget, normalize, onlyFiller, worthFullRetry } from '../src/parse.js';
import { buildCompactMessages, buildMessages, pickBlocks } from '../src/prompt.js';
import { cleanSpeech } from '../src/spoken.js';
import type { Context } from '../src/types.js';

const ctx: Context = {
  today: '2026-09-25',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u7', name: 'Карина' }],
  groups: [{ name: 'Друзья', category: 'friends' }],
  topics: [{ id: 'p1', title: 'Список продуктов', body: '- [ ] Молоко\n- [ ] Хлеб' }],
  existing: {
    tasks: [
      { id: 't3', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' },
      { id: 't9', title: 'Поездка в Питер', date: '2026-10-07', time: null, endDate: '2026-10-09' },
      ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, title: `Дело номер ${i}`, date: null, time: null })),
    ],
    watch: [{ id: 'm1', title: 'Интерстеллар' }],
    wishes: [{ id: 'w1', title: 'Новые наушники' }],
  },
};

const blocks = (p: string) => [...pickBlocks(p, ctx).blocks].sort().join(',');
assert.equal(blocks('Добавь Дюну и Аватар'), 'task,watch,wish');
assert.equal(blocks('Перенеси ужин на восемь'), 'change,task');
assert.equal(blocks('Мы посмотрели Интерстеллар'), 'change,task,watch');
assert.equal(blocks('Мне подарили наушники'), 'change,task,wish');
assert.equal(blocks('Что посмотрим?'), 'qwatch');
assert.equal(blocks('Что подарить Маше?'), 'qwish');
assert.equal(blocks('Какие у нас планы на выходные?'), 'plans');
assert.match(blocks('Запиши идею: виджет с погодой'), /ideas/);
assert.match(blocks('Добавь в список продуктов сыр'), /ideas/);
assert.match(blocks('В поездку в Питер добавь Эрмитаж в пятницу'), /parent/);

let full = 0;
let compact = 0;
for (const p of ['Добавь Дюну и Аватар', 'Перенеси ужин на восемь', 'Что посмотрим?', 'Мы с Кариной едем в Питер с 7 по 9 октября', 'Какие у нас планы на выходные?', 'Запиши идею: виджет с погодой']) {
  const [fs, fu] = buildMessages(p, ctx);
  const [cs, cu] = buildCompactMessages(p, ctx);
  full += fs.text.length + fu.text.length;
  compact += cs.text.length + cu.text.length;
  assert.ok(cs.text.includes('"intent":"unknown"'), 'правило «непонятно» есть всегда');
}
// «Перенеси ужин»: правила правок и только похожие записи
const [cs, cu] = buildCompactMessages('Перенеси ужин на восемь', ctx);
assert.match(cs.text, /update \/ mark \/ unmark \/ delete — только при глаголе/);
assert.doesNotMatch(cs.text, /query_plans/);
assert.match(cu.text, /task:t3 \| Ужин у родителей/);
assert.doesNotMatch(cu.text, /Дело номер/);
// «Добавь Дюну»: без записей, календаря и тем
const [, du] = buildCompactMessages('Добавь Дюну и Аватар', ctx);
assert.doesNotMatch(du.text, /Существующие записи|Дни:|Мои темы/);
assert.ok(compact < full * 0.6, `компактный ${compact} против полного ${full}`);
// «Перенеси стоматолога на пятницу на два» — день берём из «на пятницу», а не из последнего «на два» (eval 01.11)
{
  const c2 = { ...ctx, existing: { ...ctx.existing, tasks: [{ id: 't6', title: 'Стоматолог', date: '2026-09-29', time: '10:00' }] } };
  const r = normalize([{ intent: 'update', target: ['t6'], date: '2026-09-25', time: '14:00', people: ['Карина'], query: 'стоматолог' }] as never, c2, 'Перенеси стоматолога на пятницу на два и добавь Карину');
  assert.equal(r.type, 'changes');
  if (r.type === 'changes') assert.equal(r.changes[0].patch?.date, '2026-10-02');
}
// «Купить молоко» при теме со списком продуктов — дело: правил заметок нет (пункт темы — только с глаголом правки)
{
  const c3 = { ...ctx, topics: [{ id: 'p1', title: 'Покупки', body: '- [ ] Молоко' }] };
  assert.doesNotMatch([...pickBlocks('Завтра купить молоко', c3).blocks].join(), /ideas/);
  assert.match([...pickBlocks('Молоко купил', c3).blocks].join(), /ideas/);
}
// Дни — одной строкой на две недели вперёд, без таблицы на 5 недель
{
  const [, u] = buildCompactMessages('Перенеси ужин на субботу', ctx);
  assert.match(u.text, /Дни: сб 2026-09-26, вс 2026-09-27,/);
  assert.equal((u.text.match(/\d{4}-\d{2}-\d{2}/g) ?? []).length, 1 + 14 + 1, 'сегодня + 14 дней + дело с датой');
}
// Чьи планы: модель перепутала scope — сервер верит category; названная группа — groups (eval 05.11)
{
  const g = { ...ctx, groups: [{ name: 'Семья', category: 'couple' as const }, { name: 'Футбол', category: 'friends' as const }] };
  const q = (raw: Record<string, unknown>, phrase: string) => {
    const r = normalize([{ intent: 'query_plans', from: '2026-09-26', to: '2026-09-27', query: '', ...raw }] as never, g, phrase);
    return r.type === 'queryPlans' ? r.plans.scope : null;
  };
  assert.deepEqual(q({ scope: 'people', category: 'friends' }, 'Какие у наших друзей планы на выходные?'), { kind: 'category', category: 'friends' });
  assert.deepEqual(q({ scope: 'people', category: 'friends' }, 'Что у нас в Футболе в воскресенье?'), { kind: 'groups', names: ['Футбол'] });
  assert.deepEqual(q({ scope: 'us' }, 'Что у нас в семье на выходных?'), { kind: 'us' }, '«Семья» — общее слово, не группа');
  assert.deepEqual(q({ scope: 'people', people: ['Карина'] }, 'Что у нас с Кариной в Футболе?'), { kind: 'people', names: ['Карина'] }, 'названы люди — люди');
}
// «Какой-нибудь наш старый фильм»: модель пропустила kind — «фильм» во фразе (eval 05.11)
{
  const r = normalize([{ intent: 'query_watch', origin: ['ru'], fresh: ['old'] }] as never, ctx, 'Какой-нибудь наш старый фильм');
  assert.deepEqual(r.type === 'queryWatch' ? r.filters : null, { kind: ['movie'], genre: [], origin: ['ru'], fresh: ['old'] });
}
// «Что бы сегодня посмотреть?» — выбор фильма, а не планы на сегодня (баг 08.11)
{
  assert.equal(blocks('Что бы сегодня посмотреть?'), 'qwatch');
  assert.equal(blocks('Что глянем в субботу вечером?'), 'qwatch');
  assert.equal(blocks('Что посмотреть с Кариной завтра?'), 'qwatch');
  assert.match(blocks('Что у нас сегодня?'), /plans/);
  assert.match(blocks('Посмотри, какие у нас планы на выходные'), /plans/);
  assert.match(blocks('Что я делаю в субботу? Хочу посмотреть кино'), /plans/);
  const r = normalize([{ intent: 'query_plans', scope: 'us', from: '2026-11-07', to: '2026-11-08', query: '' }] as never, ctx, 'Что бы сегодня посмотреть?');
  assert.equal(r.type, 'queryWatch', 'модель ответила планами — поправили на «Смотреть»');
  const r2 = normalize([{ intent: 'query_plans', scope: 'us', from: '2026-11-07', to: '2026-11-08', query: '' }] as never, ctx, 'Что у нас на выходных?');
  assert.equal(r2.type, 'queryPlans', 'настоящий вопрос о планах не трогаем');
  const r3 = normalize([{ intent: 'query_watch', genre: ['comedy'] }] as never, ctx, 'Что бы сегодня посмотреть смешное?');
  assert.deepEqual(r3.type === 'queryWatch' ? r3.filters.genre : null, ['comedy'], 'фильтры модели сохраняются');
}
// Вопросы о прошлом: прошлые выходные, неделю назад, вчера — прошедшие даты, а не ближайшие будущие
{
  const { spokenPeriod } = await import('../src/spoken.js');
  const sp = (text: string, today: string) => spokenPeriod(text, today);
  const p = (from: string, to = from) => ({ from, to });
  // Воскресенье 08.11: «прошлые выходные» — неделей раньше, не сегодняшние
  assert.deepEqual(sp('Что я делал на прошлых выходных?', '2026-11-08'), p('2026-10-31', '2026-11-01'));
  assert.deepEqual(sp('Что я делал на прошлых выходных?', '2026-11-09'), p('2026-11-07', '2026-11-08'));
  assert.deepEqual(sp('Что мы делали на выходных?', '2026-11-11'), p('2026-11-07', '2026-11-08'));
  assert.deepEqual(sp('Что у нас на выходных?', '2026-11-11'), p('2026-11-14', '2026-11-15'), 'будущее не трогаем');
  assert.deepEqual(sp('Что я делал неделю назад?', '2026-11-11'), p('2026-11-02', '2026-11-08'), 'та неделя целиком');
  assert.deepEqual(sp('Что было две недели назад', '2026-11-11'), p('2026-10-26', '2026-11-01'));
  assert.deepEqual(sp('Что я делал 3 дня назад', '2026-11-11'), p('2026-11-08'));
  assert.deepEqual(sp('Что было месяц назад', '2026-11-11'), p('2026-10-01', '2026-10-31'));
  assert.deepEqual(sp('Что было месяц назад', '2026-03-31'), p('2026-02-01', '2026-02-28'), '31-е в коротком месяце');
  assert.deepEqual(sp('Что я делал вчера', '2026-11-11'), p('2026-11-10'));
  assert.deepEqual(sp('что было позавчера', '2026-11-11'), p('2026-11-09'));
  assert.deepEqual(sp('Что было на прошлой неделе', '2026-11-11'), p('2026-11-02', '2026-11-08'));
  assert.deepEqual(sp('Что было на позапрошлой неделе', '2026-11-11'), p('2026-10-26', '2026-11-01'));
  assert.deepEqual(sp('Что я делал в прошлую субботу', '2026-11-11'), p('2026-11-07'));
  assert.deepEqual(sp('Что я делал в субботу', '2026-11-11'), p('2026-11-07'), 'прошедшее время — прошедшая суббота');
  assert.deepEqual(sp('Что у нас в субботу', '2026-11-11'), p('2026-11-14'));
  assert.deepEqual(sp('Что было 3 октября', '2026-11-11'), p('2026-10-03'));
  assert.deepEqual(sp('Ужин 3 октября', '2026-11-11'), p('2027-10-03'), 'новое дело — ближайшее будущее');
  assert.deepEqual(sp('Что было в прошлом месяце', '2026-11-11'), p('2026-10-01', '2026-10-31'));
  assert.deepEqual(sp('Что я делал на этой неделе', '2026-11-11'), p('2026-11-09', '2026-11-11'));
  assert.deepEqual(sp('Что у нас на этой неделе', '2026-11-11'), p('2026-11-11', '2026-11-15'));
  assert.match(blocks('Что я делал вчера?'), /plans/);
  const r = normalize([{ intent: 'query_plans', scope: 'me', from: '2026-09-26', to: '2026-09-27', query: '' }] as never, ctx, 'Что я делал на прошлых выходных?');
  assert.deepEqual(r.type === 'queryPlans' ? [r.plans.from, r.plans.to] : null, ['2026-09-19', '2026-09-20'], 'модель дала текущие — берём прошлые');
}
// Повтор полным промптом — только для настоящих фраз
assert.equal(worthFullRetry('э', { attempts: 1, raw: '' }), false);
assert.equal(worthFullRetry('так это', { attempts: 1, raw: '' }), false);
assert.equal(worthFullRetry('позвонить в банк про кредит', { attempts: 1, raw: '' }), true);
assert.equal(worthFullRetry('позвонить в банк про кредит', { attempts: 2, raw: '' }), false, 'модель дважды не дала JSON');
// Расход: токены из кэша считаются по своей цене; Alice AI LLM Flash — через OpenAI-совместимый API
{
  const { costOf } = await import('../src/log.js');
  assert.equal(costOf({ input: 1000, output: 0, total: 1000 }, 'yandexgpt-lite/latest'), 0.2);
  assert.equal(costOf({ input: 1000, output: 100, total: 1100, cached: 800 }, 'aliceai-llm-flash/latest'), 0.06, '200×0.1 + 800×0.025 + 100×0.2');
  const { complete } = await import('../src/yandex.js');
  const real = globalThis.fetch;
  let url = '';
  let body: { model?: string; response_format?: unknown; messages?: { role: string; content: string }[] } = {};
  globalThis.fetch = (async (u: string, init: { body: string }) => {
    url = String(u);
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"actions":[]}' } }], usage: { prompt_tokens: 900, completion_tokens: 12, total_tokens: 912, prompt_tokens_details: { cached_tokens: 768 } } }));
  }) as typeof fetch;
  try {
    const r = await complete([{ role: 'system', text: 'правила' }, { role: 'user', text: 'фраза' }], 'aliceai-llm-flash/latest');
    assert.match(url, /\/v1\/chat\/completions$/);
    assert.match(body.model ?? '', /^gpt:\/\/.*\/aliceai-llm-flash\/latest$/);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.messages?.[0], { role: 'system', content: 'правила' });
    assert.deepEqual(r, { text: '{"actions":[]}', usage: { input: 900, output: 12, total: 912, cached: 768 } });
    // Своя модель (LLM_BASE_URL): свой адрес, без ключа Яндекса и имени модели, рассуждение <think> отброшено
    const { config } = await import('../src/config.js');
    config.llmBaseUrl = 'http://127.0.0.1:8080';
    let headers: Record<string, string> = {};
    globalThis.fetch = (async (u: string, init: { body: string; headers: Record<string, string> }) => {
      url = String(u);
      body = JSON.parse(init.body);
      headers = init.headers;
      return new Response(JSON.stringify({ choices: [{ message: { content: '<think>{x}</think>{"actions":[]}' } }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } }));
    }) as typeof fetch;
    const loc = await complete([{ role: 'user', text: 'фраза' }], 'yandexgpt-lite/latest');
    assert.equal(url, 'http://127.0.0.1:8080/v1/chat/completions');
    assert.equal(body.model, undefined);
    assert.equal(headers.Authorization, undefined);
    assert.equal(loc.text, '{"actions":[]}');
    config.llmBaseUrl = '';
  } finally {
    globalThis.fetch = real;
  }
}
// Цель правки сверяется с фразой: чужое название — ищем по словам, не нашли — пусто
{
  const titles = new Map([['t1', 'Оплатить интернет'], ['t8', 'Йога'], ['t9', 'Стоматолог'], ['m1', 'Друзья']]);
  assert.deepEqual(checkTarget(['t9'], titles, 'Удали йогу в субботу'), ['t8']);
  assert.deepEqual(checkTarget(['t1'], titles, 'Удали слона'), []);
  assert.deepEqual(checkTarget(['t1'], titles, 'Сделал оплату интернета'), ['t1']);
  assert.deepEqual(checkTarget(['m1'], titles, 'Верни Друзей в непросмотренные'), ['m1']);
  assert.deepEqual(checkTarget(['t9'], titles, 'Удали это'), ['t9']);
  assert.deepEqual(checkTarget(['t9'], titles, 'Перенеси стоматолога на пятницу и добавь Карину'), ['t9']);
  // В запрос модели идут записи, похожие на сказанное: «йогу» → «Йога», слово команды «продли» не тянет «Продукты»
  const c4 = { ...ctx, existing: { ...ctx.existing, tasks: [{ id: 't2', title: 'Купить продукты', date: null, time: null }, { id: 't7', title: 'Йога', date: null, time: null }] } };
  const u = buildCompactMessages('Продли йогу до 20', c4).at(-1)!.text;
  assert.match(u, /task:t7 \| Йога/);
  assert.doesNotMatch(u, /Купить продукты/);
  assert.ok(onlyFiller('ммм'));
  assert.ok(onlyFiller('ну это, э-э'));
  assert.ok(!onlyFiller('ну завтра йога'));
  assert.ok(onlyFiller('Какая погода завтра'));
  // Ошибки распознавания: слова-паразиты и слипшийся предлог
  assert.equal(cleanSpeech('ну купить продукты типа повыходным'), 'купить продукты по выходным');
  assert.equal(cleanSpeech('эээ, тренировка впятницу в 7'), 'тренировка в пятницу в 7');
  assert.equal(cleanSpeech('ммм'), '');
  assert.equal(cleanSpeech('в понедельник посреди недели'), 'в понедельник посреди недели');
  // Фильтры «что посмотреть» — по сказанному: додуманный вид убирается, названные чьё и новизна добавляются
  assert.deepEqual(normalize([{ intent: 'query_watch', kind: ['series'] }], ctx, 'Что посмотрим?'), { type: 'queryWatch', filters: { kind: [], genre: [], origin: [], fresh: [] } });
  assert.deepEqual(normalize([{ intent: 'query_watch', kind: ['series'], origin: ['new'] }], ctx, 'Какой сериал посмотреть из нового?'), { type: 'queryWatch', filters: { kind: ['series'], genre: [], origin: [], fresh: ['new'] } });
  assert.deepEqual(normalize([{ intent: 'query_watch', kind: ['movie'] }], ctx, 'Какой-нибудь наш старый фильм'), { type: 'queryWatch', filters: { kind: ['movie'], genre: [], origin: ['ru'], fresh: ['old'] } });
  assert.deepEqual(normalize([{ intent: 'query_watch', genre: ['comedy'] }], ctx, 'Что-нибудь смешное зарубежное'), { type: 'queryWatch', filters: { kind: [], genre: ['comedy'], origin: ['foreign'], fresh: [] } });
  // «Что я хотел?» — имя, которого не было во фразе, не подставляем
  const other = ctx.people[0]!;
  assert.deepEqual(normalize([{ intent: 'query_wish', person: other.name }], ctx, 'Что я хотел?'), { type: 'queryWish', personId: ctx.me.id });
  assert.deepEqual(normalize([{ intent: 'query_wish', person: other.name }], ctx, `Что хочет ${other.name}?`), { type: 'queryWish', personId: other.id });
  // Время и участники — по сказанному, если модель ошиблась или пропустила; срок не назван — неделя с сегодня
  const t21 = normalize([{ intent: 'add', type: 'task', title: 'Оплатить интернет', time: '19:00' }], ctx, 'Запланируй в 21:00 оплатить интернет');
  assert.equal(t21.type === 'items' && t21.items[0]!.type === 'task' && t21.items[0]!.data.time, '21:00');
  const mine = normalize([{ intent: 'add', type: 'task', title: 'Стоматолог', date: '2026-10-25' }], ctx, 'У меня через месяц к стоматологу');
  assert.deepEqual(mine.type === 'items' && mine.items[0]!.type === 'task' && mine.items[0]!.data.people, [ctx.me.id]);
  const week = normalize([{ intent: 'query_plans', scope: 'category', category: 'parents', from: '2026-10-01', to: '2026-10-01' }], ctx, 'Какие планы у родителей?');
  assert.deepEqual(week.type === 'queryPlans' && [week.plans.from, week.plans.to], ['2026-09-25', '2026-10-01']);
  assert.deepEqual(normalize([{ intent: 'query_watch', kind: ['movie'], fresh: ['old'] }], ctx, 'подскажи что посмотреть кино ужастик из классики'), { type: 'queryWatch', filters: { kind: ['movie'], genre: ['horror'], origin: [], fresh: ['old'] } });
  const forK = normalize([{ intent: 'add', type: 'task', title: 'Забрать документы', date: '2026-10-01' }], ctx, 'Карине в четверг забрать документы');
  assert.deepEqual(forK.type === 'items' && forK.items[0]!.type === 'task' && forK.items[0]!.data.people, ['u7']);
  const when = normalize([{ intent: 'query_plans', scope: 'us', from: '2026-09-25', to: '2026-09-25' }], ctx, 'Когда у нас дача?');
  assert.deepEqual(when.type === 'queryPlans' && [when.plans.from, when.plans.to, when.plans.query], ['2026-09-25', '2027-09-25', 'дача']);
  assert.equal(normalize([{ intent: 'add', type: 'task', title: 'Взять погоду', date: '2026-09-26' }], ctx, 'Какая погода завтра').type, 'unknown');
  assert.ok(!onlyFiller('Какая-нибудь комедия'));
}
console.log(`✓ компактный промпт: ${Math.round((100 * compact) / full)}% от полного на 6 фразах`);
