import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { openDatabase, closeDatabase } from '../server/db.js';
import { seedDatabase } from '../server/scripts/seed.js';
import {
  createTicket,
  changeStatus,
  deleteTicket,
  listTickets,
  getTicket,
  updateTicket,
  getStats,
  getMeta,
} from '../server/services/tickets.service.js';

// Тесты работают с отдельной базой, чтобы не трогать data/app.db.
// Файл удаляется перед запуском — каждый прогон начинается с чистой базы.
const testDbFile = new URL('../data/test.db', import.meta.url)
  .pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

process.env.DB_FILE = testDbFile;

fs.rmSync(testDbFile, { force: true });
fs.rmSync(`${testDbFile}-wal`, { force: true });
fs.rmSync(`${testDbFile}-shm`, { force: true });

openDatabase();
await seedDatabase();

test('список заявок возвращаетitems и общее количество', async () => {
  const result = await listTickets();

  assert.equal(result.total, 20);
  assert.equal(result.items.length, 20);
});

test('фильтр по статусу отбирает только нужные заявки', async () => {
  const result = await listTickets({ status: 'в работе' });

  assert.ok(result.total > 0);
  assert.ok(result.items.every((ticket) => ticket.status === 'в работе'));
});

test('поиск нечувствителен к регистру и ищет по кириллице', async () => {
  const result = await listTickets({ search: 'ПРИНТЕР' });

  assert.ok(result.total > 0);
  assert.ok(result.items.every((ticket) => /принтер/i.test(ticket.title + ticket.description)));
});

test('неизвестный статус в фильтре отклоняется', async () => {
  await assert.rejects(() => listTickets({ status: 'несуществующий' }), { status: 400 });
});

test('фильтр «none» отбирает заявки без исполнителя', async () => {
  const result = await listTickets({ assignee: 'none' });

  assert.ok(result.total > 0, 'есть заявки без исполнителя');
  assert.ok(result.items.every((ticket) => ticket.assignee === ''));
});

test('фильтр по исполнителю отбирает только его заявки', async () => {
  const result = await listTickets({ assignee: 'Пётр Крылов' });

  assert.ok(result.total > 0);
  assert.ok(result.items.every((ticket) => ticket.assignee === 'Пётр Крылов'));
});

test('фильтр по просроченным отбирает только просроченные', async () => {
  const result = await listTickets({ overdue: 'true' });

  assert.ok(result.total > 0, 'есть просроченные заявки');
  assert.ok(result.items.every((ticket) => ticket.isOverdue));
});

test('список просроченных совпадает со сводкой', async () => {
  const result = await listTickets({ overdue: 'true' });
  const stats = await getStats();

  assert.equal(result.total, stats.overdue);
  assert.deepEqual(
    result.items.map((ticket) => ticket.id).sort((a, b) => a - b),
    [...stats.overdueIds].sort((a, b) => a - b),
  );
});

test('создание заявки даёт статус «новая»', async () => {
  const ticket = await createTicket({
    title: 'Тестовая заявка для автотеста',
    description: 'Проверка создания.',
    priority: 'обычный',
  });

  assert.equal(ticket.status, 'новая');
  assert.equal(ticket.slaHours, 24);
  assert.equal(ticket.isOverdue, false);
});

test('создание заявки с короткой темой отклоняется', async () => {
  await assert.rejects(
    () => createTicket({ title: 'Ок', priority: 'обычный' }),
    { status: 400 },
  );
});

test('создание заявки с неизвестным приоритетом отклоняется', async () => {
  await assert.rejects(
    () => createTicket({ title: 'Длинная тема заявки', priority: 'сверхважный' }),
    { status: 400 },
  );
});

test('разрешённый переход статуса выполняется', async () => {
  const created = await createTicket({ title: 'Заявка для смены статуса', priority: 'обычный' });
  const moved = await changeStatus(created.id, { status: 'в работе' });

  assert.equal(moved.status, 'в работе');
});

test('запрещённый переход статуса отклоняется с кодом 409', async () => {
  const created = await createTicket({ title: 'Заявка для запрета перехода', priority: 'обычный' });

  await assert.rejects(() => changeStatus(created.id, { status: 'решена' }), { status: 409 });
});

test('из закрытой заявки нельзя перейти в другой статус', async () => {
  const created = await createTicket({ title: 'Заявка для закрытия', priority: 'обычный' });

  await changeStatus(created.id, { status: 'закрыта' });

  await assert.rejects(() => changeStatus(created.id, { status: 'в работе' }), { status: 409 });
});

test('статус нельзя сменить обычным редактированием', async () => {
  const created = await createTicket({ title: 'Заявка для проверки правки', priority: 'обычный' });

  await assert.rejects(() => updateTicket(created.id, { status: 'в работе' }), { status: 400 });
});

test('заявку в статусе «новая» можно удалить', async () => {
  const created = await createTicket({ title: 'Заявка для удаления', priority: 'низкий' });
  const result = await deleteTicket(created.id);

  assert.equal(result.deleted, true);
  await assert.rejects(() => getTicket(created.id), { status: 404 });
});

test('заявку в работе удалить нельзя', async () => {
  const created = await createTicket({ title: 'Заявка в работе для удаления', priority: 'обычный' });

  await changeStatus(created.id, { status: 'в работе' });

  await assert.rejects(() => deleteTicket(created.id), { status: 409 });
});

test('сводка содержит счётчики и таблицу сроков', async () => {
  const stats = await getStats();

  assert.ok(stats.total >= 20, 'в сводке есть как минимум демо-заявки');
  assert.equal(stats.open + stats.closed, stats.total);
  assert.equal(
    Object.values(stats.byStatus).reduce((sum, value) => sum + value, 0),
    stats.total,
    'сумма по статусам равна общему количеству',
  );
  assert.deepEqual(Object.keys(stats.byStatus).sort(), [
    'закрыта',
    'ожидает',
    'в работе',
    'новая',
    'решена',
  ].sort());
  assert.equal(stats.slaHours['критичный'], 4);
});

test('справочные значения содержат статусы, приоритеты и переходы', () => {
  const meta = getMeta();

  assert.equal(meta.statuses.length, 5);
  assert.equal(meta.priorities.length, 4);
  assert.ok(meta.executors.length > 0, 'есть список исполнителей');
  assert.deepEqual(meta.transitions['закрыта'], []);
  assert.deepEqual(meta.transitions['новая'], ['в работе', 'закрыта']);
});

test.after(() => {
  closeDatabase();
});
