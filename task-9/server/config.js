import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(serverDir, '..');

export const config = {
  appName: 'task-9-support-tickets',
  port: Number(process.env.PORT) || 3000,
  publicDir: path.join(rootDir, 'public'),

  // Файл базы данных. Значение читается в момент обращения, а не один раз
  // при загрузке модуля: так тесты и проверочные скрипты успевают подменить
  // путь к своей базе через переменную окружения DB_FILE.
  get dbFile() {
    return process.env.DB_FILE || path.join(rootDir, 'data', 'app.db');
  },
};
