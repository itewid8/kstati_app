/**
 * Словарь для обучающих примеров (train/generate.ts): дела, люди, фильмы, хотелки, темы — с падежами,
 * чтобы фразы звучали как живые («перенеси стоматолога», «Карине к врачу»).
 * Фильмы — только те, в чьих данных (вид, жанры, страна, год) уверены: модель учится их не выдумывать.
 */

/** Дело: title — как в списке; add — как говорят при добавлении; acc — «перенеси …», «удали …» */
export type TaskWord = { title: string; add: string; acc: string };
export const TASKS: TaskWord[] = [
  { title: 'Ужин у родителей', add: 'ужин у родителей', acc: 'ужин у родителей' },
  { title: 'Стоматолог', add: 'к стоматологу', acc: 'стоматолога' },
  { title: 'Забрать посылку', add: 'забрать посылку', acc: 'посылку' },
  { title: 'Позвонить маме', add: 'позвонить маме', acc: 'звонок маме' },
  { title: 'Оплатить интернет', add: 'оплатить интернет', acc: 'оплату интернета' },
  { title: 'Купить продукты', add: 'купить продукты', acc: 'покупку продуктов' },
  { title: 'Йога', add: 'йога', acc: 'йогу' },
  { title: 'Футбол', add: 'футбол', acc: 'футбол' },
  { title: 'Бассейн', add: 'бассейн', acc: 'бассейн' },
  { title: 'Отвезти машину в сервис', add: 'отвезти машину в сервис', acc: 'сервис' },
  { title: 'Записаться к врачу', add: 'записаться к врачу', acc: 'запись к врачу' },
  { title: 'Забрать ребёнка из садика', add: 'забрать ребёнка из садика', acc: 'садик' },
  { title: 'Встреча с друзьями', add: 'встреча с друзьями', acc: 'встречу с друзьями' },
  { title: 'Уборка', add: 'уборка', acc: 'уборку' },
  { title: 'Стрижка', add: 'стрижка', acc: 'стрижку' },
  { title: 'Вынести мусор', add: 'вынести мусор', acc: 'мусор' },
  { title: 'Полить цветы', add: 'полить цветы', acc: 'полив цветов' },
  { title: 'Заплатить за квартиру', add: 'заплатить за квартиру', acc: 'оплату квартиры' },
  { title: 'Поменять резину', add: 'поменять резину', acc: 'замену резины' },
  { title: 'Родительское собрание', add: 'родительское собрание', acc: 'собрание' },
  { title: 'Тренировка', add: 'тренировка', acc: 'тренировку' },
  { title: 'Массаж', add: 'массаж', acc: 'массаж' },
  { title: 'Купить подарок маме', add: 'купить подарок маме', acc: 'подарок маме' },
  { title: 'Сдать анализы', add: 'сдать анализы', acc: 'анализы' },
  { title: 'Забрать документы', add: 'забрать документы', acc: 'документы' },
  { title: 'Починить кран', add: 'починить кран', acc: 'кран' },
  { title: 'Ветеринар', add: 'к ветеринару', acc: 'ветеринара' },
  { title: 'Английский', add: 'урок английского', acc: 'английский' },
  { title: 'Баня', add: 'баня', acc: 'баню' },
  { title: 'Зарядка', add: 'зарядка', acc: 'зарядку' },
  { title: 'Выгулять собаку', add: 'выгулять собаку', acc: 'прогулку с собакой' },
  { title: 'Купить корм коту', add: 'купить корм коту', acc: 'корм коту' },
];

