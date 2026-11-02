import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { openDatabase, closeDatabase } from '../server/db.js';
import { seedDatabase } from '../server/scripts/seed.js';
import { app } from '../server/app.js';

// Тесты работают с отдельной базой и поднимают настоящий HTTP-сервер
// на случайном порту — так проверяется весь путь запроса.
const testDbFile = new URL('../data/test-api.db', import.meta.url)
  .pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

process.env.DB_FILE = testDbFile;

fs.rmSync(testDbFile, { force: true });
fs.rmSync(`${testDbFile}-wal`, { force: true });
fs.rmSync(`${testDbFile}-shm`, { force: true });

openDatabase();
await seedDatabase();

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));

const baseUrl = `http://127.0.0.1:${server.address().port}`;

/**
 * Выполняет запрос и возвращает статус с разобранным телом.
 * cookie передаётся в заголовке вручную — так проверяется,
 * что сервер действительно выдаёт и принимает сессионную cookie.
 */
async function request(method, url, body, cookie) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    setCookie: response.headers.getSetCookie?.()[0] ?? null,
  };
}

/** Входит в аккаунт и возвращает cookie сессии. */
async function login(email, password) {
  const result = await request('POST', '/api/auth/login', { email, password });

  assert.equal(result.status, 200, `вход ${email} должен быть успешным`);

  return result.setCookie;
}

/** Регистрирует нового пользователя и возвращает cookie сессии. */
async function register(name, email, password) {
  const result = await request('POST', '/api/auth/register', { name, email, password });

  assert.equal(result.status, 201, `регистрация ${email} должна быть успешной`);

  return result.setCookie;
}

const adminCookie = await login('admin@example.com', 'admin12345');
const userCookie = await login('user@example.com', 'user12345');

/* ------------------------------------------------------------------ */
/* Открытые маршруты                                                   */
/* ------------------------------------------------------------------ */

test('GET /api/health отвечает 200', async () => {
  const { status, body } = await request('GET', '/api/health');

  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('GET /api/meta отдаёт статусы, приоритеты и переходы', async () => {
  const { status, body } = await request('GET', '/api/meta');

  assert.equal(status, 200);
  assert.equal(body.statuses.length, 5);
  assert.equal(body.priorities.length, 4);
  assert.ok(body.executors.length > 0, 'есть список исполнителей');
  assert.deepEqual(body.transitions['закрыта'], []);
});

test('GET /api/tickets возвращает список и общее количество', async () => {
  const { status, body } = await request('GET', '/api/tickets');

  assert.equal(status, 200);
  assert.equal(body.total, 20);
  assert.equal(body.items.length, 20);
});

test('GET /api/tickets доступен гостю', async () => {
  const { status, body } = await request('GET', '/api/tickets');

  assert.equal(status, 200, 'гость видит список заявок');
  assert.ok(body.total > 0);
});

test('GET /api/tickets с фильтром по статусу', async () => {
  const { status, body } = await request('GET', '/api/tickets?status=' + encodeURIComponent('в работе'));

  assert.equal(status, 200);
  assert.ok(body.items.every((ticket) => ticket.status === 'в работе'));
});

test('GET /api/tickets с неизвестным фильтром отдаёт 400', async () => {
  const { status, body } = await request('GET', '/api/tickets?status=выдумка');

  assert.equal(status, 400);
  assert.match(body.error, /Неизвестный статус/);
});

test('GET /api/tickets?assignee=none отдаёт заявки без исполнителя', async () => {
  const { status, body } = await request('GET', '/api/tickets?assignee=none');

  assert.equal(status, 200);
  assert.ok(body.total > 0);
  assert.ok(body.items.every((ticket) => ticket.assignee === ''));
});

test('GET /api/tickets?overdue=true отдаёт только просроченные', async () => {
  const { status, body } = await request('GET', '/api/tickets?overdue=true');

  assert.equal(status, 200);
  assert.ok(body.total > 0);
  assert.ok(body.items.every((ticket) => ticket.isOverdue));
});

test('GET /api/tickets/:id отдаёт заявку', async () => {
  const { status, body } = await request('GET', '/api/tickets/3');

  assert.equal(status, 200);
  assert.equal(body.ticket.id, 3);
  assert.equal(typeof body.ticket.isOverdue, 'boolean');
});

test('GET несуществующей заявки отдаёт 404', async () => {
  const { status, body } = await request('GET', '/api/tickets/9999');

  assert.equal(status, 404);
  assert.match(body.error, /не найдена/);
});

test('GET с некорректным идентификатором отдаёт 400', async () => {
  const { status } = await request('GET', '/api/tickets/abc');

  assert.equal(status, 400);
});

test('GET /api/stats возвращает сводку', async () => {
  const { status, body } = await request('GET', '/api/stats');

  assert.equal(status, 200);
  assert.ok(body.total >= 20, 'в сводке есть как минимум демо-заявки');
  assert.equal(body.open + body.closed, body.total);
  assert.equal(
    Object.values(body.byStatus).reduce((sum, value) => sum + value, 0),
    body.total,
    'сумма по статусам равна общему количеству',
  );
});

test('неизвестный маршрут API отдаёт 404 в JSON', async () => {
  const { status, body } = await request('GET', '/api/несуществующий');

  assert.equal(status, 404);
  assert.match(body.error, /Маршрут не найден/);
});

/* ------------------------------------------------------------------ */
/* Создание заявки                                                      */
/* ------------------------------------------------------------------ */

test('POST /api/tickets гостю отдаёт 401', async () => {
  const { status, body } = await request('POST', '/api/tickets', {
    title: 'Заявка, созданная гостем',
    priority: 'обычный',
  });

  assert.equal(status, 401);
  assert.match(body.error, /Требуется вход/);
});

test('POST /api/tickets создаёт заявку со статусом «новая»', async () => {
  const { status, body } = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка, созданная автотестом', description: 'Проверка маршрута создания.', priority: 'высокий' },
    userCookie,
  );

  assert.equal(status, 201);
  assert.equal(body.ticket.status, 'новая');
  assert.equal(body.ticket.slaHours, 8);
});

test('POST /api/tickets с некорректными данными отдаёт 400', async () => {
  const { status, body } = await request(
    'POST',
    '/api/tickets',
    { title: 'Ок', priority: 'высокий' },
    userCookie,
  );

  assert.equal(status, 400);
  assert.match(body.error, /Тема/);
});

/* ------------------------------------------------------------------ */
/* Права доступа                                                       */
/* ------------------------------------------------------------------ */

test('PATCH /api/tickets/:id пользователю с ролью user отдаёт 403', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка для проверки правки', priority: 'обычный' },
    userCookie,
  );

  const { status, body } = await request(
    'PATCH',
    `/api/tickets/${created.body.ticket.id}`,
    { title: 'Заявка для проверки правки (уточнение)' },
    userCookie,
  );

  assert.equal(status, 403);
  assert.match(body.error, /Недостаточно прав/);
});

