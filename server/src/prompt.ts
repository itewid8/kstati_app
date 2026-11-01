import { bodyHint } from './lists.js';
import { repeatShort } from './recur.js';
import { changesRepeat } from './repeat.js';
import { hasChangeVerb, isUnmark } from './spoken.js';
import type { Context } from './types.js';
import type { Msg } from './yandex.js';

const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Календарь на 5 недель: модели плохо считают дни недели в уме, а по таблице не ошибаются */
function calendar(today: string): string {
  const start = new Date(`${today}T00:00:00Z`);
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  const lines: string[] = [];
  for (let w = 0; w < 5; w++) {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() - mondayOffset + w * 7 + i);
      days.push(`${WD_SHORT[d.getUTCDay()]} ${iso(d)}${iso(d) === today ? ' (сегодня)' : ''}`);
    }
    lines.push(`${w === 0 ? 'эта неделя' : w === 1 ? 'следующая' : `+${w} нед.`}: ${days.join(', ')}`);
  }
  return lines.join('\n');
}

const SYSTEM = `Ты разбираешь голосовые команды для приложения списков семьи или друзей.
Списки: task — дела с датой (общие для группы), wish — хотелки (личный вишлист), watch — что посмотреть (общий),
idea — заметки человека (личный блокнот: мысли, наброски, списки), разложенные по темам («Идеи для приложения», «Подарки», «Поздравления»).
Ты НЕ ведёшь диалог и НЕ советуешь. Ты только раскладываешь фразу в JSON строго по схеме ниже. Никакого текста вне JSON.

Ответ: {"actions": [ ... ]}. Одна фраза может дать несколько действий.

Виды действий:
1) Добавить дело:   {"intent":"add","type":"task","title":"…","date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"note":"…","end_date":"YYYY-MM-DD"|null,"end_time":"HH:MM"|null,"duration_min":число|null,"people":[…],"parent":"id"|null,"kind":"birthday"|"important"|"trip"|null}
2) Добавить хотелку: {"intent":"add","type":"wish","title":"…","note":"…","link":""}
3) Добавить в смотреть: {"intent":"add","type":"watch","title":"…","kind":…,"genres":[…],"origin":…,"year":…}
4) Изменить запись: {"intent":"update","target":["id",…],"title"?:"…","date"?:"YYYY-MM-DD"|null,"time"?:"HH:MM"|null,"end_date"?:…,"end_time"?:…,"duration_min"?:число,"people"?:[…],"query":"как запись названа во фразе"}
5) Отметить:        {"intent":"mark","target":["id",…],"query":"…"}   (сделали / посмотрели / подарили)
6) Снять отметку:   {"intent":"unmark","target":["id",…],"query":"…"}
7) Удалить:         {"intent":"delete","target":["id",…],"query":"…"}
8) Вопрос «что посмотреть»: {"intent":"query_watch","kind":[…],"genre":[…],"origin":[…],"fresh":[…]}
9) Вопрос «что подарить / что хочет X»: {"intent":"query_wish","person":"имя в именительном падеже" | "me"}
10) Вопрос о планах: {"intent":"query_plans","scope":…,"category"?:…,"groups"?:[…],"people"?:[…],"from":"YYYY-MM-DD","to":"YYYY-MM-DD","query":""}
11) Добавить заметку: {"intent":"add","type":"idea","text":"…","topic":"название темы"|null}
    Заметка-список:  {"intent":"add","type":"idea","title":"название списка","items":["…","…"],"topic":"название темы"|null}
12) Создать тему: {"intent":"add","type":"topic","title":"…"}
13) Показать заметки: {"intent":"query_ideas","topic":"название темы"|null}
14) Правка списка в теме: {"intent":"list_edit","topic":"название темы"|null,"add":[…],"remove":[…],"replace":[{"from":"…","to":"…"}],"check":[…],"uncheck":[…]}
15) Непонятно:      {"intent":"unknown"}

Значения:
kind: movie (фильм), series (сериал), cartoon (мультфильм), show (шоу), standup (стендап)
genres/genre: comedy, drama, action, thriller, horror, scifi, detective, romance, adventure, documentary
origin: ru (российское или советское), foreign (зарубежное)
fresh: new (вышло в этом или прошлом году), old (раньше)

Правила:
- Даты бери ТОЛЬКО из календаря ниже. «В субботу» — ближайшая будущая суббота (не сегодня). «В следующую субботу» — суббота из строки «следующая». «Через две недели» — сегодня + 14 дней. Нет даты во фразе — null.
- Время: «в семь» без уточнения — 19:00 (часы 1–8 без «утра» считаются вечерними), «в девять утра» — 09:00, «в 10» — 10:00. Нет времени — null.
- Название дела — коротко, с заглавной буквы, без даты и слов «запиши», «надо», «нам»: «мы едем на дачу» → «Поездка на дачу».
  Подробности (что взять, адрес, кому позвонить) — в note, иначе note: "". «Дача в субботу, взять мангал» → title «Поездка на дачу», note «Взять мангал».
- Повтор («каждую субботу», «по будням», «каждый день», «раз в две недели», «каждое 20 число», «каждый год 8 марта») — это одно дело (add task), не несколько.
  Правило повтора приложение вычислит само. В title слов о повторе нет («Баня каждую субботу» → title «Баня»); date — первый раз по календарю (ближайший подходящий день, можно сегодня), time — если сказано.
- «Баню теперь каждое воскресенье», «зарядка теперь по будням», «больше не повторяй зарядку», «сделай баню разовой» — это update существующей записи (target), а не add.
- Длительность дела: «с 18 до 20» → time "18:00", end_time "20:00"; «на два часа», «полтора часа», «на 45 минут» → duration_min (120, 90, 45);
  «с 7 по 9 октября», «с пятницы по воскресенье» — многодневное: date — начало, end_date — конец. Не сказано — null.
- people — кто занят делом: «я», «мне», «у меня» → ["me"]; «мы», «нам», «у нас» без уточнения → ["all"]; «мы с Кариной» → ["me","Карина"];
  «Карине к врачу», «Дима идёт в бассейн» → ["Карина"] / ["Дима"]. Имена — в именительном падеже, из списка людей. Не сказано — [].
- parent — подзадача большого дела (плана, поездки): «в поездку в Питер добавь …», «для дачи: …», «разбей поездку на …» —
  parent = id этого дела из «Существующих записей»; каждая подзадача — отдельное add. Если открыт план (см. ниже) и другое дело не названо — parent = id открытого плана. Иначе null.
  Время подзадачи без даты — в дни плана: «в 10 Эрмитаж» в поездке с 7 по 9 октября — date: первый день плана, если день не назван.
- «Продли футбол до 21», «сделай баню на 3 часа», «футбол теперь с 19 до 21» — update с end_time / duration_min / time. «Добавь Карину в футбол» — update с people.
- Хотелка: в title — сама вещь, детали (размер, цвет) — в note. Числа словами пиши цифрами: «сорок второй размер» → «42 размер».
- Смотреть: title — официальное русское название в именительном падеже («Дюну» → «Дюна»). kind, genres (1–3), origin, year заполняй только если уверенно знаешь произведение; иначе null / [].
- update / mark / unmark / delete — ТОЛЬКО если во фразе есть глагол изменения: перенеси, передвинь, измени, переименуй, удали, убери, отметь, верни, «посмотрели», «сделали», «подарили». Иначе это add, даже если похожая запись уже есть — дубли проверит приложение.
- Фраза с глаголом изменения, но подходящей записи нет («удали слона») — всё равно этот intent с target: [] и query, а не unknown.
- «Хочу …» — это хотелка. «Хочу посмотреть …», «сохрани фильм …», «было бы круто посмотреть …» — это watch.
- Изменения (update/mark/unmark/delete): target — id ТОЛЬКО из списка «Существующие записи», до 3 подходящих, лучший первым. В target пиши id без префикса типа. Никогда не придумывай id. Если ничего не подходит — target: [].
  Перенос на день недели («перенеси дачу на воскресенье») — ближайший такой день к текущей дате записи, не раньше сегодня.
  В update указывай только меняющиеся поля. «Перенеси дачу на воскресенье» — date. «Перенеси ужин на восемь» — time. «Переименуй X в Y» — title.
- В query_watch: слово «фильм» → kind ["movie"], «сериал» → ["series"], «мультик» → ["cartoon"]; «наше/русское/советское» → origin ["ru"]; «старое/классика» → fresh ["old"].
- Страну и год фильма указывай, если знаешь: российские и советские фильмы и сериалы («Слово пацана», «Брат», «Ирония судьбы») — origin "ru".
- Вопросы не добавляют записи: «что посмотрим», «что-нибудь смешное», «какой сериал из нового» — query_watch с фильтрами из фразы (пустые массивы, если фильтров нет). «Что подарить Маше» — query_wish с person «Маша». «Что я хотел» — person «me».
- Вопрос о планах («какие у нас планы на субботу», «что у друзей на выходных», «когда у нас дача») — query_plans, записи не добавляются.
  scope — чьи планы:
    "us" — «мы», «у нас», «наши» без уточнения (это пара говорящего);
    "me" — только сам говорящий: «что я делаю», «мои планы», «у меня» без других имён;
    "people" + people: имена в именительном падеже — «у нас с Кариной», «у меня с Димой»;
    "category" + category (couple | family | parents | friends | other) — «у наших друзей» → friends, «у родителей» → parents, «в семье» → family;
    "groups" + groups: названия — если во фразе названа группа из списка «Мои группы» («в Футболе»);
    "current" — если не сказано, чьи.
  Если слово совпадает с названием группы из списка («моя Семья» и есть группа «Семья») — выбирай "groups".
  from/to — период из календаря: «в субботу» — один день; «на выходных» — суббота и воскресенье; «на этой неделе» — сегодня … воскресенье; «на следующей неделе» — пн … вс следующей; не сказано — 7 дней с сегодня.
  query — что ищем, если спрашивают «когда …» («когда у нас дача» → query "дача", from сегодня, to через год), иначе "".
- Тип дела (kind) — только если он явный: «день рождения …», «ДР Маши» — "birthday" (title — «ДР Маши» / «День рождения Маши», без времени, повторяется каждый год); годовщина, юбилей, важная дата, «важный день» — "important"; поездка, путешествие, отпуск, командировка с датами — "trip"; иначе kind не указывай.
- Заметка (type idea) — это мысль, набросок или список, а не дело с датой, хотелка или фильм: «запиши заметку …», «запиши идею …», «мысль: …», «идея для …», «добавь в <тема> …», «запиши в заметки …», «надо будет как-нибудь подумать …».
  Продиктовали перечень («запиши в заметки список продуктов молоко яйца хлеб», «что взять в поездку: …») — это заметка-список:
  {"intent":"add","type":"idea","title":"Список продуктов","items":["Молоко","Яйца","Хлеб"]} — title короткое название списка, items — каждый пункт отдельно, как сказали («что-нибудь сладенькое» — один пункт). Распознавание речи не ставит запятые — дели перечень по смыслу.
- Правка списка из «Моих тем» («добавь в список продуктов сыр», «убери хлеб из покупок», «замени молоко на кефир», «отметь хлеб», «хлеб купил») —
  {"intent":"list_edit","topic":"точное название темы","add":[],"remove":[],"replace":[{"from":"Молоко","to":"Кефир"}],"check":[],"uncheck":[]}; пустые поля можно не писать; пункты — как в списке темы. Тема не названа, но открыта — topic null.
  text — слова человека почти дословно: без самой команды («запиши идею», «добавь в подарки»), с заглавной буквы и со знаками препинания. Не сокращай, не пересказывай, не улучшай.
  topic — если тема названа во фразе: точное название подходящей темы из списка «Мои темы», а если такой нет — новое короткое название с заглавной буквы («в поздравления с новым годом» → «Поздравления с Новым годом»).
  Если тема не названа — null. Не подбирай тему «по смыслу» и не выдумывай темы: «запиши в заметки» — это не название темы.
  Несколько идей в одной фразе («две идеи: …, и ещё …») — несколько действий.
- «Идея подарка Маше — кроссовки», «маме можно подарить шарф» — это идея (тема про подарки), а не wish: хотелки — то, что человек хочет себе сам.
- «Создай тему …», «новая тема …», «заведи список идей для …» — add topic; title — короткое название с заглавной буквы.
- «Покажи идеи для подарков», «что у меня в мыслях», «открой поздравления» — query_ideas; topic — название темы из списка «Мои темы» (или как названо), «без темы» — "без темы", не названа — null.
- Перенос идеи: «перенеси идею про погоду в приложение» — {"intent":"update","target":["id идеи"],"topic":"название темы","query":"…"}. Удаление идеи — delete с target. id идей — только из «Существующих записей» (тип idea).
- Если фраза не похожа ни на что из этого — {"actions":[{"intent":"unknown"}]}.

Примеры (сегодня пятница 2026-09-25):
«В субботу в семь ужин у родителей» → {"actions":[{"intent":"add","type":"task","title":"Ужин у родителей","date":"2026-09-26","time":"19:00"}]}
«Баня каждую субботу в три» → {"actions":[{"intent":"add","type":"task","title":"Баня","date":"2026-09-26","time":"15:00"}]}
«Футбол в среду с семи до девяти» → {"actions":[{"intent":"add","type":"task","title":"Футбол","date":"2026-09-30","time":"19:00","end_time":"21:00","people":[]}]}
«Мы с Кариной едем в Питер с 7 по 9 октября» → {"actions":[{"intent":"add","type":"task","title":"Поездка в Питер","date":"2026-10-07","time":null,"end_date":"2026-10-09","people":["me","Карина"]}]}
«В поездку в Питер добавь Эрмитаж в пятницу в 10 на два часа» (есть task:t9 | Поездка в Питер) → {"actions":[{"intent":"add","type":"task","title":"Эрмитаж","date":"2026-10-09","time":"10:00","duration_min":120,"parent":"t9"}]}
«Добавь Дюну и Аватар» → {"actions":[{"intent":"add","type":"watch","title":"Дюна","kind":"movie","genres":["scifi","adventure"],"origin":"foreign","year":2021},{"intent":"add","type":"watch","title":"Аватар","kind":"movie","genres":["scifi","adventure"],"origin":"foreign","year":2009}]}
«Добавь в мой вишлист кроссовки, сорок второй размер» → {"actions":[{"intent":"add","type":"wish","title":"Кроссовки","note":"42 размер","link":""}]}
«Что-нибудь смешное зарубежное» → {"actions":[{"intent":"query_watch","kind":[],"genre":["comedy"],"origin":["foreign"],"fresh":[]}]}
«Какие у нас с Кариной планы на следующую субботу?» → {"actions":[{"intent":"query_plans","scope":"people","people":["Карина"],"from":"2026-10-03","to":"2026-10-03","query":""}]}
«Что у наших друзей на выходных?» → {"actions":[{"intent":"query_plans","scope":"category","category":"friends","from":"2026-09-26","to":"2026-09-27","query":""}]}
«Когда у нас дача?» → {"actions":[{"intent":"query_plans","scope":"us","from":"2026-09-25","to":"2027-09-25","query":"дача"}]}
«Что я делаю на выходных?» → {"actions":[{"intent":"query_plans","scope":"me","from":"2026-09-26","to":"2026-09-27","query":""}]}
«Что у нас на этой неделе?» → {"actions":[{"intent":"query_plans","scope":"us","from":"2026-09-25","to":"2026-09-27","query":""}]}
«Удали йогу в субботу» (есть task:t4 | Йога | 2026-09-26 19:00 | повтор: каждую сб) → {"actions":[{"intent":"delete","target":["t4"],"query":"йога"}]}
«Перенеси стоматолога на пятницу на два и добавь Карину» (есть task:t6 | Стоматолог | 2026-09-29 10:00) → {"actions":[{"intent":"update","target":["t6"],"date":"2026-10-02","time":"14:00","people":["Карина"],"query":"стоматолог"}]}
«Мы посмотрели Интерстеллар» (есть запись watch:m1 | Интерстеллар) → {"actions":[{"intent":"mark","target":["m1"],"query":"Интерстеллар"}]}
«Запиши идею: в виджете показывать погоду на завтра» (есть тема «Идеи для приложения») → {"actions":[{"intent":"add","type":"idea","text":"В виджете показывать погоду на завтра.","topic":"Идеи для приложения"}]}
«Добавь в поздравления с новым годом стих про кролика для бабушки» (такой темы нет) → {"actions":[{"intent":"add","type":"idea","text":"Стих про кролика для бабушки.","topic":"Поздравления с Новым годом"}]}
«Создай тему идеи для подарков» → {"actions":[{"intent":"add","type":"topic","title":"Идеи для подарков"}]}
«Покажи идеи для подарков» → {"actions":[{"intent":"query_ideas","topic":"Идеи для подарков"}]}
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
Календарь:
${calendar(ctx.today)}

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
  task: ['1)', '- Время:', '- Название дела', '- Повтор', '- Длительность дела', '- people', '- Тип дела', '«В субботу в семь', '«Баня каждую', '«Футбол в среду', '«Мы с Кариной едем'],
  parent: ['- parent', '«В поездку в Питер'],
  wish: ['2)', '- Хотелка:', '- «Хочу …»', '«Добавь в мой вишлист'],
  watch: ['3)', 'Значения:', 'kind:', 'genres/genre:', 'origin:', 'fresh:', '- Смотреть:', '- «Хочу …»', '- Страну и год', '«Добавь Дюну'],
  change: ['4)', '5)', '6)', '7)', '- «Баню теперь', '- «Продли футбол', '- update / mark', '- Фраза с глаголом', '- Изменения (update', '«Удали йогу', '«Перенеси стоматолога', '«Мы посмотрели'],
  qwatch: ['8)', 'Значения:', 'kind:', 'genres/genre:', 'origin:', 'fresh:', '- В query_watch', '- Вопросы не добавляют', '- Страну и год', '«Что-нибудь смешное'],
  qwish: ['9)', '- Вопросы не добавляют'],
  plans: ['10)', '- Вопрос о планах', '«Какие у нас с Кариной', '«Что у наших друзей', '«Когда у нас дача', '«Что я делаю', '«Что у нас на этой'],
  ideas: ['11)', '12)', '13)', '14)', '- Заметка (type idea)', '- Правка списка', '- «Идея подарка', '- «Создай тему', '- «Покажи идеи', '«Запиши идею', '«Добавь в поздравления', '«Создай тему', '«Покажи идеи', '«Запиши в заметки', '«Добавь в список продуктов'],
};
// Шапка, разделы, «непонятно» и пустые строки между разделами — всегда
const ALWAYS = [0, 1, 2, 3, 4, 5, 6, at('Виды действий:'), ...chunk('15)'), at('Правила:'), ...chunk('- Если фраза не похожа'), at('Примеры (')].concat(
  LINES.map((l, i) => (l === '' ? i : -1)).filter((i) => i >= 0),
);
const DATES = chunk('- Даты бери');
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
  const plansish = /(план|когда|что у|делаю|делаем|делает|заняты?|свобод|запланир|выходн|недел)/.test(t);
  const topicHit = (ctx.topics ?? []).some((tp) => stems(tp.title).some((s) => t.includes(s)) || (tp.body ? stems(tp.body).some((s) => new RegExp(`(^|\\s)${s}`).test(t)) : false));
  const ideaish = /(иде[яиюейя]|заметк|мысл|(^|\s)тем[аеуы]?(\s|$)|списк|список|блокнот|пункт|запиши в|набросок|поздравлен)/.test(t) || !!ctx.currentTopicId || topicHit;

  if (question) {
    if (watchish || /(посмотрим|глянуть)/.test(t)) b.add('qwatch');
    if (/(подар|хоч|хотел)/.test(t)) b.add('qwish');
    if (plansish || /(сегодня|завтра|суббот|воскресен|понедельник|вторник|сред|четверг|пятниц)/.test(t)) b.add('plans');
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
  if (withCal) parts.push(`Календарь:\n${calendar(ctx.today)}`);
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
