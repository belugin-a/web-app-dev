import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { startTestApp, TestClient, User, uniqueEmail } from './helpers.js';

let app;
let a;
let b;
let guest;
let aId;

before(async () => {
  app = await startTestApp();
  guest = new TestClient(app.base);

  a = new TestClient(app.base);
  const createdA = await a.register({ name: 'Пользователь A', email: uniqueEmail('a') });
  aId = createdA.data.user._id;

  b = new TestClient(app.base);
  await b.register({ name: 'Пользователь B', email: uniqueEmail('b') });
});

after(async () => {
  await app.stop();
});

test('гость видит список профилей, но без e-mail и хешей', async () => {
  const response = await guest.list();
  const raw = JSON.stringify(response.data);

  assert.equal(response.status, 200);
  assert.ok(response.data.users.length >= 2);
  assert.ok(!raw.includes('@example.com'));
  assert.ok(!raw.includes('passwordHash'));
});

test('в списке только публичные поля профиля', async () => {
  const response = await guest.list();
  const fields = Object.keys(response.data.users[0]).sort();

  assert.deepEqual(fields, ['_id', 'about', 'avatar', 'createdAt', 'name']);
});

test('гость не может открыть профиль', async () => {
  const response = await guest.get(aId);

  assert.equal(response.status, 401);
  assert.match(response.data.error, /вход/i);
});

test('владелец видит свой профиль вместе с e-mail', async () => {
  const response = await a.get(aId);

  assert.equal(response.status, 200);
  assert.equal(response.data.user._id, aId);
  assert.match(response.data.user.email, /@example\.com$/);
});

test('вошедший видит чужой профиль без e-mail', async () => {
  const response = await b.get(aId);

  assert.equal(response.status, 200);
  assert.equal(response.data.user._id, aId);
  assert.equal(response.data.user.name, 'Пользователь A');
  assert.equal(response.data.user.email, undefined);
  assert.equal(response.data.user.passwordHash, undefined);
  assert.ok(response.data.user.createdAt);
});

test('неизвестный UUID даёт 404, невалидный — 400', async () => {
  const missing = await b.get('00000000-0000-4000-8000-000000000000');
  assert.equal(missing.status, 404);

  const invalid = await b.get('not-a-uuid');
  assert.equal(invalid.status, 400);
});

test('владелец обновляет имя и описание, изменения сохраняются', async () => {
  const update = await a.patch(aId, { name: 'Новое имя', about: 'Обновлённое описание' });

  assert.equal(update.status, 200);
  assert.equal(update.data.user.name, 'Новое имя');
  assert.equal(update.data.user.about, 'Обновлённое описание');

  const fresh = await a.get(aId);
  assert.equal(fresh.data.user.name, 'Новое имя');
  assert.equal(fresh.data.user.about, 'Обновлённое описание');
});

test('владелец может сменить e-mail и войти с новым', async () => {
  const email = uniqueEmail('newmail');
  const update = await a.patch(aId, { email });

  assert.equal(update.status, 200);
  assert.equal(update.data.user.email, email);

  const login = await new TestClient(app.base).login(email);
  assert.equal(login.status, 200);
});

test('смена e-mail на занятый даёт 409', async () => {
  const bEmail = (await b.me()).data.user.email;
  const update = await a.patch(aId, { email: bEmail });

  assert.equal(update.status, 409);
});

test('некорректные данные обновления дают 400', async () => {
  const cases = [
    ['пустое тело', {}],
    ['неизвестные поля', { passwordHash: 'hacked' }],
    ['длинное имя', { name: 'x'.repeat(61) }],
    ['битый e-mail', { email: 'bad-email' }],
  ];

  for (const [label, patch] of cases) {
    const response = await a.patch(aId, patch);
    assert.equal(response.status, 400, label);
  }
});

test('через PATCH нельзя подменить _id, avatar и passwordHash', async () => {
  const before = await a.me();
  const originalHash = (await User.findById(aId).select('+passwordHash').lean()).passwordHash;

  const update = await a.patch(aId, {
    name: 'Имя после атаки',
    _id: '00000000-0000-4000-8000-000000000000',
    avatar: 'evil.png',
    passwordHash: 'hacked',
  });

  assert.equal(update.status, 200);
  assert.equal(update.data.user._id, aId);
  assert.equal(update.data.user.avatar, before.data.user.avatar);
  assert.equal(update.data.user.email, before.data.user.email);

  const afterHash = (await User.findById(aId).select('+passwordHash').lean()).passwordHash;
  assert.equal(afterHash, originalHash);

  const login = await new TestClient(app.base).login(before.data.user.email);
  assert.equal(login.status, 200);
});

test('чужой профиль нельзя изменить, гость получает 401', async () => {
  const foreign = await b.patch(aId, { about: 'чужое изменение' });
  assert.equal(foreign.status, 403);

  const anonymous = await guest.patch(aId, { about: 'анонимное изменение' });
  assert.equal(anonymous.status, 401);

  const fresh = await a.get(aId);
  assert.notEqual(fresh.data.user.about, 'чужое изменение');
  assert.notEqual(fresh.data.user.about, 'анонимное изменение');
});

test('удалить профиль может только владелец', async () => {
  const c = new TestClient(app.base);
  const created = await c.register({ name: 'Временный', email: uniqueEmail('delete') });
  const id = created.data.user._id;

  const byGuest = await guest.remove(id);
  assert.equal(byGuest.status, 401);

  const byOther = await b.remove(id);
  assert.equal(byOther.status, 403);

  const byOwner = await c.remove(id);
  assert.equal(byOwner.status, 204);

  const afterDelete = await b.get(id);
  assert.equal(afterDelete.status, 404);

  const login = await new TestClient(app.base).login(created.data.user.email);
  assert.equal(login.status, 401);
});
