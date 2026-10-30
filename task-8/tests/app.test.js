import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { startTestApp } from './helpers.js';

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app.stop();
});

test('/api/health отвечает 200 и сообщает состояние БД', async () => {
  const response = await fetch(`${app.base}/api/health`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'connected');
  assert.equal(body.app, 'task-8-user-profiles');
  assert.ok(body.uptime >= 0);
  assert.ok(body.time);
});

test('сервер не раскрывает Express и выставляет защитные заголовки', async () => {
  const response = await fetch(`${app.base}/api/health`);

  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
});

test('главная страница отдаёт HTML-каркас приложения', async () => {
  const response = await fetch(`${app.base}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html, /id="app"/);
  assert.match(html, /id="confirm-dialog"/);
  assert.match(html, /src="\/js\/app\.js"/);
});

test('клиентские CSS и JS отдаются сервером', async () => {
  for (const asset of ['/css/style.css', '/js/app.js', '/js/api.js', '/js/views.js']) {
    const response = await fetch(`${app.base}${asset}`);
    assert.equal(response.status, 200, asset);
  }
});

test('неизвестный API-маршрут возвращает JSON 404', async () => {
  const response = await fetch(`${app.base}/api/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, 'Маршрут не найден');
});

test('неизвестная страница возвращает текстовый 404', async () => {
  const response = await fetch(`${app.base}/unknown-page`);
  const text = await response.text();

  assert.equal(response.status, 404);
  assert.match(text, /страница не найдена/);
});

test('битый JSON в теле запроса даёт понятную ошибку 400', async () => {
  const response = await fetch(`${app.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Некорректный JSON в теле запроса');
});

test('слишком большое тело запроса отклоняется', async () => {
  const response = await fetch(`${app.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(200_000) }),
  });

  assert.equal(response.status, 413);
});
