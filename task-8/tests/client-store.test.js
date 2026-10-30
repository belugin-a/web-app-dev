import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Минимальная заглушка localStorage — модуль store.js работает с ним напрямую.
const storage = new Map();

globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const { clearSession, getSession, setSession } = await import('../public/js/store.js');

beforeEach(() => {
  storage.clear();
  clearSession();
});

test('без сохранённой сессии getSession возвращает null', () => {
  assert.equal(getSession(), null);
});

test('setSession сохраняет только id и имя', () => {
  const session = setSession({
    _id: '11111111-2222-4333-8444-555555555555',
    name: 'Иван',
    email: 'ivan@example.com',
    passwordHash: 'secret',
  });

  assert.deepEqual(session, { id: '11111111-2222-4333-8444-555555555555', name: 'Иван' });
  assert.deepEqual(getSession(), session);

  const raw = storage.get('pr8.session');
  assert.ok(!raw.includes('ivan@example.com'));
  assert.ok(!raw.includes('secret'));
});

test('clearSession удаляет сессию из памяти и localStorage', () => {
  setSession({ _id: 'abc', name: 'Тест' });
  assert.equal(storage.has('pr8.session'), true);

  assert.equal(clearSession(), null);
  assert.equal(getSession(), null);
  assert.equal(storage.has('pr8.session'), false);
});

test('битые данные в localStorage не роняют приложение', async () => {
  storage.set('pr8.session', '{не json');
  const fresh = await import('../public/js/store.js?corrupted');

  assert.equal(fresh.getSession(), null);
});
