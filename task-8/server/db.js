import mongoose from 'mongoose';

import { config } from './config.js';

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Подключается к MongoDB. Ошибку не глотаем: без базы приложение
 * не имеет смысла, поэтому вызывающий код должен её обработать.
 */
export async function connectDb(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    // Не ждём минуту, если MongoDB не запущена: падаем быстро и понятно.
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/** Состояние соединения человеческим языком — для /api/health. */
export function dbState() {
  return STATES[mongoose.connection.readyState] ?? 'unknown';
}
