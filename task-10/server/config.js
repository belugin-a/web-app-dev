import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(serverDir, '..');

export const config = {
  appName: 'task-10-support-tickets',
  port: Number(process.env.PORT) || 3000,
  publicDir: path.join(rootDir, 'public'),

  // Ключ для подписи сессионных cookie. Если переменная окружения не задана,
  // ключ генерируется заново при каждом запуске: после перезапуска сервера
  // ранее выданные cookie перестают действовать.
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),

  isProduction: process.env.NODE_ENV === 'production',

  // Имя cookie с идентификатором сессии.
  authCookie: 'sid',

  // Время жизни сессии в миллисекундах.
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,

  // Файл базы данных. Значение читается в момент обращения, а не один раз
  // при загрузке модуля: так тесты и проверочные скрипты успевают подменить
  // путь к своей базе через переменную окружения DB_FILE.
  get dbFile() {
    return process.env.DB_FILE || path.join(rootDir, 'data', 'app.db');
  },
};