/** Имя: nom «Карина», dat «Карине», ins «Кариной», gen «Карины» */
export type Person = { nom: string; dat: string; ins: string; gen: string };
export const PEOPLE: Person[] = [
  { nom: 'Карина', dat: 'Карине', ins: 'Кариной', gen: 'Карины' },
  { nom: 'Дима', dat: 'Диме', ins: 'Димой', gen: 'Димы' },
  { nom: 'Маша', dat: 'Маше', ins: 'Машей', gen: 'Маши' },
  { nom: 'Петя', dat: 'Пете', ins: 'Петей', gen: 'Пети' },
  { nom: 'Оля', dat: 'Оле', ins: 'Олей', gen: 'Оли' },
  { nom: 'Лена', dat: 'Лене', ins: 'Леной', gen: 'Лены' },
  { nom: 'Артём', dat: 'Артёму', ins: 'Артёмом', gen: 'Артёма' },
  { nom: 'Игорь', dat: 'Игорю', ins: 'Игорем', gen: 'Игоря' },
  { nom: 'Аня', dat: 'Ане', ins: 'Аней', gen: 'Ани' },
  { nom: 'Саша', dat: 'Саше', ins: 'Сашей', gen: 'Саши' },
  { nom: 'Женя', dat: 'Жене', ins: 'Женей', gen: 'Жени' },
  { nom: 'Катя', dat: 'Кате', ins: 'Катей', gen: 'Кати' },
];

