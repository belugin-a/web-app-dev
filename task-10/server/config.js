import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(serverDir, '..');

/**
 * Ключ подписи сессионных cookie.
 *
 * Если ключ не задан переменной окружения, он генерируется один раз и
 * сохраняется рядом с базой. Благодаря этому сессии не слетают при
 * перезапуске сервера: пользователю не приходится входить заново.
 */
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  const secretFile = path.join(rootDir, 'data', '.session-secret');

  try {
    const saved = fs.readFileSync(secretFile, 'utf8').trim();

    if (saved) {
      return saved;
    }
  } catch {
    // Файла ещё нет — создадим ниже.
  }

  const secret = randomBytes(32).toString('hex');

  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });

  return secret;
}

export const config = {
  appName: 'task-10-support-tickets',
  port: Number(process.env.PORT) || 3000,
  publicDir: path.join(rootDir, 'public'),

  sessionSecret: resolveSessionSecret(),

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
