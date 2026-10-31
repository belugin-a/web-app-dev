// Демонстрация слоя доступа к данным (пункт 5 задания).
//
// Запуск: node server/scripts/check-repository.js
//
// Скрипт работает с отдельной базой data/check.db и не трогает основную
// data/app.db. Путь задаётся до импорта конфигурации, поэтому подключение
// выполняется динамически.

// eslint-disable-next-line no-unused-vars -- переменная нужна до импорта конфигурации
const dbFile = new URL('../../data/check.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

process.env.DB_FILE = dbFile;

const { openDatabase, closeDatabase } = await import('../db.js');
const { seedDatabase } = await import('./seed.js');
const { list, getById, create, update, remove, count } = await import(
  '../repositories/tickets.repository.js'
);

const line = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);

openDatabase();

await seedDatabase();

line('Все заявки');
const all = await list({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' });
console.log(`всего в базе: ${all.total}, показано: ${all.items.length}`);
for (const ticket of all.items) {
  console.log(`  #${ticket.id} [${ticket.priority}/${ticket.status}] ${ticket.title}`);
}

line('Фильтр по статусу «в работе»');
const inProgress = await list({ status: 'в работе' });
console.log(`найдено: ${inProgress.total}`);
for (const ticket of inProgress.items) {
  console.log(`  #${ticket.id} ${ticket.title} — исполнитель: ${ticket.assignee || 'не назначен'}`);
}

line('Фильтр по приоритету «критичный»');
const critical = await list({ priority: 'критичный' });
console.log(`найдено: ${critical.total}`);
for (const ticket of critical.items) {
  console.log(`  #${ticket.id} [${ticket.status}] ${ticket.title}`);
}

line('Поиск по кириллице (регистронезависимо)');
const found = await list({ search: 'ПРИНТЕР' });
console.log(`найдено: ${found.total}`);
for (const ticket of found.items) {
  console.log(`  #${ticket.id} ${ticket.title}`);
}

line('Сортировка по теме (по алфавиту)');
const byTitle = await list({ sortBy: 'title', sortOrder: 'asc', limit: 5 });
for (const ticket of byTitle.items) {
  console.log(`  ${ticket.title}`);
}

line('Одна заявка по id');
const first = await getById(all.items[0].id);
console.log(JSON.stringify(first, null, 2));

line('Создание, изменение и удаление');
const now = new Date().toISOString();
const created = await create({
  title: 'Тестовая заявка из скрипта проверки',
  description: 'Проверка операций записи в слое доступа к данным.',
  priority: 'обычный',
  status: 'новая',
  assignee: '',
  createdAt: now,
  updatedAt: now,
});
console.log(`создана заявка #${created.id}: ${created.title}`);

const updated = await update(created.id, { status: 'в работе', assignee: 'Ирина Соколова' });
console.log(`после обновления: статус = ${updated.status}, исполнитель = ${updated.assignee}`);

const deleted = await remove(created.id);
console.log(`удаление вернуло: ${deleted}`);
console.log(`заявка после удаления: ${await getById(created.id)}`);

line('Итог');
console.log(`заявок в базе: ${await count()}`);

closeDatabase();
