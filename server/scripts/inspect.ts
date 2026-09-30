/**
 * Что лежит в базе у человека — только чтение, ничего не меняет.
 *   npm run inspect -- почта@пример.ру
 * Нужны YDB_DOCAPI_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (как для npm run tables).
 * Показывает группы, дела в них и ленту за 3 дня: кто что добавлял и удалял.
 */
import { config } from '../src/config.js';
import { YdbStore } from '../src/store/ydb.js';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email || !config.ydbEndpoint || !config.awsKeyId || !config.awsSecret) {
  console.error('Использование: npm run inspect -- почта  (и переменные YDB_DOCAPI_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
  process.exit(1);
}
const s = new YdbStore({ endpoint: config.ydbEndpoint, accessKeyId: config.awsKeyId, secretAccessKey: config.awsSecret });

const uid = await s.getKey(`email#${email}`);
if (!uid) {
  console.log(`Нет аккаунта с почтой ${email}`);
  process.exit(0);
}
const me = await s.getUser(uid);
console.log(`Аккаунт: ${me?.name} (${uid})`);
const groups = await s.getGroups(await s.listMemberships(uid));
const since = new Date(Date.now() - 3 * 86400000).toISOString();
const names = new Map<string, string>();
for (const g of groups) for (const u of await s.getUsers(g.memberIds)) names.set(u.id, u.name);

for (const g of groups) {
  const items = await s.listItems(g.id);
  const tasks = items.filter((i) => i.type === 'task');
  const rev = (await s.getCounters([`grev#${g.id}`]))[`grev#${g.id}`];
  console.log(`\nГруппа «${g.name}» (${g.id}), участники: ${g.memberIds.map((m) => names.get(m) ?? m).join(', ')}, ревизия ${rev}`);
  console.log(`  дел: ${tasks.length}, в «Смотреть»: ${items.length - tasks.length}`);
  for (const t of tasks.slice(0, 40)) {
    if (t.type !== 'task') continue;
    console.log(`  · ${t.title} | ${t.date ?? 'без даты'} ${t.time ?? ''} | ${t.repeat ? 'повтор' : ''} ${t.doneAt ? 'выполнено' : ''} | обновлено ${t.updatedAt}`);
  }
  try {
    const feed = await s.listActivity(g.id, since, 60);
    console.log(`  лента за 3 дня: ${feed.length} записей`);
    for (const a of feed) console.log(`    ${a.at}  ${names.get(a.actor) ?? a.actor}  ${a.kind}  «${a.title ?? ''}»${a.date ? ' ' + a.date : ''}`);
  } catch (e) {
    console.log(`  лента недоступна: ${(e as Error).message}`);
  }
}
