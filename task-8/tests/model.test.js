import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { startTestApp, User, uniqueEmail } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app.stop();
});

test('схема создаёт UUID, нормализует поля и ставит timestamps', async () => {
  const user = await User.create({
    name: '  Мария Тестова  ',
    email: uniqueEmail('model').toUpperCase(),
    passwordHash: 'fake-hash',
  });

  assert.match(user._id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(user.name, 'Мария Тестова');
  assert.match(user.email, /@example\.com$/);
  assert.equal(user.about, '');
  assert.equal(user.avatar, null);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.updatedAt instanceof Date);
});

test('passwordHash скрыт по умолчанию и в JSON', async () => {
  const created = await User.create({
    name: 'Хеш Тест',
    email: uniqueEmail('hash-model'),
    passwordHash: 'secret-hash',
  });

  const plain = await User.findById(created._id);
  assert.equal(plain.passwordHash, undefined);
  assert.equal(created.toJSON().passwordHash, undefined);

  const explicit = await User.findById(created._id).select('+passwordHash');
  assert.equal(explicit.passwordHash, 'secret-hash');
});

test('валидация схемы не пропускает некорректные данные', async () => {
  const cases = [
    ['без e-mail', { name: 'Без почты', passwordHash: 'x' }, /E-mail обязателен/],
    ['без имени', { email: uniqueEmail('no-name'), passwordHash: 'x' }, /Имя обязательно/],
    [
      'битый e-mail',
      { name: 'Тест', email: 'not-an-email', passwordHash: 'x' },
      /Некорректный e-mail/,
    ],
    [
      'длинное имя',
      { name: 'x'.repeat(61), email: uniqueEmail('long-name'), passwordHash: 'x' },
      /длиннее 60/,
    ],
    [
      'длинное описание',
      {
        name: 'Тест',
        email: uniqueEmail('long-about'),
        passwordHash: 'x',
        about: 'x'.repeat(501),
      },
      /длиннее 500/,
    ],
  ];

  for (const [label, data, pattern] of cases) {
    await assert.rejects(() => User.create(data), pattern, label);
  }
});

test('уникальный индекс не даёт создать двух пользователей с одним e-mail', async () => {
  const email = uniqueEmail('unique-model');

  await User.create({ name: 'Первый', email, passwordHash: 'x' });

  await assert.rejects(
    () => User.create({ name: 'Второй', email, passwordHash: 'y' }),
    (error) => error.code === 11000,
  );
});

test('уникальный индекс по e-mail действительно создан в MongoDB', async () => {
  const indexes = await User.collection.indexes();
  const uniqueEmailIndex = indexes.find((index) => index.key.email === 1);

  assert.ok(uniqueEmailIndex);
  assert.equal(uniqueEmailIndex.unique, true);
});

test('Mongoose обновляет и удаляет документы', async () => {
  const created = await User.create({
    name: 'До обновления',
    email: uniqueEmail('crud-model'),
    passwordHash: 'x',
  });

  const updated = await User.findByIdAndUpdate(
    created._id,
    { name: 'После обновления' },
    { returnDocument: 'after', runValidators: true },
  );

  assert.equal(updated.name, 'После обновления');
  assert.ok(updated.updatedAt >= updated.createdAt);

  const deleted = await User.findByIdAndDelete(created._id);
  assert.equal(deleted._id.toString(), created._id.toString());
  assert.equal(await User.findById(created._id), null);
});
