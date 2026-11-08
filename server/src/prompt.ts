import { bodyHint } from './lists.js';
import { repeatShort } from './recur.js';
import { changesRepeat } from './repeat.js';
import { asksWhatToWatch, hasChangeVerb, isUnmark } from './spoken.js';
import type { Context } from './types.js';
import type { Msg } from './yandex.js';

const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Ближайшие две недели одной строкой: модели плохо считают дни недели в уме. Даты, сказанные словами
 * («в следующую субботу», «через две недели», «на выходных»), сервер всё равно пересчитывает сам (src/spoken.ts,
 * normalize), поэтому длинный календарь не нужен
 */
function calendar(today: string): string {
  const start = new Date(`${today}T00:00:00Z`);
  const days: string[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(`${WD_SHORT[d.getUTCDay()]} ${iso(d)}`);
  }
  return days.join(', ');
}

const SYSTEM = `Разбери голосовую команду для приложения списков пары, семьи или друзей в JSON.
Списки: task — дела с датой (общие), wish — хотелки (личные), watch — что посмотреть (общее),
idea — личные заметки по темам («Идеи для приложения», «Подарки»).
Только JSON по схеме, без текста вокруг, без советов.

Ответ: {"actions":[…]}, действий может быть несколько. Пустые поля и null не пиши.

Виды действий:
1) Дело: {"intent":"add","type":"task","title":"…","date":"ГГГГ-ММ-ДД","time":"ЧЧ:ММ","note":"…","end_date":"…","end_time":"…","duration_min":N,"people":[…],"parent":"id","kind":"birthday|important|trip"}
2) Хотелка: {"intent":"add","type":"wish","title":"…","note":"…"}
3) Смотреть: {"intent":"add","type":"watch","title":"…","kind":"…","genres":[…],"origin":"…","year":N}
4) Изменить: {"intent":"update","target":["id"],"query":"как названо во фразе", и только меняющиеся поля: title, date, time, end_date, end_time, duration_min, people}
5) Отметить: {"intent":"mark","target":["id"],"query":"…"} (сделали / посмотрели / подарили)
6) Снять отметку: {"intent":"unmark","target":["id"],"query":"…"}
7) Удалить: {"intent":"delete","target":["id"],"query":"…"}
8) Что посмотреть: {"intent":"query_watch","kind":[…],"genre":[…],"origin":[…],"fresh":[…]} — фильтров нет: {"intent":"query_watch"}
9) Что подарить / что хочет X: {"intent":"query_wish","person":"имя в именительном" | "me"}
10) Планы: {"intent":"query_plans","scope":"…","category":"…","groups":[…],"people":[…],"from":"ГГГГ-ММ-ДД","to":"ГГГГ-ММ-ДД","query":""}
11) Заметка: {"intent":"add","type":"idea","text":"…","topic":"тема"|null}
    Заметка-список: {"intent":"add","type":"idea","title":"название","items":["…"],"topic":"тема"|null}
12) Тема: {"intent":"add","type":"topic","title":"…"}
13) Показать заметки: {"intent":"query_ideas","topic":"тема"|null}
14) Правка списка в теме: {"intent":"list_edit","topic":"тема"|null,"add":[…],"remove":[…],"replace":[{"from":"…","to":"…"}],"check":[…],"uncheck":[…]}
15) Непонятно: {"intent":"unknown"}

Значения:
kind: movie, series, cartoon, show, standup
genres/genre: comedy, drama, action, thriller, horror, scifi, detective, romance, adventure, documentary
origin: ru (российское, советское), foreign
fresh: new (этот или прошлый год), old

Правила:
- Даты — от «Сегодня» и строки «Дни»: «в субботу» — ближайшая будущая (не сегодня), «в следующую субботу» — суббота следующей недели. Нет даты — не пиши.
- Время: «в семь» — 19:00 (1–8 без «утра» — вечер), «в девять утра» — 09:00. Нет времени — не пиши.
- Название дела — коротко, с заглавной, без даты и слов «запиши», «надо», «нам»; подробности — в note: «Дача в субботу, взять мангал» → «Поездка на дачу», note «Взять мангал».
- Повтор («каждую субботу», «по будням», «раз в две недели», «каждый год 8 марта») — одно add task; в title слов о повторе нет; date — первый раз; правило найдёт приложение.
- «Баню теперь каждое воскресенье», «больше не повторяй зарядку» — update записи, а не add.
- Длительность дела: «с 18 до 20» → time 18:00, end_time 20:00; «на два часа» → duration_min 120; «с 7 по 9 октября» → date и end_date.
- people — кто занят: «я», «мне» → ["me"]; «мы», «нам» → ["all"]; «мы с Кариной» → ["me","Карина"]; «Карине к врачу» → ["Карина"]. Имена — из списка людей, в именительном.
- parent — подзадача плана или поездки («в поездку в Питер добавь …», «разбей поездку на …»): id этого дела из «Существующих записей»; открыт план и другое не названо — его id. Каждая подзадача — отдельное add; день не назван — первый день плана.
- «Продли футбол до 21», «футбол теперь с 19 до 21» — update с end_time / duration_min / time; «добавь Карину в футбол» — update с people.
- Хотелка: title — сама вещь, детали — в note, числа цифрами («сорок второй размер» → «42 размер»).
- Смотреть: title — официальное русское название в именительном («Дюну» → «Дюна»); kind, genres (1–3), origin, year — только если уверен.
- «Хочу …» — хотелка; «хочу посмотреть …», «сохрани фильм …» — watch.
- update / mark / unmark / delete — только при глаголе изменения (перенеси, измени, переименуй, удали, убери, отметь, верни, посмотрели, сделали, подарили). Иначе add, даже если похожее есть.
- Фраза с глаголом изменения, но записи нет — тот же intent с target: [] и query.
- Изменения (update и др.): target — до 3 id из «Существующих записей», лучший первым, без префикса типа; не выдумывай. «Перенеси на воскресенье» — date, «на восемь» — time, «переименуй X в Y» — title.
- В query_watch: «фильм» → kind ["movie"], «сериал» → ["series"], «мультик» → ["cartoon"]; «наше», «советское» → origin ["ru"]; «старое» → fresh ["old"].
- Вопросы не добавляют записей: «что посмотрим», «что-нибудь смешное» — query_watch; «что подарить Маше» — query_wish с person «Маша»; «что я хотел» — person «me».
- Страну и год указывай, если знаешь: «Слово пацана» (сериал), «Брат» (фильм) — origin "ru".
- Вопрос о планах («что у нас в субботу», «когда у нас дача») — query_plans.
  scope — чьи планы:
    "us" — «мы», «у нас» без уточнения;
    "me" — «я», «мои», «у меня» без других имён;
    "people" + people (имена) — «у нас с Кариной», «у меня с Димой»;
    "category" + category (couple | family | parents | friends | other) — «у наших друзей» → friends, «у родителей» → parents;
    "groups" + groups (названия) — названа группа из «Мои группы» («в Футболе»);
    "current" — не сказано.
  from/to: «в субботу» — день; «на выходных» — сб–вс; «на этой неделе» — сегодня … вс; о прошлом («что я делал на прошлых выходных», «неделю назад», «вчера») — прошедшие даты; не сказано — 7 дней с сегодня. query — что ищут в «когда …» («когда дача» → "дача", to — через год), иначе "".
- Тип дела (kind) — только явный: «день рождения …», «ДР Маши» → "birthday" (без времени); годовщина, юбилей, важный день → "important"; поездка, отпуск, командировка с датами → "trip".
- Заметка (type idea) — мысль, набросок, список, а не дело, хотелка или фильм: «запиши идею …», «мысль: …», «добавь в <тему> …», «запиши в заметки …».
  text — слова человека почти дословно, без самой команды, с заглавной и знаками препинания; не пересказывай.
  Продиктовали перечень — заметка-список: title — короткое название, items — каждый пункт отдельно (запятых распознавание не ставит — дели по смыслу).
  topic — названная тема: точное название из «Мои темы» или новое короткое с заглавной; не названа — null, не угадывай. Несколько идей — несколько действий.
- Правка списка из «Мои темы» («добавь в список продуктов сыр», «убери хлеб», «замени молоко на кефир», «хлеб купил») — list_edit с точным названием темы; пункты — как в теме; тема открыта и не названа — topic null.
- «Идея подарка Маше — кроссовки» — idea, не wish: wish — то, что хочет сам говорящий.
- «Создай тему …», «заведи список идей для …» — add topic.
- «Покажи идеи для подарков», «открой поздравления» — query_ideas; «без темы» — "без темы"; не названа — null.
- Перенос идеи («перенеси идею про погоду в приложение») — update с target и topic; удаление — delete. id идей — из «Существующих записей».
- Если фраза не похожа ни на что — {"actions":[{"intent":"unknown"}]}.

Примеры (сегодня пятница 2026-09-25):
«В субботу в семь ужин у родителей» → {"actions":[{"intent":"add","type":"task","title":"Ужин у родителей","date":"2026-09-26","time":"19:00"}]}
«Мы с Кариной едем в Питер с 7 по 9 октября» → {"actions":[{"intent":"add","type":"task","title":"Поездка в Питер","date":"2026-10-07","end_date":"2026-10-09","people":["me","Карина"]}]}
«В поездку в Питер добавь Эрмитаж в пятницу в 10 на два часа» (есть task:t9 | Поездка в Питер) → {"actions":[{"intent":"add","type":"task","title":"Эрмитаж","date":"2026-10-09","time":"10:00","duration_min":120,"parent":"t9"}]}
«Добавь Дюну» → {"actions":[{"intent":"add","type":"watch","title":"Дюна","kind":"movie","genres":["scifi","adventure"],"origin":"foreign","year":2021}]}
«Добавь в мой вишлист кроссовки, сорок второй размер» → {"actions":[{"intent":"add","type":"wish","title":"Кроссовки","note":"42 размер"}]}
«Что посмотрим?» → {"actions":[{"intent":"query_watch"}]}
«Что-нибудь смешное зарубежное» → {"actions":[{"intent":"query_watch","genre":["comedy"],"origin":["foreign"]}]}
«Какие у нас с Кариной планы на следующую субботу?» → {"actions":[{"intent":"query_plans","scope":"people","people":["Карина"],"from":"2026-10-03","to":"2026-10-03","query":""}]}
«Что у наших друзей на выходных?» → {"actions":[{"intent":"query_plans","scope":"category","category":"friends","from":"2026-09-26","to":"2026-09-27","query":""}]}
«Когда у нас дача?» → {"actions":[{"intent":"query_plans","scope":"us","from":"2026-09-25","to":"2027-09-25","query":"дача"}]}
«Что я делаю на выходных?» → {"actions":[{"intent":"query_plans","scope":"me","from":"2026-09-26","to":"2026-09-27","query":""}]}
«Перенеси стоматолога на пятницу на два и добавь Карину» (есть task:t6 | Стоматолог | 2026-09-29 10:00) → {"actions":[{"intent":"update","target":["t6"],"date":"2026-10-02","time":"14:00","people":["Карина"],"query":"стоматолог"}]}
«Мы посмотрели Интерстеллар» (есть watch:m1 | Интерстеллар) → {"actions":[{"intent":"mark","target":["m1"],"query":"Интерстеллар"}]}
«Запиши идею: в виджете показывать погоду на завтра» (есть тема «Идеи для приложения») → {"actions":[{"intent":"add","type":"idea","text":"В виджете показывать погоду на завтра.","topic":"Идеи для приложения"}]}
«Запиши в заметки список продуктов молоко яйца хлеб и что-нибудь сладенькое» → {"actions":[{"intent":"add","type":"idea","title":"Список продуктов","items":["Молоко","Яйца","Хлеб","Что-нибудь сладенькое"],"topic":null}]}
«Добавь в список продуктов сыр и убери хлеб» → {"actions":[{"intent":"list_edit","topic":"Список продуктов","add":["Сыр"],"remove":["Хлеб"]}]}`;

