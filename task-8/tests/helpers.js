import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Отдельная база и папка загрузок на каждый тестовый файл (у каждого свой процесс),
// чтобы тесты не трогали рабочую базу и не мешали друг другу.
const dbName = `web-app-dev-test-${process.pid}`;
export const uploadsDir = await mkdtemp(path.join(tmpdir(), 'pr8-uploads-'));

process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${dbName}`;
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOADS_DIR = uploadsDir;

const { app } = await import('../server/app.js');
const { connectDb, disconnectDb } = await import('../server/db.js');
const { User } = await import('../server/models/User.js');
const mongoose = (await import('mongoose')).default;

export { User, mongoose };

/** Случайный порт из «безопасного» диапазона: undici блокирует часть низких портов. */
async function listenOnFreePort(server) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = 20_000 + Math.floor(Math.random() * 25_000);

    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => reject(error);
        server.once('error', onError);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', onError);
          resolve();
        });
      });

      return port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }

  throw new Error('Не удалось найти свободный порт для тестового сервера');
}

/** Поднимает приложение на случайном порту и чистит базу до и после. */
export async function startTestApp() {
  await connectDb(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();

  const server = createServer(app);
  const port = await listenOnFreePort(server);

  return {
    base: `http://127.0.0.1:${port}`,

    async stop() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.connection.dropDatabase();
      await disconnectDb();
      await rm(uploadsDir, { recursive: true, force: true });
    },
  };
}

let counter = 0;

export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${process.pid}.${counter}@example.com`;
}

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Клиент с собственным cookie-jar: один экземпляр = один браузер. */
export class TestClient {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async request(method, url, { body, form, cookie = this.cookie, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };

    if (cookie) {
      init.headers.cookie = cookie;
    }

    if (form) {
      init.body = form;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const response = await fetch(this.base + url, init);

    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length) {
      this.cookie = setCookie.map((value) => value.split(';')[0]).join('; ');
    }

    const type = response.headers.get('content-type') ?? '';
    const data = type.includes('application/json')
      ? await response.json()
      : await response.text();

    return { status: response.status, data, headers: response.headers };
  }

  register({ name = 'Тестовый Пользователь', email = uniqueEmail(), password = 'password123' } = {}) {
    return this.request('POST', '/api/auth/register', { body: { name, email, password } });
  }

  login(email, password = 'password123') {
    return this.request('POST', '/api/auth/login', { body: { email, password } });
  }

  logout() {
    return this.request('POST', '/api/auth/logout');
  }

  me() {
    return this.request('GET', '/api/users/me');
  }

  list() {
    return this.request('GET', '/api/users');
  }

  get(id) {
    return this.request('GET', `/api/users/${id}`);
  }

  patch(id, patch) {
    return this.request('PATCH', `/api/users/${id}`, { body: patch });
  }

  remove(id) {
    return this.request('DELETE', `/api/users/${id}`);
  }

  async upload(id, { buffer = PNG, type = 'image/png', filename = 'avatar.png' } = {}) {
    const form = new FormData();
    form.append('avatar', new Blob([buffer], { type }), filename);

    return this.request('POST', `/api/users/${id}/avatar`, { form });
  }
}
