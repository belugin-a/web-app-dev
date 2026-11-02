import { expect, test } from '@playwright/test';

import { lastToast, login, register, uniqueEmail } from './helpers.js';

/**
 * P-01, P-02, P-05 — профиль пользователя.
 */

test('P-01: профиль показывает имя, e-mail и роль', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin12345');

  await page.locator('#open-profile').click();

  await expect(page.locator('#profile-dialog')).toBeVisible();
  await expect(page.locator('#profile-subtitle')).toContainText('администратор');
  await expect(page.locator('#profile-name')).toHaveValue('Администратор');
  await expect(page.locator('#profile-email')).toHaveValue('admin@example.com');
});

test('P-02: профиль сохраняет новое имя', async ({ page }) => {
  // Тест работает на отдельной учётной записи: изменение e-mail демо-пользователя
  // ломало бы вход в других тестах.
  const email = uniqueEmail('profile');
  const name = `Иванова ${Date.now()}`;

  await register(page, 'Иванова Мария', email, 'password123');

  await page.locator('#open-profile').click();
  await page.locator('#profile-name').fill(name);
  await page.locator('#profile-submit').click();

  await expect(lastToast(page)).toContainText('Профиль сохранён');
  await expect(page.locator('#account-name')).toHaveText(name);
});

test('P-02: профиль сохраняет новый e-mail', async ({ page }) => {
  const email = uniqueEmail('profile');
  const newEmail = uniqueEmail('renamed');

  await register(page, 'Пользователь Профиля', email, 'password123');

  await page.locator('#open-profile').click();
  await page.locator('#profile-email').fill(newEmail);
  await page.locator('#profile-submit').click();

  await expect(lastToast(page)).toContainText('Профиль сохранён');

  const response = await page.request.get('/api/users/me');
  const { user } = await response.json();

  expect(user.email).toBe(newEmail);
});

test('P-02: пустое имя отклоняется', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#open-profile').click();
  await page.locator('#profile-name').fill('');
  await page.locator('#profile-submit').click();

  await expect(page.locator('#profile-error')).toBeVisible();
  await expect(page.locator('#profile-error')).toContainText('Имя');
});

test('P-02: некорректный e-mail отклоняется', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  await page.locator('#open-profile').click();
  await page.locator('#profile-email').fill('не-почта');
  await page.locator('#profile-submit').click();

  await expect(page.locator('#profile-error')).toBeVisible();
  await expect(page.locator('#profile-error')).toContainText('Некорректный e-mail');
});

test('P-05: профиль не раскрывает лишних данных', async ({ page }) => {
  await login(page, 'user@example.com', 'user12345');

  const response = await page.request.get('/api/users/me');

  expect(response.status()).toBe(200);

  const { user } = await response.json();

  expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role']);
  expect(user.passwordHash).toBeUndefined();
  expect(user.password).toBeUndefined();
});

test('профиль недоступен гостю', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get('/api/users/me');

  expect(response.status()).toBe(401);
});