export function buildMessages(text: string, ctx: Context): Msg[] {
  const d = new Date(`${ctx.today}T00:00:00Z`);
  const people = [`${ctx.me.name} (это говорящий, «я»)`, ...ctx.people.map((p) => p.name)].join(', ');
  const ex = ctx.existing;
  const topics = ctx.topics ?? [];
  const topicTitle = (id: string | null) => topics.find((t) => t.id === id)?.title ?? 'без темы';
  const current = ctx.currentTopicId ? topics.find((t) => t.id === ctx.currentTopicId) : null;
  const plan = ctx.currentParentId ? ex.tasks.find((t) => t.id === ctx.currentParentId) : null;
  const rows = [
    ...ex.tasks.map((t) => {
      const end = t.endDate || t.endTime ? ` – ${[t.endDate, t.endTime].filter(Boolean).join(' ')}` : '';
      const who = t.people?.length ? ` | кто: ${t.people.join(', ')}` : '';
      const plan = t.parentId ? ` | в плане task:${t.parentId}` : '';
      const rep = t.repeat ? ` | повтор: ${repeatShort(t.repeat)}` : '';
      return `task:${t.id} | ${t.title} | ${[t.date, t.time].filter(Boolean).join(' ') || 'без даты'}${end}${rep}${who}${plan}${t.done ? ' | выполнено' : ''}`;
    }),
    ...ex.watch.map((w) => `watch:${w.id} | ${w.title}${w.done ? ' | посмотрели' : ''}`),
    ...ex.wishes.map((w) => `wish:${w.id} | ${w.title}${w.done ? ' | подарили' : ''}`),
    ...(ex.ideas ?? []).map((i) => `idea:${i.id} | ${i.text} | тема: ${topicTitle(i.topicId)}`),
  ];

  const user = `Сегодня: ${WD[d.getUTCDay()]} ${ctx.today}, сейчас ${ctx.now}.
Дни: ${calendar(ctx.today)}

Люди в группах: ${people}

Мои группы: ${(ctx.groups ?? []).map((g) => `${g.name} (${g.category})`).join(', ') || '—'}

Мои темы: ${topics.map((t) => `«${t.title}»${t.body?.trim() ? ` (${bodyHint(t.body)})` : ''}`).join(', ') || '—'}${current ? `
Открыта тема «${current.title}» — идея без названной темы идёт в неё.` : ''}${plan ? `
Открыт план task:${plan.id} «${plan.title}» (${[plan.date, plan.endDate].filter(Boolean).join(' – ')}) — новые дела становятся его подзадачами.` : ''}

Существующие записи (тип:id | название | детали):
${rows.length ? rows.join('\n') : '— нет —'}

Фраза: «${text}»`;

  return [
    { role: 'system', text: SYSTEM },
    { role: 'user', text: user },
  ];
}

