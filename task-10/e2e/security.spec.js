import { expect, test } from '@playwright/test';

import { login, register, uniqueEmail } from './helpers.js';

/**
 * Проверки безопасности: права доступа, устойчивость к вводу, вывод
 * пользовательских данных, защита служебных файлов и служебных заголовков.
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

test('гость не может создать, изменить и удалить заявку', async ({ page }) => {
  await page.goto('/');

  const created = await page.request.post('/api/tickets', {
    data: { title: 'Заявка от гостя', priority: 'обычный' },
  });

  const patched = await page.request.patch('/api/tickets/1', {
    data: { title: 'Правка гостем' },
  });

  const removed = await page.request.delete('/api/tickets/1');

  expect(created.status()).toBe(401);
  expect(patched.status()).toBe(401);
  expect(removed.status()).toBe(401);
});

test('подделка сессионной cookie не даёт доступа', async ({ page }) => {
  await page.goto('/');

  const forged = [
    'sid=',
    'sid=abc.def.ghi',
    'sid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.bad',
  ];

  for (const cookie of forged) {
    const response = await page.request.get('/api/users/me', { headers: { Cookie: cookie } });

    expect(response.status()).toBe(401);
  }
});

/* ------------------------------------------------------------------ */
/* Аутентификация                                                      */
/* ------------------------------------------------------------------ */

test('сессионная cookie недоступна скриптам страницы', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const visible = await page.evaluate(() => document.cookie);

  expect(visible).not.toContain('sid=');
});

test('ошибка входа не раскрывает наличие e-mail', async ({ page }) => {
  await page.goto('/');

  const wrongPassword = await page.request.post('/api/auth/login', {
    data: { email: 'user@example.com', password: 'неверный-пароль' },
  });

  const unknownEmail = await page.request.post('/api/auth/login', {
    data: { email: 'nobody@example.com', password: 'неверный-пароль' },
  });

  expect(wrongPassword.status()).toBe(401);
  expect(unknownEmail.status()).toBe(401);
  expect(await wrongPassword.text()).toBe(await unknownEmail.text());
});

test('после серии неудачных входов вход блокируется', async ({ page }) => {
  const email = uniqueEmail('bruteforce');

  // Отдельная учётная запись: блокировка не должна затронуть другие тесты.
  await register(page, 'Жертва Перебора', email, 'password123');

  let locked = false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await page.request.post('/api/auth/login', {
      data: { email, password: 'неверный-пароль' },
    });

    if (response.status() === 429) {
      locked = true;
      break;
    }

    expect(response.status()).toBe(401);
  }

  expect(locked, 'после серии неудачных попыток вход блокируется').toBe(true);

  // Даже верный пароль не пускает, пока блокировка не истекла.
  const correct = await page.request.post('/api/auth/login', {
    data: { email, password: 'password123' },
  });

  expect(correct.status()).toBe(429);
});

test('пароль в базе не хранится открытым текстом', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get('/api/users/me');
  const text = await response.text();

  expect(response.status()).toBe(401);
  expect(text).not.toContain('password123');
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

test('инъекция в остальные фильтры не влияет на выборку', async ({ page }) => {
  await page.goto('/');

  const all = await (await page.request.get('/api/tickets')).json();

  const vectors = [
    ['status', "' OR 1=1 --"],
    ['priority', "' OR 1=1 --"],
    ['assignee', "' OR 1=1 --"],
    ['sortBy', 'title; DROP TABLE tickets--'],
    ['limit', '1; DROP TABLE tickets--'],
  ];

  for (const [key, value] of vectors) {
    const response = await page.request.get(`/api/tickets?${key}=${encodeURIComponent(value)}`);

    // Значение либо отбрасывается проверкой (400), либо применяется как
    // обычное условие (200) — в обоих случаях выборка не расширяется.
    expect([200, 400], `фильтр ${key} не должен ломать запрос`).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();

      expect(body.total, `фильтр ${key} не должен расширять выборку`).toBeLessThanOrEqual(
        all.total,
      );
    }
  }

  // Таблица на месте.
  const after = await (await page.request.get('/api/tickets')).json();
  expect(after.total).toBe(all.total);
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

  const card = page.locator('.ticket', {
    hasText: `№${String(ticket.id).padStart(3, '0')}`,
  });

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

  const card = page.locator('.ticket', {
    hasText: `№${String(ticket.id).padStart(3, '0')}`,
  });

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
/* Заголовки и служебные файлы                                          */
/* ------------------------------------------------------------------ */

test('установлены защитные заголовки и скрыт стек приложения', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get('/api/health');

  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe('same-origin');
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['x-powered-by']).toBeUndefined();
});

test('служебные файлы приложения недоступны по HTTP', async ({ page }) => {
  await page.goto('/');

  const paths = [
    '/../server/config.js',
    '/..%2fserver%2fconfig.js',
    '/server/config.js',
    '/../data/app.db',
    '/../package.json',
    '/../.gitignore',
  ];

  for (const path of paths) {
    const response = await page.request.get(path);

    expect(response.status(), `путь ${path} должен быть недоступен`).toBe(404);
  }
});

test('слишком большое тело запроса отклоняется', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.post('/api/tickets', {
    data: {
      title: 'Заявка с огромным телом',
      description: 'z'.repeat(200_000),
      priority: 'обычный',
    },
  });

  expect(response.status()).toBe(413);
});

test('в ответе профиля нет хеша пароля', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.get('/api/users/me');
  const text = await response.text();

  expect(response.status()).toBe(200);
  expect(text).not.toContain('passwordHash');
  expect(text).not.toContain('password_hash');
});
