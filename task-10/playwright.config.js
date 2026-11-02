import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация Playwright для автотестов web-приложения.
 *
 * Сервер поднимается автоматически на отдельной базе — тесты не зависят
 * от запущенного вручную экземпляра и не портят основные данные.
 *
 * Проекты:
 *   chromium / firefox / webkit — проверка в разных браузерах;
 *   mobile-chrome / mobile-safari — проверка на мобильных устройствах.
 */

const PORT = Number(process.env.E2E_PORT) || 3210;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,

  // Пять браузеров одновременно нагружают машину, и Firefox не всегда
  // успевает отрисовать страницу за штатные пять секунд. Запас по времени
  // и меньшее число параллельных прогонов убирают «мигающие» падения.
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // Трейс записывается только здесь: в Firefox и WebKit сохранение
      // трейса при закрытии контекста даёт ошибку ENOENT, и тест
      // засчитывается как упавший из-за неё, а не из-за приложения.
      use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], trace: 'off' },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], trace: 'off' },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], trace: 'off' },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'], trace: 'off' },
    },
  ],

  webServer: {
    command: 'node server/scripts/e2e-server.js',
    url: `http://127.0.0.1:${PORT}/api/health`,
    // Сервер поднимается заново: скрипт создаёт чистую базу, поэтому
    // каждый прогон начинается с одинакового состояния.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DB_FILE: 'data/e2e.db',
      SESSION_SECRET: 'e2e-secret-key-for-automated-tests',
    },
  },
});