/* ---------- Компактный промпт: только нужные фразе части правил и данных ---------- */

/**
 * Полный промпт — около 2 800 токенов, из них ~2 500 — правила на все случаи. Для «добавь Дюну» модели не нужны
 * правила заметок, вопросов о планах и правок, а для «перенеси ужин» — правила «Смотреть». Части берём из того же
 * SYSTEM по началу строки (пункт с продолжением — строки с отступом), порядок — как в полном промпте.
 * Сомневаемся — включаем. Если модель всё равно ответила «непонятно», parseText повторяет с полным промптом.
 */
const LINES = SYSTEM.split('\n');

/** Номера строк пункта, начинающегося с prefix, вместе с его продолжением (строки с отступом) */
function chunk(prefix: string): number[] {
  const i = LINES.findIndex((l) => l.startsWith(prefix));
  if (i < 0) throw new Error(`prompt: нет строки «${prefix}»`);
  const out = [i];
  for (let j = i + 1; j < LINES.length && /^\s+\S/.test(LINES[j]); j++) out.push(j);
  return out;
}
const at = (prefix: string) => LINES.findIndex((l) => l.startsWith(prefix));

export type Block = 'task' | 'parent' | 'wish' | 'watch' | 'change' | 'qwatch' | 'qwish' | 'plans' | 'ideas';

