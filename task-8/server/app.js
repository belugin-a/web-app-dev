import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');

export const app = express();

// Не раскрываем, что сервер работает на Express.
app.disable('x-powered-by');

// Минимальный набор защитных заголовков без лишних зависимостей.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '100kb' }));

// Звено 1: статика клиентской части.
app.use(express.static(publicDir));

// Проверка живости сервера. На шаге 2 сюда добавится состояние MongoDB.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: config.appName,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

// Неизвестный API-маршрут: отвечаем JSON, а не HTML-страницей Express.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Неизвестный путь вне API.
app.use((req, res) => {
  res.status(404).type('text').send('404 — страница не найдена');
});

// Централизованный обработчик ошибок. В Express 5 сюда попадают
// и ошибки синхронных обработчиков, и отклонённые промисы из async-функций.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isBadJson = err.type === 'entity.parse.failed';

  const status = isBadJson ? 400 : err.status || err.statusCode || 500;
  const message = isBadJson
    ? 'Некорректный JSON в теле запроса'
    : status === 500
      ? 'Внутренняя ошибка сервера'
      : err.message || 'Ошибка запроса';

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
});
