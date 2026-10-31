import express from 'express';

import { config } from './config.js';
import { apiRouter } from './routes/api.js';

/**
 * Сборка Express-приложения.
 *
 * Здесь только инфраструктура: статика, разбор тела запроса, подключение
 * маршрутов и обработчик ошибок. Никакой логики заявок — она в слоях
 * services и repositories.
 */

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

// Клиентская часть (одностраничная страница).
app.use(express.static(config.publicDir));

// Слой маршрутизации.
app.use('/api', apiRouter);

// Неизвестный API-маршрут: отвечаем JSON, а не HTML-страницей Express.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Неизвестный путь вне API.
app.use((req, res) => {
  res.status(404).type('text').send('404 — страница не найдена');
});

/** Переводит ошибки в пару «статус + текст». */
function describeError(err) {
  if (err.type === 'entity.parse.failed') {
    return [400, 'Некорректный JSON в теле запроса'];
  }

  // Ошибки слоя бизнес-логики уже несут готовый HTTP-статус.
  if (err.status) {
    return [err.status, err.message];
  }

  return [500, 'Внутренняя ошибка сервера'];
}

// Централизованный обработчик ошибок. В Express 5 сюда попадают
// и ошибки синхронных обработчиков, и отклонённые промисы из async-функций.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const [status, message] = describeError(err);

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
});
