import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avatarHtml,
  escapeHtml,
  formatDate,
  initials,
  shortId,
} from '../public/js/ui.js';
import {
  forbiddenTemplate,
  homeTemplate,
  loginRequiredTemplate,
  profileTemplate,
  usersTemplate,
} from '../public/js/views.js';

const user = {
  _id: '11111111-2222-4333-8444-555555555555',
  name: 'Иван Петров',
  email: 'ivan@example.com',
  about: 'Люблю Node.js',
  avatar: null,
  createdAt: '2026-10-30T12:00:00.000Z',
};

test('escapeHtml экранирует HTML-спецсимволы', () => {
  assert.equal(
    escapeHtml(`<script>"x" & 'y'</script>`),
    '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('initials берёт первые буквы двух слов и переживает пустое имя', () => {
  assert.equal(initials('Иван Петров'), 'ИП');
  assert.equal(initials('  мария  '), 'М');
  assert.equal(initials('Анна-Мария Смирнова'), 'АС');
  assert.equal(initials(''), '');
  assert.equal(initials(undefined), '');
});

test('shortId оставляет первые 8 символов', () => {
  assert.equal(shortId('11111111-2222-4333-8444-555555555555'), '11111111');
  assert.equal(shortId(''), '');
});

test('formatDate выводит дату по-русски', () => {
  assert.match(formatDate('2026-10-30T12:00:00.000Z'), /2026/);
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('не дата'), '—');
});

test('avatarHtml показывает картинку или инициалы', () => {
  assert.match(avatarHtml({ ...user, avatar: 'abc.png' }), /src="\/uploads\/abc\.png"/);
  assert.match(avatarHtml(user, 'lg'), /avatar--lg/);
  assert.match(avatarHtml(user), />ИП</);
  assert.match(avatarHtml({ name: '' }), />\?</);
});

test('главная для гостя показывает вход без поля «Имя»', () => {
  const html = homeTemplate({ session: null, authMode: 'login' });

  assert.match(html, /data-tab="login"/);
  assert.match(html, /data-tab="register"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
  assert.ok(!html.includes('name="name"'), 'на входе не должно быть поля имени');
});

test('главная в режиме регистрации показывает поле «Имя»', () => {
  const html = homeTemplate({ session: null, authMode: 'register' });

  assert.match(html, /name="name"/);
  assert.match(html, /Создать аккаунт/);
});

test('главная для вошедшего показывает ссылки вместо форм', () => {
  const html = homeTemplate({
    session: { id: user._id, name: user.name },
    authMode: 'login',
  });

  assert.match(html, /Мой профиль/);
  assert.match(html, /href="#\/users"/);
  assert.ok(!html.includes('data-tab'), 'вкладки входа не нужны');
});

test('пустой список профилей ведёт на регистрацию', () => {
  const html = usersTemplate({ users: [], session: null });

  assert.match(html, /href="#\/register"/);
  assert.match(html, /Зарегистрируйтесь/);
});

test('карточка пользователя содержит ссылку, описание и пометку «это вы»', () => {
  const html = usersTemplate({
    users: [user],
    session: { id: user._id, name: user.name },
  });

  assert.match(html, new RegExp(`href="#/u/${user._id}"`));
  assert.match(html, /Иван Петров/);
  assert.match(html, /Люблю Node\.js/);
  assert.match(html, /это вы/);
  assert.match(html, /ID 11111111/);
});

test('список экранирует пользовательские данные', () => {
  const html = usersTemplate({
    users: [{ ...user, name: '<script>alert(1)</script>', about: '<b>bold</b>' }],
    session: null,
  });

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!html.includes('<b>bold</b>'));
});

test('свой профиль показывает кнопки и e-mail', () => {
  const html = profileTemplate({
    user,
    session: { id: user._id, name: user.name },
    isSelf: true,
  });

  assert.match(html, /Изменить/);
  assert.match(html, /Удалить/);
  assert.match(html, /ivan@example\.com/);
  assert.match(html, /это вы/);
});

test('чужой профиль не показывает кнопки и не раскрывает e-mail', () => {
  const html = profileTemplate({
    user: { ...user, email: undefined },
    session: { id: 'other', name: 'Другой' },
    isSelf: false,
  });

  assert.ok(!html.includes('Изменить'));
  assert.ok(!html.includes('Удалить'));
  assert.match(html, /<dd>—<\/dd>/);
});

test('профиль экранирует имя и описание', () => {
  const html = profileTemplate({
    user: { ...user, name: '<img src=x onerror=alert(1)>', about: '<script>x</script>' },
    session: null,
    isSelf: false,
  });

  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>x</script>'));
  assert.match(html, /&lt;img src=x/);
});

test('экраны «Нужно войти» и «Нет доступа» содержат понятные действия', () => {
  const login = loginRequiredTemplate();
  assert.match(login, /Нужно войти/);
  assert.match(login, /href="#\/login"/);
  assert.match(login, /href="#\/register"/);

  const forbidden = forbiddenTemplate('Можно изменять только свой профиль');
  assert.match(forbidden, /Нет доступа/);
  assert.match(forbidden, /только свой профиль/);
});
