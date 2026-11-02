import { expect, test } from '@playwright/test';

import { login, uniqueEmail } from './helpers.js';

/**
 * Проверки безопасности: права доступа, устойчивость к вводу, вывод
 * пользовательских данных.
 *
 * Каждая проверка фиксирует ожидаемое поведение: если ограничение снова
 * ослабнет, тест упадёт.
 */

/* ------------------------------------------------------------------ */
/* Права доступа                                                       */
/* ------------------------------------------------------------------ */

test('роль нельзя выдать себе изменением профиля', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.patch('/api/users/me', {
    data: { name: 'Пользователь', role: 'admin' },
  });

  expect(response.status()).toBe(200);

  const { user } = await response.json();

  expect(user.role).toBe('user');
});

test('роль нельзя выдать себе при регистрации', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.post('/api/auth/register', {
    data: {
      name: 'Самоназначенный администратор',
      email: uniqueEmail('escalated'),
      password: 'password123',
      role: 'admin',
    },
  });

  expect(response.status()).toBe(201);

  const { user } = await response.json();

  expect(user.role).toBe('user');
});

test('пользователь с ролью user не может удалить заявку', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.delete('/api/tickets/1');

  expect(response.status()).toBe(403);

  const body = await response.json();
  expect(body.error).toContain('Недостаточно прав');
});

test('пользователь с ролью user не может сменить статус заявки', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.post('/api/tickets/1/status', {
    data: { status: 'в работе' },
  });

  expect(response.status()).toBe(403);

  const body = await response.json();
  expect(body.error).toContain('Недостаточно прав');
});

/* ------------------------------------------------------------------ */
/* Пользовательские данные в запросах                                 */
/* ------------------------------------------------------------------ */

test('кавычка в поиске не ломает запрос', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get(`/api/tickets?search=${encodeURIComponent("'")}`);

  expect(response.status()).toBe(200);

  const body = await response.json();

  expect(body.total).toBe(0);
  expect(body.items).toEqual([]);
});

test('конструкция в поиске не расширяет выборку', async ({ page }) => {
  await page.goto('/');

  const all = await (await page.request.get('/api/tickets')).json();

  const response = await page.request.get(
    `/api/tickets?search=${encodeURIComponent("' OR 1=1 OR '")}`,
  );

  expect(response.status()).toBe(200);

  const body = await response.json();

  expect(body.total).toBe(0);
  expect(body.totalAll).toBe(all.total);
});

test('слепое условие по таблице пользователей не влияет на выборку', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get(
    `/api/tickets?search=${encodeURIComponent("zzz%' OR (SELECT COUNT(*) FROM users)=2 OR 'x'='")}`,
  );

  expect(response.status()).toBe(200);

  const body = await response.json();

  expect(body.total).toBe(0);
});

/* ------------------------------------------------------------------ */
/* Вывод пользовательских данных                                      */
/* ------------------------------------------------------------------ */

test('описание заявки выводится как текст', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const payload = '<img src=x onerror="window.__xss=1">';

  const created = await page.request.post('/api/tickets', {
    data: {
      title: `Проверка вывода описания ${Date.now()}`,
      description: `Обычный текст ${payload} конец`,
      priority: 'обычный',
    },
  });

  expect(created.status()).toBe(201);

  const { ticket } = await created.json();

  await page.goto('/');

  // Карточка ищется по номеру заявки: тесты идут параллельно, и по
  // общему тексту можно попасть в чужую карточку.
  const card = page.locator('.ticket', { hasText: `№${String(ticket.id).padStart(3, '0')}` });

  await expect(card).toBeVisible({ timeout: 20_000 });

  const rendered = await card.evaluate((node) => ({
    flag: window.__xss,
    images: node.querySelectorAll('.ticket__description img').length,
    text: node.querySelector('.ticket__description').textContent,
  }));

  expect(rendered.flag).toBeUndefined();
  expect(rendered.images).toBe(0);
  expect(rendered.text).toContain('Обычный текст');
});

test('тема заявки выводится как текст', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const created = await page.request.post('/api/tickets', {
    data: {
      title: '<img src=x onerror="window.__xssTitle=1">',
      description: 'Обычное описание',
      priority: 'обычный',
    },
  });

  expect(created.status()).toBe(201);

  const { ticket } = await created.json();

  await page.goto('/');

  const card = page.locator('.ticket', { hasText: `№${String(ticket.id).padStart(3, '0')}` });

  await expect(card).toBeVisible({ timeout: 20_000 });

  const rendered = await card.evaluate((node) => ({
    flag: window.__xssTitle,
    images: node.querySelectorAll('.ticket__title img').length,
    text: node.querySelector('.ticket__title').textContent,
  }));

  expect(rendered.flag).toBeUndefined();
  expect(rendered.images).toBe(0);
  expect(rendered.text).toContain('onerror');
});

/* ------------------------------------------------------------------ */
/* Данные сессии                                                       */
/* ------------------------------------------------------------------ */

test('в ответе профиля нет хеша пароля', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.get('/api/users/me');
  const text = await response.text();

  expect(response.status()).toBe(200);
  expect(text).not.toContain('passwordHash');
  expect(text).not.toContain('password_hash');
});
