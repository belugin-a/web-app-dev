import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { dbState } from './db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';

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

// Проверка живости сервера и состояния подключения к MongoDB.
app.get('/api/health', (req, res) => {
  const db = dbState();

  res.status(db === 'connected' ? 200 : 503).json({
    status: db === 'connected' ? 'ok' : 'degraded',
    app: config.appName,
    db,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

// Звено 2: API.
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Неизвестный API-маршрут: отвечаем JSON, а не HTML-страницей Express.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Неизвестный путь вне API.
app.use((req, res) => {
  res.status(404).type('text').send('404 — страница не найдена');
});

/** Переводит ошибки Express и Mongoose в пару «статус + текст». */
function describeError(err) {
  if (err.type === 'entity.parse.failed') {
    return [400, 'Некорректный JSON в теле запроса'];
  }

  // Нарушение уникального индекса.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0];
    return [
      409,
      field === 'email'
        ? 'Пользователь с таким e-mail уже существует'
        : 'Запись с такими данными уже существует',
    ];
  }

  // Ошибки валидации схемы Mongoose.
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0];
    return [400, first?.message ?? 'Некорректные данные'];
  }

  if (err.name === 'CastError') {
    return [400, 'Некорректный идентификатор'];
  }

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
