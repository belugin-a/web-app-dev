import { expect, test } from '@playwright/test';

import { expectTicket, lastToast, login } from './helpers.js';

/**
 * C-01 … C-07 — создание заявки.
 */

test('C-01: авторизованный пользователь создаёт заявку', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const title = `Заявка из автотеста ${Date.now()}`;

  await page.locator('#open-create').click();

  await page.locator('#create-title').fill(title);
  await page.locator('#create-description').fill('Описание из автоматического теста.');
  await page.locator('#create-priority').selectOption('высокий');

  await page.locator('#create-submit').click();

  await expect(lastToast(page)).toContainText('создана');
  await expectTicket(page, title);

  const card = page.locator('.ticket', { hasText: title }).first();

  await expect(card).toHaveAttribute('data-status', 'новая');
  await expect(card.locator('.pill--sla')).toContainText('8 ч');
});

test('C-02: короткая тема отклоняется с сообщением у поля', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#open-create').click();
  await page.locator('#create-title').fill('Ок');
  await page.locator('#create-submit').click();

  await expect(page.locator('#create-error')).toBeVisible();
  await expect(page.locator('#create-error')).toContainText('Тема: от 5 до 120 символов');

  // Введённые данные не сброшены, заявка не создана.
  await expect(page.locator('#create-title')).toHaveValue('Ок');
  await expect(page.locator('#create-dialog')).toBeVisible();

  // Темы сравниваются целиком: подстрока «Ок» встречается, например, в слове «срок».
  const titles = await page.locator('.ticket__title').allTextContents();

  expect(titles.map((title) => title.trim())).not.toContain('Ок');
});

test('C-02: пустая тема отклоняется', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#open-create').click();
  await page.locator('#create-title').fill('');
  await page.locator('#create-submit').click();

  await expect(page.locator('#create-error')).toBeVisible();
  await expect(page.locator('#create-error')).toContainText('Тема');
});

test('C-02: слишком длинное описание отклоняется сервером', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.post('/api/tickets', {
    data: {
      title: 'Заявка с очень длинным описанием',
      description: 'я'.repeat(2100),
      priority: 'обычный',
    },
  });

  expect(response.status()).toBe(400);
});

test('C-03: подсказка срока обработки меняется вместе с приоритетом', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#open-create').click();

  const expected = {
    критичный: '4 ч',
    высокий: '8 ч',
    обычный: '24 ч',
    низкий: '72 ч',
  };

  for (const [priority, hours] of Object.entries(expected)) {
    await page.locator('#create-priority').selectOption(priority);
    await expect(page.locator('#create-priority-hint')).toContainText(hours);
  }
});

test('C-07: гость не может создать заявку', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#open-create')).toBeHidden();

  const response = await page.request.post('/api/tickets', {
    data: { title: 'Заявка от гостя', priority: 'обычный' },
  });

  expect(response.status()).toBe(401);
});
