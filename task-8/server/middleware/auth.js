import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { User } from '../models/User.js';
import { httpError } from '../utils/errors.js';

export const AUTH_COOKIE = 'token';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Достаёт значение cookie без лишней зависимости. */
function readCookie(header, name) {
  if (!header) return null;

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

/** Кладёт JWT в httpOnly-cookie: JavaScript на клиенте токен не прочитает. */
export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
}

/**
 * Аутентификация: проверяет JWT из cookie и загружает пользователя.
 * Пользователя читаем из базы на каждом запросе — удалённый аккаунт
 * автоматически теряет доступ, а изменения имени сразу видны.
 */
export async function requireAuth(req, res, next) {
  const token = readCookie(req.headers.cookie, AUTH_COOKIE);

  if (!token) {
    throw httpError(401, 'Требуется вход в аккаунт');
  }

  let payload;

  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw httpError(401, 'Сессия недействительна, войдите заново');
  }

  const user = await User.findById(payload.sub);

  if (!user) {
    throw httpError(401, 'Сессия недействительна, войдите заново');
  }

  req.user = user;
  next();
}

/**
 * Авторизация: изменять профиль может только его владелец.
 * Гость сюда не доходит — его отсекает requireAuth выше.
 */
export function requireSelf(param = 'id') {
  return (req, res, next) => {
    if (req.user._id !== req.params[param]) {
      throw httpError(403, 'Можно изменять только свой профиль');
    }

    next();
  };
}
