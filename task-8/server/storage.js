import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink } from 'node:fs/promises';

/** Папка с загруженными файлами: task-8/uploads. */
export const uploadsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'uploads',
);

/**
 * Удаляет файл аватара. Отсутствие файла — не ошибка:
 * запись в базе могла уже потерять связь с диском.
 */
export async function removeAvatar(filename) {
  if (!filename) return;

  try {
    await unlink(path.join(uploadsDir, path.basename(filename)));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
