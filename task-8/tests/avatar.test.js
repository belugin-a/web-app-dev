import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

import { startTestApp, TestClient, PNG, uniqueEmail, uploadsDir } from './helpers.js';

let app;
let a;
let b;
let guest;
let aId;

before(async () => {
  app = await startTestApp();
  guest = new TestClient(app.base);

  a = new TestClient(app.base);
  const created = await a.register({ name: 'Владелец', email: uniqueEmail('avatar') });
  aId = created.data.user._id;

  b = new TestClient(app.base);
  await b.register({ name: 'Другой', email: uniqueEmail('avatar-b') });
});

after(async () => {
  await app.stop();
});

test('загрузка PNG возвращает имя файла и сам файл доступен', async () => {
  const response = await a.upload(aId);
  const avatar = response.data.user.avatar;

  assert.equal(response.status, 200);
  assert.match(avatar, /^[0-9a-f-]{36}\.png$/);

  const files = await readdir(uploadsDir);
  assert.ok(files.includes(avatar));

  const served = await fetch(`${app.base}/uploads/${avatar}`);
  const bytes = Buffer.from(await served.arrayBuffer());

  assert.equal(served.status, 200);
  assert.match(served.headers.get('content-type'), /image\/png/);
  assert.ok(bytes.equals(PNG));
});

test('новая загрузка заменяет старый файл, а не копит мусор', async () => {
  const before = await readdir(uploadsDir);
  const response = await a.upload(aId);
  const avatar = response.data.user.avatar;

  assert.equal(response.status, 200);
  assert.equal(before.includes(avatar), false, 'имя файла должно быть новым');

  const after = await readdir(uploadsDir);
  const stale = before.filter((file) => !after.includes(file));

  assert.equal(stale.length, before.length, 'старые файлы должны исчезнуть');
  assert.ok(after.includes(avatar));
});

test('не-картинка отклоняется с 400', async () => {
  const response = await a.upload(aId, {
    buffer: Buffer.from('hello'),
    type: 'text/plain',
    filename: 'note.txt',
  });

  assert.equal(response.status, 400);
  assert.match(response.data.error, /PNG, JPEG или WebP/);
});

test('SVG отклоняется — он может содержать скрипты', async () => {
  const response = await a.upload(aId, {
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    type: 'image/svg+xml',
    filename: 'x.svg',
  });

  assert.equal(response.status, 400);
});

test('файл больше 2 МБ отклоняется с 400', async () => {
  const response = await a.upload(aId, {
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1),
    type: 'image/png',
    filename: 'big.png',
  });

  assert.equal(response.status, 400);
  assert.match(response.data.error, /2 МБ/);
});

test('запрос без файла даёт 400', async () => {
  const response = await a.request('POST', `/api/users/${aId}/avatar`, {
    form: new FormData(),
  });

  assert.equal(response.status, 400);
});

test('гость не может загрузить аватар, другой пользователь — тоже', async () => {
  const anonymous = await guest.upload(aId);
  assert.equal(anonymous.status, 401);

  const foreign = await b.upload(aId);
  assert.equal(foreign.status, 403);
});

test('невалидный UUID отклоняется до записи файла', async () => {
  const before = await readdir(uploadsDir);
  const response = await a.upload('not-a-uuid');
  const after = await readdir(uploadsDir);

  assert.equal(response.status, 400);
  assert.deepEqual(after.sort(), before.sort());
});

test('загрузка на чужой/несуществующий профиль даёт 403 и не оставляет файл', async () => {
  const before = await readdir(uploadsDir);
  const response = await a.upload('00000000-0000-4000-8000-000000000000');
  const after = await readdir(uploadsDir);

  // 403, а не 404: чужие идентификаторы не подтверждаем и не раскрываем,
  // существуют ли такие профили.
  assert.equal(response.status, 403);
  assert.deepEqual(after.sort(), before.sort());
});

test('аватар удаляется вместе с профилем', async () => {
  const c = new TestClient(app.base);
  const created = await c.register({ name: 'С аватаром', email: uniqueEmail('avatar-del') });
  const id = created.data.user._id;

  const uploaded = await c.upload(id);
  const avatar = uploaded.data.user.avatar;
  assert.ok((await readdir(uploadsDir)).includes(avatar));

  const removed = await c.remove(id);
  assert.equal(removed.status, 204);

  const files = await readdir(uploadsDir);
  assert.ok(!files.includes(avatar));
});
