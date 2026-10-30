import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { User } from '../models/User.js';
import { badRequest, httpError } from '../utils/errors.js';

export const AUTH_COOKIE = 'token';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

/** Кладёт JWT в httpOnly-cookie: JS на клиенте токен прочитать не может. */
function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Проверка типов и длины пароля до обращения к базе. */
function assertCredentials(email, password) {
  if (!email || !password) {
    throw badRequest('Нужны поля email и password');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Пароль должен содержать минимум 8 символов');
  }
  // bcrypt учитывает только первые 72 байта — длиннее принимать нет смысла.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw badRequest('Пароль должен быть не длиннее 72 байт');
  }
}

export const authRouter = Router();

// POST /api/auth/register — регистрация.
authRouter.post('/register', async (req, res) => {
  const { name, email: rawEmail, password } = req.body ?? {};
  const email = normalizeEmail(rawEmail);

  assertCredentials(email, password);

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('Имя обязательно');
  }

  // Явная проверка даёт понятный 409 даже до создания уникального индекса.
  if (await User.exists({ email })) {
    throw httpError(409, 'Пользователь с таким e-mail уже существует');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  setAuthCookie(res, user._id);
  res.status(201).json({ user });
});

// POST /api/auth/login — вход по e-mail и паролю.
authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body ?? {};

  assertCredentials(email, password);

  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  // Одинаковый ответ на «нет пользователя» и «неверный пароль»:
  // не подсказываем, какие e-mail зарегистрированы.
  if (!matches) {
    throw httpError(401, 'Неверный e-mail или пароль');
  }

  setAuthCookie(res, user._id);
  res.json({ user });
});

// POST /api/auth/logout — удаление cookie. Работает и без авторизации.
authRouter.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
  res.status(204).end();
});