export type Kind = 'movie' | 'series' | 'cartoon' | 'show' | 'standup';
export type Genre = 'comedy' | 'drama' | 'action' | 'thriller' | 'horror' | 'scifi' | 'detective' | 'romance' | 'adventure' | 'documentary';
/** Фильм: title — официальное название; acc — «добавь …», «посмотрели …» */
export type Film = { title: string; acc: string; kind: Kind; genres: Genre[]; origin: 'ru' | 'foreign'; year: number };
export const FILMS: Film[] = [
  { title: 'Интерстеллар', acc: 'Интерстеллар', kind: 'movie', genres: ['scifi', 'drama'], origin: 'foreign', year: 2014 },
  { title: 'Дюна', acc: 'Дюну', kind: 'movie', genres: ['scifi', 'adventure'], origin: 'foreign', year: 2021 },
  { title: 'Аватар', acc: 'Аватар', kind: 'movie', genres: ['scifi', 'adventure'], origin: 'foreign', year: 2009 },
  { title: 'Начало', acc: 'Начало', kind: 'movie', genres: ['scifi', 'thriller'], origin: 'foreign', year: 2010 },
  { title: 'Матрица', acc: 'Матрицу', kind: 'movie', genres: ['scifi', 'action'], origin: 'foreign', year: 1999 },
  { title: 'Титаник', acc: 'Титаник', kind: 'movie', genres: ['drama', 'romance'], origin: 'foreign', year: 1997 },
  { title: 'Зелёная миля', acc: 'Зелёную милю', kind: 'movie', genres: ['drama'], origin: 'foreign', year: 1999 },
  { title: 'Побег из Шоушенка', acc: 'Побег из Шоушенка', kind: 'movie', genres: ['drama'], origin: 'foreign', year: 1994 },
  { title: 'Джокер', acc: 'Джокера', kind: 'movie', genres: ['drama', 'thriller'], origin: 'foreign', year: 2019 },
  { title: 'Оппенгеймер', acc: 'Оппенгеймера', kind: 'movie', genres: ['drama'], origin: 'foreign', year: 2023 },
  { title: 'Достать ножи', acc: 'Достать ножи', kind: 'movie', genres: ['detective', 'comedy'], origin: 'foreign', year: 2019 },
  { title: 'Остров проклятых', acc: 'Остров проклятых', kind: 'movie', genres: ['thriller', 'detective'], origin: 'foreign', year: 2010 },
  { title: '1+1', acc: '1+1', kind: 'movie', genres: ['comedy', 'drama'], origin: 'foreign', year: 2011 },
  { title: 'Брат', acc: 'Брат', kind: 'movie', genres: ['drama', 'action'], origin: 'ru', year: 1997 },
  { title: 'Брат 2', acc: 'Брат 2', kind: 'movie', genres: ['action', 'comedy'], origin: 'ru', year: 2000 },
  { title: 'Ирония судьбы, или С лёгким паром!', acc: 'Иронию судьбы', kind: 'movie', genres: ['comedy', 'romance'], origin: 'ru', year: 1975 },
  { title: 'Москва слезам не верит', acc: 'Москва слезам не верит', kind: 'movie', genres: ['drama', 'romance'], origin: 'ru', year: 1979 },
  { title: 'Бриллиантовая рука', acc: 'Бриллиантовую руку', kind: 'movie', genres: ['comedy'], origin: 'ru', year: 1968 },
  { title: 'Джентльмены удачи', acc: 'Джентльменов удачи', kind: 'movie', genres: ['comedy'], origin: 'ru', year: 1971 },
  { title: 'Холоп', acc: 'Холопа', kind: 'movie', genres: ['comedy'], origin: 'ru', year: 2019 },
  { title: 'Движение вверх', acc: 'Движение вверх', kind: 'movie', genres: ['drama'], origin: 'ru', year: 2017 },
  { title: 'Легенда № 17', acc: 'Легенду № 17', kind: 'movie', genres: ['drama'], origin: 'ru', year: 2013 },
  { title: 'Т-34', acc: 'Т-34', kind: 'movie', genres: ['action', 'drama'], origin: 'ru', year: 2018 },
  { title: 'Чебурашка', acc: 'Чебурашку', kind: 'movie', genres: ['comedy', 'adventure'], origin: 'ru', year: 2022 },
  { title: 'Шрэк', acc: 'Шрэка', kind: 'cartoon', genres: ['comedy', 'adventure'], origin: 'foreign', year: 2001 },
  { title: 'Король Лев', acc: 'Короля Льва', kind: 'cartoon', genres: ['drama', 'adventure'], origin: 'foreign', year: 1994 },
  { title: 'Холодное сердце', acc: 'Холодное сердце', kind: 'cartoon', genres: ['adventure', 'comedy'], origin: 'foreign', year: 2013 },
  { title: 'Тайна Коко', acc: 'Тайну Коко', kind: 'cartoon', genres: ['adventure', 'comedy'], origin: 'foreign', year: 2017 },
  { title: 'Маша и Медведь', acc: 'Машу и Медведя', kind: 'cartoon', genres: ['comedy'], origin: 'ru', year: 2009 },
  { title: 'Смешарики', acc: 'Смешариков', kind: 'cartoon', genres: ['comedy'], origin: 'ru', year: 2004 },
  { title: 'Слово пацана', acc: 'Слово пацана', kind: 'series', genres: ['drama'], origin: 'ru', year: 2023 },
  { title: 'Кухня', acc: 'Кухню', kind: 'series', genres: ['comedy'], origin: 'ru', year: 2012 },
  { title: 'Интерны', acc: 'Интернов', kind: 'series', genres: ['comedy'], origin: 'ru', year: 2010 },
  { title: 'Метод', acc: 'Метод', kind: 'series', genres: ['detective', 'thriller'], origin: 'ru', year: 2015 },
  { title: 'Мажор', acc: 'Мажора', kind: 'series', genres: ['action', 'detective'], origin: 'ru', year: 2014 },
  { title: 'Во все тяжкие', acc: 'Во все тяжкие', kind: 'series', genres: ['drama', 'thriller'], origin: 'foreign', year: 2008 },
  { title: 'Игра престолов', acc: 'Игру престолов', kind: 'series', genres: ['drama', 'adventure'], origin: 'foreign', year: 2011 },
  { title: 'Друзья', acc: 'Друзей', kind: 'series', genres: ['comedy'], origin: 'foreign', year: 1994 },
  { title: 'Тед Лассо', acc: 'Теда Лассо', kind: 'series', genres: ['comedy', 'drama'], origin: 'foreign', year: 2020 },
  { title: 'Очень странные дела', acc: 'Очень странные дела', kind: 'series', genres: ['scifi', 'horror'], origin: 'foreign', year: 2016 },
  { title: 'Шерлок', acc: 'Шерлока', kind: 'series', genres: ['detective', 'drama'], origin: 'foreign', year: 2010 },
  { title: 'Планета Земля', acc: 'Планету Земля', kind: 'series', genres: ['documentary'], origin: 'foreign', year: 2006 },
  { title: 'Что? Где? Когда?', acc: 'Что? Где? Когда?', kind: 'show', genres: [], origin: 'ru', year: 1975 },
];
/** Неизвестные модели названия: только title, без вида, жанров и года */
export const UNKNOWN_FILMS = ['Тихий двор', 'Последний рейс', 'Северный ветер', 'Дом у озера', 'Лето в городе', 'Чужие письма'];

