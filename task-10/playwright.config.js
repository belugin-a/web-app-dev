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
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
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
