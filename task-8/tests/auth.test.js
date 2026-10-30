import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { startTestApp, TestClient, User, uniqueEmail } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app.stop();
});

test('регистрация возвращает 201, UUID, cookie и не отдаёт хеш пароля', async () => {
  const client = new TestClient(app.base);
  const email = uniqueEmail('reg');

  const response = await client.register({ name: '  Иван Петров  ', email: email.toUpperCase() });
  const { user } = response.data;

  assert.equal(response.status, 201);
  assert.match(user._id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(user.name, 'Иван Петров');
  assert.equal(user.email, email);
  assert.equal(user.about, '');
  assert.equal(user.avatar, null);
  assert.ok(user.createdAt);
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.password, undefined);
  assert.match(client.cookie, /^token=/);
});

test('пароль хранится в виде bcrypt-хеша, а не открытым текстом', async () => {
  const client = new TestClient(app.base);
  const response = await client.register({ email: uniqueEmail('hash') });
  const stored = await User.findById(response.data.user._id).select('+passwordHash').lean();

  assert.match(stored.passwordHash, /^\$2[aby]\$/);
  assert.notEqual(stored.passwordHash, 'password123');
});

test('повторная регистрация с тем же e-mail даёт 409', async () => {
  const email = uniqueEmail('dup');
  const first = await new TestClient(app.base).register({ email });
  assert.equal(first.status, 201);

  const second = await new TestClient(app.base).register({ email });
  assert.equal(second.status, 409);
  assert.match(second.data.error, /уже существует/);
});

test('e-mail сравнивается без учёта регистра', async () => {
  const email = uniqueEmail('case');
  const first = await new TestClient(app.base).register({ email });
  assert.equal(first.status, 201);

  const second = await new TestClient(app.base).register({ email: email.toUpperCase() });
  assert.equal(second.status, 409);
});

test('некорректные данные регистрации отклоняются с 400', async () => {
  const cases = [
    ['пустое имя', { name: '   ', email: uniqueEmail('v1'), password: 'password123' }],
    ['нет имени', { email: uniqueEmail('v2'), password: 'password123' }],
    ['битый e-mail', { name: 'Тест', email: 'not-an-email', password: 'password123' }],
    ['короткий пароль', { name: 'Тест', email: uniqueEmail('v3'), password: '123' }],
    ['длинный пароль', { name: 'Тест', email: uniqueEmail('v4'), password: 'x'.repeat(73) }],
    ['длинное имя', { name: 'x'.repeat(61), email: uniqueEmail('v5'), password: 'password123' }],
  ];

  for (const [label, payload] of cases) {
    const response = await new TestClient(app.base).request('POST', '/api/auth/register', {
      body: payload,
    });
    assert.equal(response.status, 400, label);
    assert.ok(response.data.error, label);
  }
});

test('регистрация без e-mail или пароля даёт 400', async () => {
  const client = new TestClient(app.base);

  const noEmail = await client.request('POST', '/api/auth/register', {
    body: { name: 'Без почты', password: 'password123' },
  });
  assert.equal(noEmail.status, 400);

  const noPassword = await client.request('POST', '/api/auth/register', {
    body: { name: 'Без пароля', email: uniqueEmail('np') },
  });
  assert.equal(noPassword.status, 400);
});

test('вход по e-mail в другом регистре возвращает 200 и cookie', async () => {
  const email = uniqueEmail('login');
  await new TestClient(app.base).register({ email, name: 'Логин Тест' });

  const client = new TestClient(app.base);
  const response = await client.login(email.toUpperCase());

  assert.equal(response.status, 200);
  assert.equal(response.data.user.email, email);
  assert.match(client.cookie, /^token=/);
});

test('неверный пароль и несуществующий e-mail дают одинаковый 401', async () => {
  const email = uniqueEmail('wrong');
  await new TestClient(app.base).register({ email });

  const wrongPassword = await new TestClient(app.base).login(email, 'wrong-password');
  const unknownEmail = await new TestClient(app.base).login(uniqueEmail('nobody'));

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.data.error, unknownEmail.data.error);
});

test('вход без пароля даёт 400', async () => {
  const response = await new TestClient(app.base).request('POST', '/api/auth/login', {
    body: { email: uniqueEmail('nopass') },
  });

  assert.equal(response.status, 400);
});

test('/api/users/me возвращает свой профиль с e-mail', async () => {
  const client = new TestClient(app.base);
  const email = uniqueEmail('me');
  const registered = await client.register({ email, name: 'Профиль Я' });

  const response = await client.me();

  assert.equal(response.status, 200);
  assert.equal(response.data.user._id, registered.data.user._id);
  assert.equal(response.data.user.email, email);
  assert.equal(response.data.user.passwordHash, undefined);
});

test('выход очищает сессию: /me после logout даёт 401', async () => {
  const client = new TestClient(app.base);
  await client.register({ email: uniqueEmail('logout') });

  const logout = await client.logout();
  assert.equal(logout.status, 204);

  const me = await client.me();
  assert.equal(me.status, 401);
});

test('поддельный и испорченный токен дают 401', async () => {
  const client = new TestClient(app.base);

  for (const cookie of ['token=garbage', 'token=', 'other=value']) {
    const response = await client.request('GET', '/api/users/me', { cookie });
    assert.equal(response.status, 401, cookie);
  }
});

test('токен удалённого пользователя перестаёт работать', async () => {
  const client = new TestClient(app.base);
  const registered = await client.register({ email: uniqueEmail('deleted') });

  const removed = await client.remove(registered.data.user._id);
  assert.equal(removed.status, 204);

  const me = await client.me();
  assert.equal(me.status, 401);
});
