import { fileURLToPath } from 'node:url';

// Демонстрация слоя бизнес-логики (пункт 4 задания).
//
// Запуск: node server/scripts/check-service.js
//
// Скрипт работает с отдельной базой data/check.db и не трогает основную
// data/app.db.

const dbFile = new URL('../../data/check.db', import.meta.url)
  .pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

process.env.DB_FILE = dbFile;

const { openDatabase, closeDatabase } = await import('../db.js');
const { seedDatabase } = await import('./seed.js');
const {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  changeStatus,
  deleteTicket,
  getStats,
  getMeta,
} = await import('../services/tickets.service.js');

const line = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);

/** Печатает результат вызова и текст ошибки, если она выброшена. */
async function step(title, action) {
  console.log(`\n[${title}]`);

  try {
    const result = await action();
    console.log('  ✓', result);
  } catch (error) {
    console.log(`  ✗ ${error.status ?? ''} ${error.message}`.trim());
  }
}

openDatabase();
await seedDatabase();

line('Справочные значения');
const meta = getMeta();
console.log('статусы:   ', meta.statuses.join(', '));
console.log('приоритеты:', meta.priorities.join(', '));
console.log('SLA (ч):   ', JSON.stringify(meta.slaHours));

line('Список с фильтром и поиском');
const list = await listTickets({ status: 'в работе', search: 'принтер' });
console.log(`найдено: ${list.total}`);
for (const ticket of list.items) {
  console.log(
    `  #${ticket.id} [${ticket.priority}] ${ticket.title} — SLA ${ticket.slaHours} ч, просрочена: ${ticket.isOverdue}`,
  );
}

line('Создание заявки');
const created = await createTicket({
  title: 'Не включается монитор в кабинете 5.04',
  description: 'Проверка сервисного меню монитора.',
  priority: 'обычный',
  assignee: '',
});
console.log(`создана #${created.id}: ${created.title} [${created.status}]`);
console.log(`срок обработки: ${created.slaHours} ч, просрочена: ${created.isOverdue}`);

line('Валидация');
await step('пустая тема', () => createTicket({ title: '', priority: 'обычный' }));
await step('неизвестный приоритет', () => createTicket({ title: 'Проверка', priority: 'сверхважный' }));
await step('неизвестный статус в фильтре', () => listTickets({ status: 'несуществующий' }));
await step('запрос несуществующей заявки', () => getTicket(9999));

line('Переходы статусов');
await step('новая → в работе', async () => {
  const ticket = await changeStatus(created.id, { status: 'в работе' });
  return `статус: ${ticket.status}`;
});

await step('в работе → ожидает', async () => {
  const ticket = await changeStatus(created.id, { status: 'ожидает' });
  return `статус: ${ticket.status}`;
});

await step('ожидает → решена', async () => {
  const ticket = await changeStatus(created.id, { status: 'решена' });
  return `статус: ${ticket.status}`;
});

await step('повторно «ожидает» (из «решена» запрещён)', () =>
  changeStatus(created.id, { status: 'ожидает' }));

await step('решена → в работе (переоткрытие)', async () => {
  const ticket = await changeStatus(created.id, { status: 'в работе' });
  return `статус: ${ticket.status}`;
});

await step('в работе → закрыта', async () => {
  const ticket = await changeStatus(created.id, { status: 'закрыта' });
  return `статус: ${ticket.status}`;
});

await step('из закрытой — любой переход', () => changeStatus(created.id, { status: 'в работе' }));

line('Изменение полей');
await step('смена статуса через PATCH (запрещена)', () =>
  updateTicket(created.id, { status: 'новая' }));

await step('смена темы и исполнителя', async () => {
  const ticket = await updateTicket(created.id, {
    title: 'Не включается монитор в кабинете 5.04 (уточнение)',
    assignee: 'Ирина Соколова',
  });
  return `тема: ${ticket.title}, исполнитель: ${ticket.assignee}`;
});

await step('без изменяемых полей', () => updateTicket(created.id, {}));

line('Удаление');
const fresh = await createTicket({
  title: 'Черновик заявки, которую сразу удалят',
  priority: 'низкий',
});
await step('удалить заявку в статусе «новая»', async () => {
  const result = await deleteTicket(fresh.id);
  return `удалено: ${result.deleted}`;
});

await step('удалить заявку в статусе «в работе»', () => deleteTicket(created.id));

line('Сводка');
const stats = await getStats();
console.log(`всего:           ${stats.total}`);
console.log(`открытых:        ${stats.open}`);
console.log(`закрытых:        ${stats.closed}`);
console.log(`просроченных:    ${stats.overdue} (id: ${stats.overdueIds.join(', ') || '—'})`);
console.log(`среднее время решения: ${stats.averageHours} ч`);
console.log('по статусам:    ', JSON.stringify(stats.byStatus));
console.log('по приоритетам: ', JSON.stringify(stats.byPriority));

closeDatabase();
