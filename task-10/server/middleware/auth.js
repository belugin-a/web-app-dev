import { config } from '../config.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { findUserById, verifySessionToken } from '../services/auth.service.js';

/**
 * ПРОМЕЖУТОЧНЫЙ СЛОЙ: аутентификация и авторизация.
 *
 * Здесь только две вещи: кто сейчас вошёл в систему и имеет ли он право
 * на конкретное действие. Правила предметной области не проверяются —
 * за это отвечает слой бизнес-логики.
 */

/** Достаёт значение cookie без лишней зависимости. */
function readCookie(header, name) {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

/** Кладёт токен сессии в httpOnly-cookie: скрипты на странице его не прочитают. */
export function setAuthCookie(res, token) {
  res.cookie(config.authCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.sessionTtlMs,
    path: '/',
  });
}

/** Убирает cookie с сессией. */
export function clearAuthCookie(res) {
  res.clearCookie(config.authCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
}

/**
 * Аутентификация: проверяет токен из cookie и загружает пользователя.
 *
 * Пользователя читаем из базы на каждом запросе — удалённый аккаунт
 * автоматически теряет доступ, а смена роли видна сразу.
 */
export async function requireAuth(req, res, next) {
  const token = readCookie(req.headers.cookie, config.authCookie);

  if (!token) {
    throw unauthorized('Требуется вход в аккаунт');
  }

  const session = verifySessionToken(token);

  if (!session) {
    throw unauthorized('Сессия недействительна, войдите заново');
  }

  const user = await findUserById(session.userId);

  if (!user) {
    throw unauthorized('Сессия недействительна, войдите заново');
  }

  req.user = user;
  next();
}

/**
 * Авторизация: действие разрешено только пользователю с нужной ролью.
 * Гость сюда не доходит — его отсекает requireAuth выше.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw forbidden('Недостаточно прав для этого действия');
    }

    next();
  };
}

/**
 * Текущий пользователь или null. Используется на маршрутах, которые
 * работают и для гостя, и для вошедшего.
 */
export async function currentUser(req) {
  const token = readCookie(req.headers.cookie, config.authCookie);

  if (!token) {
    return null;
  }

  const session = verifySessionToken(token);

  if (!session) {
    return null;
  }

  return findUserById(session.userId);
}
