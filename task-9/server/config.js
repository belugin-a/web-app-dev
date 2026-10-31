import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(serverDir, '..');

export const config = {
  appName: 'task-9-support-tickets',
  port: Number(process.env.PORT) || 3000,
  // Файл базы данных. Лежит рядом с проектом, создаётся при первом запуске.
  dbFile: process.env.DB_FILE || path.join(rootDir, 'data', 'app.db'),
  publicDir: path.join(rootDir, 'public'),
};