const PARTS: Record<Block, string[]> = {
  task: ['1)', '- Время:', '- Название дела', '- Повтор', '- Длительность дела', '- people', '- Тип дела', '«В субботу в семь', '«Мы с Кариной едем'],
  parent: ['- parent', '«В поездку в Питер'],
  wish: ['2)', '- Хотелка:', '- «Хочу …»', '«Добавь в мой вишлист'],
  watch: ['3)', 'Значения:', 'kind:', 'genres/genre:', 'origin:', 'fresh:', '- Смотреть:', '- «Хочу …»', '- Страну и год', '«Добавь Дюну'],
  change: ['4)', '5)', '6)', '7)', '- «Баню теперь', '- «Продли футбол', '- update / mark', '- Фраза с глаголом', '- Изменения (update', '«Перенеси стоматолога', '«Мы посмотрели'],
  qwatch: ['8)', 'Значения:', 'kind:', 'genres/genre:', 'origin:', 'fresh:', '- В query_watch', '- Вопросы не добавляют', '- Страну и год', '«Что посмотрим?»', '«Что-нибудь смешное'],
  qwish: ['9)', '- Вопросы не добавляют'],
  plans: ['10)', '- Вопрос о планах', '«Какие у нас с Кариной', '«Что у наших друзей', '«Когда у нас дача', '«Что я делаю'],
  ideas: ['11)', '12)', '13)', '14)', '- Заметка (type idea)', '- Правка списка', '- «Идея подарка', '- «Создай тему', '- «Покажи идеи', '«Запиши идею', '«Запиши в заметки', '«Добавь в список продуктов'],
};
// Шапка, разделы, «непонятно» и пустые строки между разделами — всегда
const ALWAYS = [0, 1, 2, 3, 4, 5, at('Виды действий:'), ...chunk('15)'), at('Правила:'), ...chunk('- Если фраза не похожа'), at('Примеры (')].concat(
  LINES.map((l, i) => (l === '' ? i : -1)).filter((i) => i >= 0),
);
const DATES = chunk('- Даты');
const IDEA_MOVE = chunk('- Перенос идеи');
const PART_LINES = Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.flatMap(chunk)])) as Record<Block, number[]>;