test('PATCH /api/tickets/:id администратору меняет поля', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка для правки через API', priority: 'обычный' },
    userCookie,
  );

  const { status, body } = await request(
    'PATCH',
    `/api/tickets/${created.body.ticket.id}`,
    { title: 'Заявка для правки через API (уточнение)', assignee: 'Ирина Соколова' },
    adminCookie,
  );

  assert.equal(status, 200);
  assert.equal(body.ticket.assignee, 'Ирина Соколова');
});

test('POST /api/tickets/:id/status меняет статус', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка для смены статуса через API', priority: 'обычный' },
    userCookie,
  );

  const { status, body } = await request(
    'POST',
    `/api/tickets/${created.body.ticket.id}/status`,
    { status: 'в работе' },
    adminCookie,
  );

  assert.equal(status, 200);
  assert.equal(body.ticket.status, 'в работе');
});

test('POST /api/tickets/:id/status с запрещённым переходом отдаёт 409', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка для запрещённого перехода', priority: 'обычный' },
    userCookie,
  );

  const { status, body } = await request(
    'POST',
    `/api/tickets/${created.body.ticket.id}/status`,
    { status: 'решена' },
    adminCookie,
  );

  assert.equal(status, 409);
  assert.match(body.error, /нельзя перейти/);
});

test('DELETE заявки в статусе «новая» отдаёт 200', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка для удаления через API', priority: 'низкий' },
    userCookie,
  );

  const { status, body } = await request(
    'DELETE',
    `/api/tickets/${created.body.ticket.id}`,
    undefined,
    adminCookie,
  );

  assert.equal(status, 200);
  assert.equal(body.deleted, true);
});

test('DELETE заявки в работе отдаёт 409', async () => {
  const created = await request(
    'POST',
    '/api/tickets',
    { title: 'Заявка в работе для удаления через API', priority: 'обычный' },
    userCookie,
  );

  await request(
    'POST',
    `/api/tickets/${created.body.ticket.id}/status`,
    { status: 'в работе' },
    adminCookie,
  );

  const { status, body } = await request(
    'DELETE',
    `/api/tickets/${created.body.ticket.id}`,
    undefined,
    adminCookie,
  );

  assert.equal(status, 409);
  assert.match(body.error, /Удалить можно только/);
});

test('GET /api/users/me гостю отдаёт 401', async () => {
  const { status } = await request('GET', '/api/users/me');

  assert.equal(status, 401);
});

test('GET /api/users/me вошедшему отдаёт его профиль', async () => {
  const { status, body } = await request('GET', '/api/users/me', undefined, userCookie);

  assert.equal(status, 200);
  assert.equal(body.user.email, 'user@example.com');
  assert.equal(body.user.role, 'user');
  assert.equal(body.user.passwordHash, undefined, 'хеш пароля наружу не отдаётся');
});

test('PATCH /api/users/me меняет имя', async () => {
  const cookie = await register('Тестовый Пользователь', 'profile@example.com', 'password123');

  const { status, body } = await request(
    'PATCH',
    '/api/users/me',
    { name: 'Переименованный' },
    cookie,
  );

  assert.equal(status, 200);
  assert.equal(body.user.name, 'Переименованный');
});

test.after(() => {
  server.close();
  closeDatabase();
});
