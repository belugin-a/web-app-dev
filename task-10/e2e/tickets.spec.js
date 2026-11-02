import { expect, test } from '@playwright/test';

import { boardState, expectTicket, lastToast, login, waitForBoard } from './helpers.js';

/**
 * V-01 … V-11 — просмотр заявок, фильтры, поиск, сортировка.
 *
 * Проверки построены на сравнении «до и после», а не на фиксированных
 * числах: тесты выполняются параллельно и меняют состав заявок.
 */

test('V-01: гость видит список заявок и заполненную сводку', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.ticket').first()).toBeVisible();

  await expect(page.locator('#kpi-total')).not.toHaveText('—');
  await expect(page.locator('#kpi-open')).not.toHaveText('—');
  await expect(page.locator('#kpi-overdue')).not.toHaveText('—');
  await expect(page.locator('#kpi-average')).not.toHaveText('—');

  await expect(page.locator('#server-state')).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#pipeline')).toHaveClass(/is-collapsed/);

  // Счётчик списка совпадает с числом показанных карточек.
  const state = await boardState(page);
  expect(state.shown).toBeGreaterThan(0);
});

test('V-01: гостю недоступна кнопка создания заявки', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#open-create')).toBeHidden();
  await expect(page.locator('#account-guest')).toBeVisible();
});

test('V-02: фильтр по статусу оставляет только заявки этого статуса', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  const before = await boardState(page);

  await page.locator('#filter-status').selectOption('в работе');
  await waitForBoard(page);

  const after = await boardState(page);

  expect(after.shown).toBeGreaterThan(0);
  expect(after.shown).toBeLessThanOrEqual(before.shown);
  expect(after.statuses.every((status) => status === 'в работе')).toBe(true);
});

test('V-02: фильтр по приоритету оставляет только заявки этого приоритета', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-priority').selectOption('высокий');
  await waitForBoard(page);

  const state = await boardState(page);

  expect(state.shown).toBeGreaterThan(0);
  expect(state.priorities.every((priority) => priority === 'высокий')).toBe(true);
});

test('V-02: фильтр по исполнителю оставляет только заявки этого сотрудника', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-assignee').selectOption('Пётр Крылов');
  await waitForBoard(page);

  const state = await boardState(page);

  expect(state.shown).toBeGreaterThan(0);
  expect(state.assignees.every((name) => name === 'Пётр Крылов')).toBe(true);
});

test('V-02: вариант «Без исполнителя» оставляет только неназначенные заявки', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-assignee').selectOption('none');
  await waitForBoard(page);

  const state = await boardState(page);

  expect(state.shown).toBeGreaterThan(0);
  expect(state.assignees.every((name) => name === 'не назначен')).toBe(true);
});

test('V-06: поиск находит заявки и не зависит от регистра', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-search').fill('принтер');
  await waitForBoard(page);

  const lower = await boardState(page);

  expect(lower.shown).toBeGreaterThan(0);

  // Поиск идёт по теме и описанию, поэтому совпадение допускается в любом из них.
  const matches = lower.titles.every(
    (title, index) =>
      title.toLowerCase().includes('принтер') ||
      lower.descriptions[index].toLowerCase().includes('принтер'),
  );

  expect(matches).toBe(true);

  await page.locator('#filter-search').fill('ПРИНТЕР');
  await waitForBoard(page);

  const upper = await boardState(page);

  expect(upper.shown).toBe(lower.shown);
});

test('V-06: поиск без совпадений показывает пустое состояние', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-search').fill('такого-запроса-точно-нет');
  await waitForBoard(page);

  await expect(page.locator('.empty')).toBeVisible();
  await expect(page.locator('.empty')).toContainText('Заявок по текущим условиям нет');
});

test('V-10: сортировка меняет порядок карточек', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-sort').selectOption('title:asc');
  await waitForBoard(page);

  const ascending = (await boardState(page)).titles;

  await page.locator('#filter-sort').selectOption('title:desc');
  await waitForBoard(page);

  const descending = (await boardState(page)).titles;

  expect(ascending.length).toBeGreaterThan(1);
  expect(descending).toEqual([...ascending].reverse());
});

test('V-10: сортировка по дате создания переключает направление', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  await page.locator('#filter-sort').selectOption('createdAt:asc');
  await waitForBoard(page);

  const ascending = (await boardState(page)).titles;

  await page.locator('#filter-sort').selectOption('createdAt:desc');
  await waitForBoard(page);

  const descending = (await boardState(page)).titles;

  expect(ascending.length).toBeGreaterThan(1);
  expect(descending).toEqual([...ascending].reverse());
});

test('V-11: сброс фильтров возвращает полный список', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  const full = await boardState(page);

  await page.locator('#filter-search').fill('принтер');
  await page.locator('#filter-status').selectOption('в работе');
  await waitForBoard(page);

  const filtered = await boardState(page);
  expect(filtered.shown).toBeLessThanOrEqual(full.shown);

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await waitForBoard(page);

  const reset = await boardState(page);

  expect(reset.shown).toBe(full.shown);
  await expect(page.locator('#filter-search')).toHaveValue('');
  await expect(page.locator('#filter-status')).toHaveValue('');
});

test('сводка согласована с фильтром просроченных', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);

  const overdue = await page.locator('#kpi-overdue').textContent();

  await page.locator('#kpi-overdue-card').click();
  await waitForBoard(page);

  await expect(page.locator('#filter-overdue-chip')).toBeVisible();

  const state = await boardState(page);

  expect(state.shown).toBe(Number(overdue));
});
