import { randomUUID } from 'node:crypto';
import multer from 'multer';

import { uploadsDir } from '../storage.js';
import { badRequest } from '../utils/errors.js';

// Расширение берём из MIME-типа, а не из имени файла:
// так в папку не попадёт «avatar.php» или путь с ../.
const EXT_BY_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename(req, file, callback) {
    callback(null, `${randomUUID()}${EXT_BY_MIME.get(file.mimetype)}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (!EXT_BY_MIME.has(file.mimetype)) {
      callback(badRequest('Разрешены только изображения PNG, JPEG или WebP'));
      return;
    }

    callback(null, true);
  },
});

/** Middleware для одного файла в поле avatar. */
export const uploadAvatar = uploader.single('avatar');
