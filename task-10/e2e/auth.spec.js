import { expect, test } from '@playwright/test';

import {
  lastToast,
  login,
  register,
  uniqueEmail,
} from './helpers.js';

/**
 * A-01 … A-11 — аутентификация, регистрация, выход.
 */

test('A-01: регистрация создаёт учётную запись с ролью пользователя', async ({ page }) => {
  const email = uniqueEmail('novy');

  await register(page, 'Тестовый Сотрудник', email, 'password123');

  await expect(page.locator('#account-name')).toHaveText('Тестовый Сотрудник');
  await expect(page.locator('#account-role')).toHaveText('пользователь');
  await expect(page.locator('#open-create')).toBeVisible();
});

test('A-02: регистрация с некорректными данными отклоняется', async ({ page }) => {
  const cases = [
    {
      title: 'занятый e-mail',
      name: 'Дубль',
      email: 'user@example.com',
      password: 'password123',
      error: 'уже существует',
    },
    {
      title: 'короткий пароль',
      name: 'Короткий',
      email: uniqueEmail('short'),
      password: 'short',
      error: 'минимум 8 символов',
    },
    {
      title: 'некорректный e-mail',
      name: 'Плохой',
      email: 'не-почта',
      password: 'password123',
      error: 'Некорректный e-mail',
    },
    {
      title: 'пустое имя',
      name: '',
      email: uniqueEmail('noname'),
      password: 'password123',
      error: 'Имя обязательно',
    },
  ];

  for (const item of cases) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Регистрация' }).click();

    await page.locator('#register-name').fill(item.name);
    await page.locator('#register-email').fill(item.email);
    await page.locator('#register-password').fill(item.password);
    await page.locator('#register-submit').click();

    await expect(page.locator('#register-error')).toBeVisible();
    await expect(page.locator('#register-error')).toContainText(item.error);

    // Вход не должен выполняться, диалог остаётся открытым.
    await expect(page.locator('#register-dialog')).toBeVisible();
    await expect(page.locator('#account-guest')).toBeVisible();
  }
});

test('A-06: вход выполняется и открывает доступ к созданию заявок', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await expect(page.locator('#account-name')).toHaveText('Пользователь');
  await expect(page.locator('#account-role')).toHaveText('пользователь');
  await expect(page.locator('#open-create')).toBeVisible();
});

test('A-07: неверный пароль и несуществующий e-mail дают одинаковый отказ', async ({ page }) => {
  await page.goto('/');

  // Отдельная учётная запись для каждого прогона: счётчик неудачных
  // попыток не должен накапливаться между запусками тестов.
  const existing = uniqueEmail('existing');

  await page.request.post('/api/auth/register', {
    data: { name: 'Существующий', email: existing, password: 'password123' },
  });

  const messages = [];

  for (const [email, password] of [
    [existing, 'неверный-пароль'],
    [uniqueEmail('unknown'), 'неверный-пароль'],
  ]) {
    const response = await page.request.post('/api/auth/login', {
      data: { email, password },
    });

    expect(response.status()).toBe(401);

    messages.push(await response.text());
  }

  expect(messages[0]).toContain('Неверный e-mail или пароль');
  expect(messages[1]).toBe(messages[0]);
});

test('A-11: выход из аккаунта возвращает гостя', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#logout').click();

  await expect(page.locator('#account-guest')).toBeVisible();
  await expect(page.locator('#account-user')).toBeHidden();
  await expect(page.locator('#open-create')).toBeHidden();
  await expect(lastToast(page)).toContainText('Вы вышли из аккаунта');
});