/** Хотелка: say — как говорят («хочу …», «в вишлист …»); title — вещь; note — детали */
export type WishWord = { say: string; title: string; note: string };
export const WISHES: WishWord[] = [
  { say: 'наушники с шумоподавлением', title: 'Наушники', note: 'С шумоподавлением' },
  { say: 'кроссовки, сорок второй размер', title: 'Кроссовки', note: '42 размер' },
  { say: 'кофемашину', title: 'Кофемашина', note: '' },
  { say: 'электросамокат', title: 'Электросамокат', note: '' },
  { say: 'зимнюю куртку, размер M', title: 'Зимняя куртка', note: 'Размер M' },
  { say: 'умную колонку', title: 'Умная колонка', note: '' },
  { say: 'набор Лего', title: 'Набор Лего', note: '' },
  { say: 'сертификат в спа', title: 'Сертификат в спа', note: '' },
  { say: 'рюкзак для ноутбука, чёрный', title: 'Рюкзак для ноутбука', note: 'Чёрный' },
];

export type Category = 'couple' | 'family' | 'parents' | 'friends' | 'other';
export const GROUPS: { name: string; category: Category }[] = [
  { name: 'Мы с Кариной', category: 'couple' },
  { name: 'Семья', category: 'family' },
  { name: 'Родители', category: 'parents' },
  { name: 'Друзья', category: 'friends' },
  { name: 'Футбол', category: 'friends' },
  { name: 'Работа', category: 'other' },
];

/** Тема: title; into — «добавь в …»; at — «… в списке продуктов»; from — «убери … из …»; list — пункты списка */
export type TopicWord = { title: string; into: string; at?: string; from?: string; list?: string[] };
export const TOPICS: TopicWord[] = [
  { title: 'Список продуктов', into: 'в список продуктов', at: 'в списке продуктов', from: 'из списка продуктов', list: ['Молоко', 'Хлеб', 'Яйца', 'Сыр'] },
  { title: 'Идеи для приложения', into: 'в идеи для приложения' },
  { title: 'Подарки', into: 'в подарки' },
  { title: 'Что взять в поход', into: 'в список для похода', at: 'в списке для похода', from: 'из списка для похода', list: ['Палатка', 'Спальник', 'Фонарик'] },
  { title: 'Поздравления', into: 'в поздравления' },
  { title: 'Книги', into: 'в книги' },
];
/** Текст идеи — как говорят (без «запиши идею») */
export const IDEAS = [
  'в виджете показывать погоду на завтра',
  'сделать тёмную тему для календаря',
  'подарить Диме курс фотографии',
  'съездить летом на Байкал',
  'начать вести дневник благодарности',
  'попробовать приготовить рамен дома',
  'прочитать «Сто лет одиночества»',
  'маме на юбилей заказать фотокнигу',
];

/** Не команды: шум, обрывки, вопросы не про приложение */
export const NOISE = ['ммм', 'так', 'алло', 'а что', 'какая погода завтра', 'расскажи анекдот', 'сколько сейчас времени', 'включи музыку', 'кто выиграл вчера', 'привет, как дела'];
