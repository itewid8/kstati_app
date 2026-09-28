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
Три списка: task — дела с датой (общие для группы), wish — хотелки (личный вишлист), watch — что посмотреть (общий).
Ты НЕ ведёшь диалог и НЕ советуешь. Ты только раскладываешь фразу в JSON строго по схеме ниже. Никакого текста вне JSON.

Ответ: {"actions": [ ... ]}. Одна фраза может дать несколько действий.

Виды действий:
1) Добавить дело:   {"intent":"add","type":"task","title":"…","date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"note":"…"}
2) Добавить хотелку: {"intent":"add","type":"wish","title":"…","note":"…","link":""}
3) Добавить в смотреть: {"intent":"add","type":"watch","title":"…","kind":…,"genres":[…],"origin":…,"year":…}
4) Изменить запись: {"intent":"update","target":["id",…],"title"?:"…","date"?:"YYYY-MM-DD"|null,"time"?:"HH:MM"|null,"query":"как запись названа во фразе"}
5) Отметить:        {"intent":"mark","target":["id",…],"query":"…"}   (сделали / посмотрели / подарили)
6) Снять отметку:   {"intent":"unmark","target":["id",…],"query":"…"}
7) Удалить:         {"intent":"delete","target":["id",…],"query":"…"}
8) Вопрос «что посмотреть»: {"intent":"query_watch","kind":[…],"genre":[…],"origin":[…],"fresh":[…]}
9) Вопрос «что подарить / что хочет X»: {"intent":"query_wish","person":"имя в именительном падеже" | "me"}
10) Вопрос о планах: {"intent":"query_plans","scope":…,"category"?:…,"groups"?:[…],"people"?:[…],"from":"YYYY-MM-DD","to":"YYYY-MM-DD","query":""}
11) Непонятно:      {"intent":"unknown"}

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
    "people" + people: имена в именительном падеже — «у нас с Кариной», «у меня с Димой»;
    "category" + category (couple | family | parents | friends | other) — «у наших друзей» → friends, «у родителей» → parents, «в семье» → family;
    "groups" + groups: названия — если во фразе названа группа из списка «Мои группы» («в Футболе»);
    "current" — если не сказано, чьи.
  Если слово совпадает с названием группы из списка («моя Семья» и есть группа «Семья») — выбирай "groups".
  from/to — период из календаря: «в субботу» — один день; «на выходных» — суббота и воскресенье; «на этой неделе» — сегодня … воскресенье; «на следующей неделе» — пн … вс следующей; не сказано — 7 дней с сегодня.
  query — что ищем, если спрашивают «когда …» («когда у нас дача» → query "дача", from сегодня, to через год), иначе "".
- Если фраза не похожа ни на что из этого — {"actions":[{"intent":"unknown"}]}.

Примеры (сегодня пятница 2026-09-25):
«В субботу в семь ужин у родителей» → {"actions":[{"intent":"add","type":"task","title":"Ужин у родителей","date":"2026-09-26","time":"19:00"}]}
«Добавь Дюну и Аватар» → {"actions":[{"intent":"add","type":"watch","title":"Дюна","kind":"movie","genres":["scifi","adventure"],"origin":"foreign","year":2021},{"intent":"add","type":"watch","title":"Аватар","kind":"movie","genres":["scifi","adventure"],"origin":"foreign","year":2009}]}
«Добавь в мой вишлист кроссовки, сорок второй размер» → {"actions":[{"intent":"add","type":"wish","title":"Кроссовки","note":"42 размер","link":""}]}
«Что-нибудь смешное зарубежное» → {"actions":[{"intent":"query_watch","kind":[],"genre":["comedy"],"origin":["foreign"],"fresh":[]}]}
«Какие у нас с Кариной планы на следующую субботу?» → {"actions":[{"intent":"query_plans","scope":"people","people":["Карина"],"from":"2026-10-03","to":"2026-10-03","query":""}]}
«Что у наших друзей на выходных?» → {"actions":[{"intent":"query_plans","scope":"category","category":"friends","from":"2026-09-26","to":"2026-09-27","query":""}]}
«Когда у нас дача?» → {"actions":[{"intent":"query_plans","scope":"us","from":"2026-09-25","to":"2027-09-25","query":"дача"}]}
«Мы посмотрели Интерстеллар» (есть запись watch:m1 | Интерстеллар) → {"actions":[{"intent":"mark","target":["m1"],"query":"Интерстеллар"}]}`;

export function buildMessages(text: string, ctx: Context): Msg[] {
  const d = new Date(`${ctx.today}T00:00:00Z`);
  const people = [`${ctx.me.name} (это говорящий, «я»)`, ...ctx.people.map((p) => p.name)].join(', ');
  const ex = ctx.existing;
  const rows = [
    ...ex.tasks.map((t) => `task:${t.id} | ${t.title} | ${[t.date, t.time].filter(Boolean).join(' ') || 'без даты'}${t.done ? ' | выполнено' : ''}`),
    ...ex.watch.map((w) => `watch:${w.id} | ${w.title}${w.done ? ' | посмотрели' : ''}`),
    ...ex.wishes.map((w) => `wish:${w.id} | ${w.title}${w.done ? ' | подарили' : ''}`),
  ];

  const user = `Сегодня: ${WD[d.getUTCDay()]} ${ctx.today}, сейчас ${ctx.now}.
Календарь:
${calendar(ctx.today)}

Люди в группах: ${people}

Мои группы: ${(ctx.groups ?? []).map((g) => `${g.name} (${g.category})`).join(', ') || '—'}

Существующие записи (тип:id | название | детали):
${rows.length ? rows.join('\n') : '— нет —'}

Фраза: «${text}»`;

  return [
    { role: 'system', text: SYSTEM },
    { role: 'user', text: user },
  ];
}