const nrm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const stems = (s: string) => nrm(s).split(/[^а-яa-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 4));

/** Какие части промпта нужны фразе */
export function pickBlocks(text: string, ctx: Context): { blocks: Set<Block>; calendar: boolean; rows: boolean } {
  const t = nrm(text);
  const b = new Set<Block>();
  const change =
    hasChangeVerb(t) || changesRepeat(t) || isUnmark(t) || /(^|\s)(добавь|убери|исключи)\s+\S+\s+(в|из)\s/.test(t) || /(купил|купила|сделали|готово)/.test(t);
  const question = /\?/.test(t) || /^(что|чего|какие|какой|какая|какую|каких|когда|где|сколько|кто|кому|покажи|открой|найди)(\s|$)/.test(t) || /(что-нибудь|что-то|какой-нибудь|какую-нибудь|какое-нибудь|чем заняться)/.test(t);
  const watchish = /(посмотр|смотреть|фильм|сериал|мульт|кино|шоу|стендап|комеди|драм|ужас|боевик|триллер|фантаст|детектив|мелодрам|документал|смешн|страшн|интересн)/.test(t);
  const plansish = /(план|когда|что у|делаю|делаем|делает|делал|было|назад|вчера|прошл|заняты?|свобод|запланир|выходн|недел)/.test(t);
  // Пункт из списка темы («хлеб купил») — правка списка только при глаголе правки: «купить молоко» — это дело,
  // и правила заметок (самый длинный блок) ему не нужны
  const listVerb = /(добав|убер|убра|вычеркн|отмет|купил|куплен|замен|удали|сними)/.test(t);
  const topicHit = (ctx.topics ?? []).some(
    (tp) => stems(tp.title).some((s) => t.includes(s)) || (listVerb && tp.body ? stems(tp.body).some((s) => new RegExp(`(^|\\s)${s}`).test(t)) : false),
  );
  const ideaish = /(иде[яиюейя]|заметк|мысл|(^|\s)тем[аеуы]?(\s|$)|списк|список|блокнот|пункт|запиши в|набросок|поздравлен)/.test(t) || !!ctx.currentTopicId || topicHit;

  if (question) {
    if (watchish || asksWhatToWatch(t) || /(посмотрим|глянуть)/.test(t)) b.add('qwatch');
    if (/(подар|хоч|хотел)/.test(t)) b.add('qwish');
    // «Что бы сегодня посмотреть» — день во фразе не делает её вопросом о планах: без правил планов модель не перепутает
    if (!asksWhatToWatch(t) && (plansish || /(сегодня|завтра|суббот|воскресен|понедельник|вторник|сред|четверг|пятниц)/.test(t))) b.add('plans');
    if (ideaish) b.add('ideas');
    if (!b.size) ['qwatch', 'qwish', 'plans'].forEach((x) => b.add(x as Block));
  } else {
    // Добавления — самые частые: дело, хотелка, «Смотреть» (в «добавь Дюну» нет слова «фильм»)
    ['task', 'wish', 'watch'].forEach((x) => b.add(x as Block));
    if (ideaish) b.add('ideas');
    if (plansish && /(^|\s)(что|когда|какие)(\s|$)/.test(t)) b.add('plans');
  }
  if (change) {
    b.add('change');
    // Правка: добавлений обычно нет — правила хотелок и «Смотреть» только если о них речь
    if (!question && !watchish) b.delete('watch');
    if (!question && !/(хоч|вишлист|подар)/.test(t)) b.delete('wish');
  }
  const parent = !!ctx.currentParentId || /(в поездк|в план|для поездк|разбей|подзадач|в командировк|в отпуск)/.test(t);
  if (parent) b.add('parent');
  const calendar =
    b.has('plans') || b.has('change') || parent || /(сегодня|завтра|послезавтра|через|недел|выходн|понедельник|вторник|сред[аеуы]|четверг|пятниц|суббот|воскресен|январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр|числ|\d)/.test(t);
  return { blocks: b, calendar, rows: change || parent };
}

