import { expect } from '@playwright/test';

/**
 * Общие действия для автотестов: вход, регистрация, ожидания.
 * Вынесены отдельно, чтобы сценарии читались как пользовательские сценарии.
 */

/** Входит в аккаунт через диалог входа. */
export async function login(page, email, password) {
  await page.goto('/');

  await page.getByRole('button', { name: 'Войти', exact: true }).first().click();

  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);

  await page.locator('#login-submit').click();

  await expect(page.locator('#account-user')).toBeVisible();
}

/** Регистрирует нового пользователя через диалог регистрации. */
export async function register(page, name, email, password) {
  await page.goto('/');

  await page.getByRole('button', { name: 'Регистрация' }).click();

  await page.locator('#register-name').fill(name);
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(password);

  await page.locator('#register-submit').click();

  await expect(page.locator('#account-user')).toBeVisible();
}

/** Уникальный адрес, чтобы параллельные прогоны не сталкивались. */
export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

/** Последнее уведомление: одновременно на экране их может быть несколько. */
export function lastToast(page) {
  return page.locator('.toast').last();
}

/** Ожидает, что появится карточка с указанной темой. */
export async function expectTicket(page, title) {
  await expect(page.locator('.ticket__title', { hasText: title })).toBeVisible();
}

/** Ожидает, что карточка с указанной темой исчезнет. */
export async function expectNoTicket(page, title) {
  await expect(page.locator('.ticket__title', { hasText: title })).toHaveCount(0);
}

/**
 * Состояние текущего списка заявок: сколько показано и какие у них
 * статусы, приоритеты и исполнители. Используется вместо проверки
 * точного числа заявок: тесты выполняются параллельно и меняют данные.
 */
export async function boardState(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ticket'));

    return {
      shown: cards.length,
      countText: document.getElementById('board-count').textContent,
      statuses: cards.map((card) => card.dataset.status),
      priorities: cards.map((card) => card.dataset.priority),
      assignees: cards.map((card) => card.querySelector('.ticket__meta b').textContent),
      titles: cards.map((card) => card.querySelector('.ticket__title').textContent),
      descriptions: cards.map((card) => {
        const node = card.querySelector('.ticket__description');
        return node ? node.textContent : '';
      }),
    };
  });
}

/**
 * Ждёт, пока список заявок перерисуется после запроса к серверу.
 *
 * Поиск срабатывает с задержкой в 280 мс, поэтому сначала выжидаем её,
 * а потом ждём окончания отрисовки: пока идёт запрос, в списке стоит
 * заглушка «Загружаю заявки…».
 */
export async function waitForBoard(page) {
  await page.waitForTimeout(400);

  await page
    .waitForSelector('.board__body .loading', { state: 'detached', timeout: 10_000 })
    .catch(() => {});
}
