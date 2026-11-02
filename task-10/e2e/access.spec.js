import { expect, test } from '@playwright/test';

import { expectNoTicket, expectTicket, lastToast, login, waitForBoard } from './helpers.js';

/**
 * E-01 … E-08 — редактирование, смена статуса, удаление, ограничения по роли.
 *
 * Авторизованные обращения к API выполняются через page.request: он
 * использует cookie текущей сессии, в отличие от отдельного request.
 */

/** Создаёт заявку от имени администратора и возвращает её тему. */
async function createTicket(page, priority = 'обычный') {
  const title = `Заявка для проверки ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await page.locator('#open-create').click();
  await page.locator('#create-title').fill(title);
  await page.locator('#create-priority').selectOption(priority);
  await page.locator('#create-submit').click();

  await expectTicket(page, title);

  return title;
}

test('E-01: администратор редактирует заявку', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  const title = await createTicket(page);

  const card = page.locator('.ticket', { hasText: title }).first();

  await card.getByRole('button', { name: 'Редактировать' }).click();

  await page.locator('#edit-title-input').fill(`${title} (уточнено)`);
  await page.locator('#edit-assignee').selectOption('Пётр Крылов');
  await page.locator('#edit-submit').click();

  await expect(lastToast(page)).toContainText('сохранена');

  await expectTicket(page, `${title} (уточнено)`);
  await expect(
    page.locator('.ticket', { hasText: title }).first().locator('.ticket__meta b'),
  ).toHaveText('Пётр Крылов');
});

test('E-02: администратор меняет статус по разрешённому переходу', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  const title = await createTicket(page);

  const card = page.locator('.ticket', { hasText: title }).first();

  await expect(card).toHaveAttribute('data-status', 'новая');

  await card.getByRole('button', { name: 'в работе' }).click();

  await expect(lastToast(page)).toContainText('в работе');
  await expect(card).toHaveAttribute('data-status', 'в работе');

  // Набор кнопок перехода пересчитан под новый статус.
  await expect(card.getByRole('button', { name: 'ожидает' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Редактировать' })).toBeVisible();
});

test('E-03: запрещённый переход статуса отклоняется сервером', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  const response = await page.request.get(
    `/api/tickets?status=${encodeURIComponent('решена')}`,
  );

  const list = await response.json();
  const solved = list.items[0];

  expect(solved.status).toBe('решена');

  const transition = await page.request.post(`/api/tickets/${solved.id}/status`, {
    data: { status: 'ожидает' },
  });

  expect(transition.status()).toBe(409);

  const body = await transition.json();
  expect(body.error).toContain('нельзя перейти');
  expect(body.error).toContain('Допустимо');
});

test('E-06: удаление заявки — отмена сохраняет, подтверждение удаляет', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  const title = await createTicket(page);
  const card = page.locator('.ticket', { hasText: title }).first();

  // Отмена: заявка остаётся на месте.
  await card.getByRole('button', { name: 'Удалить' }).click();

  await expect(page.locator('#delete-dialog')).toBeVisible();
  await expect(page.locator('#delete-text')).toContainText(title);

  await page.locator('#delete-cancel').click();

  await expect(page.locator('#delete-dialog')).toBeHidden();
  await expectTicket(page, title);

  // Подтверждение: заявка удаляется.
  await card.getByRole('button', { name: 'Удалить' }).click();
  await page.locator('#delete-confirm').click();

  await expect(lastToast(page)).toContainText('удалена');
  await expectNoTicket(page, title);
});

test('E-06: удаление заявки в работе отклоняется', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  const title = await createTicket(page);
  const card = page.locator('.ticket', { hasText: title }).first();

  await card.getByRole('button', { name: 'в работе' }).click();
  await expect(card).toHaveAttribute('data-status', 'в работе');

  const response = await page.request.delete(`/api/tickets/${await idOf(page, title)}`);

  expect(response.status()).toBe(409);

  const body = await response.json();
  expect(body.error).toContain('Удалить можно только');
});

/** Возвращает идентификатор заявки по её теме. */
async function idOf(page, title) {
  const response = await page.request.get('/api/tickets');
  const list = await response.json();

  return list.items.find((ticket) => ticket.title === title).id;
}

test('E-08: пользователю с ролью user недоступно редактирование заявки', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.patch('/api/tickets/1', {
    data: { title: 'Правка обычным пользователем' },
  });

  expect(response.status()).toBe(403);

  const body = await response.json();
  expect(body.error).toContain('Недостаточно прав');
});

test('E-08: в интерфейсе у пользователя нет кнопок управления заявкой', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await expect(page.locator('#account-role')).toHaveText('пользователь');
  await expect(page.getByRole('button', { name: 'Редактировать' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Удалить' })).toHaveCount(0);
});

test('E-08: администратору кнопки управления доступны', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  await expect(page.locator('#account-role')).toHaveText('администратор');
  await expect(page.getByRole('button', { name: 'Редактировать' }).first()).toBeVisible();
});

test('гость не может изменить или удалить заявку', async ({ page }) => {
  await page.goto('/');

  const patch = await page.request.patch('/api/tickets/1', {
    data: { title: 'Правка гостем' },
  });

  const remove = await page.request.delete('/api/tickets/1');

  expect(patch.status()).toBe(401);
  expect(remove.status()).toBe(401);
});