/** Компактные сообщения для модели: части правил по pickBlocks, данные — только нужные */
export function buildCompactMessages(text: string, ctx: Context): Msg[] {
  const { blocks, calendar: withCal, rows: withRows } = pickBlocks(text, ctx);
  const idx = new Set<number>(ALWAYS);
  for (const k of blocks) PART_LINES[k].forEach((i) => idx.add(i));
  if (withCal) DATES.forEach((i) => idx.add(i));
  if (blocks.has('ideas') && blocks.has('change')) IDEA_MOVE.forEach((i) => idx.add(i));
  const system = [...idx]
    .sort((a, b) => a - b)
    .map((i) => LINES[i])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  const d = new Date(`${ctx.today}T00:00:00Z`);
  const people = [`${ctx.me.name} (это говорящий, «я»)`, ...ctx.people.map((p) => p.name)].join(', ');
  const ex = ctx.existing;
  const topics = ctx.topics ?? [];
  const topicTitle = (id: string | null) => topics.find((t) => t.id === id)?.title ?? 'без темы';
  const current = ctx.currentTopicId ? topics.find((t) => t.id === ctx.currentTopicId) : null;
  const plan = ctx.currentParentId ? ex.tasks.find((t) => t.id === ctx.currentParentId) : null;

  let rows: string[] = [];
  if (withRows) {
    const all = [
      ...ex.tasks.map((t) => {
        const end = t.endDate || t.endTime ? ` – ${[t.endDate, t.endTime].filter(Boolean).join(' ')}` : '';
        const who = t.people?.length ? ` | кто: ${t.people.join(', ')}` : '';
        const inPlan = t.parentId ? ` | в плане task:${t.parentId}` : '';
        const rep = t.repeat ? ` | повтор: ${repeatShort(t.repeat)}` : '';
        return { title: t.title, row: `task:${t.id} | ${t.title} | ${[t.date, t.time].filter(Boolean).join(' ') || 'без даты'}${end}${rep}${who}${inPlan}${t.done ? ' | выполнено' : ''}`, keep: t.id === plan?.id };
      }),
      ...ex.watch.map((w) => ({ title: w.title, row: `watch:${w.id} | ${w.title}${w.done ? ' | посмотрели' : ''}`, keep: false })),
      ...ex.wishes.map((w) => ({ title: w.title, row: `wish:${w.id} | ${w.title}${w.done ? ' | подарили' : ''}`, keep: false })),
      ...(ex.ideas ?? []).map((i) => ({ title: i.text, row: `idea:${i.id} | ${i.text} | тема: ${topicTitle(i.topicId)}`, keep: false })),
    ];
    // Только записи, похожие на сказанное (по началу слов); ничего не похоже — все
    const said = new Set(stems(text));
    const hit = all.filter((r) => r.keep || stems(r.title).some((s) => said.has(s)));
    rows = (hit.length ? hit : all).slice(0, 80).map((r) => r.row);
  }

  const parts = [`Сегодня: ${WD[d.getUTCDay()]} ${ctx.today}, сейчас ${ctx.now}.`];
  if (withCal) parts.push(`Дни: ${calendar(ctx.today)}`);
  parts.push(`Люди в группах: ${people}`);
  if (blocks.has('plans')) parts.push(`Мои группы: ${(ctx.groups ?? []).map((g) => `${g.name} (${g.category})`).join(', ') || '—'}`);
  if (blocks.has('ideas'))
    parts.push(
      `Мои темы: ${topics.map((t) => `«${t.title}»${t.body?.trim() ? ` (${bodyHint(t.body)})` : ''}`).join(', ') || '—'}${current ? `\nОткрыта тема «${current.title}» — идея без названной темы идёт в неё.` : ''}`,
    );
  if (plan) parts.push(`Открыт план task:${plan.id} «${plan.title}» (${[plan.date, plan.endDate].filter(Boolean).join(' – ')}) — новые дела становятся его подзадачами.`);
  if (withRows) parts.push(`Существующие записи (тип:id | название | детали):\n${rows.length ? rows.join('\n') : '— нет —'}`);
  parts.push(`Фраза: «${text}»`);
  return [
    { role: 'system', text: system },
    { role: 'user', text: parts.join('\n\n') },
  ];
}

/* ---------- Дообученная модель: правила она уже знает ---------- */

/**
 * Системная строка дообученной модели (train/generate.ts учит на ней же). Правила и примеры модель выучила,
 * в запросе — только контекст и фраза в том же виде, что у компактного промпта
 */
export const TUNED_SYSTEM = 'Разбери голосовую команду приложения «Кстати» в JSON {"actions":[…]} по правилам приложения. Только JSON.';

export function buildTunedMessages(text: string, ctx: Context): Msg[] {
  const [, user] = buildCompactMessages(text, ctx);
  return [
    { role: 'system', text: TUNED_SYSTEM },
    { role: 'user', text: user.text },
  ];
}
