import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { config } from '../config.js';
import { badRequest, conflict, tooManyRequests, unauthorized } from '../utils/errors.js';
import {
  create as repoCreate,
  existsByEmail,
  getByEmailWithHash,
  getById,
} from '../repositories/users.repository.js';

/**
 * СЛОЙ БИЗНЕС-ЛОГИКИ (аутентификация и учётные записи).
 *
 * Здесь живут правила, связанные с учётной записью: как проверяется
 * пароль, что считается допустимым e-mail, когда учётная запись
 * считается занятой. Слой ничего не знает ни про Express, ни про cookie:
 * наружу отдаёт обычные объекты и бросает типизированные ошибки.
 */

const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Сколько неудачных попыток входа допускается до временной блокировки. */
const MAX_FAILED_ATTEMPTS = 5;

/** На сколько блокируется вход после превышения лимита. */
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Неудачные попытки входа по каждому адресу.
 *
 * Блокировка считается по адресу, а не по учётной записи: одинаковый
 * порог и одинаковый ответ для существующего и несуществующего адреса,
 * поэтому перебором нельзя выяснить, какие адреса зарегистрированы.
 */
const loginAttempts = new Map();

/**
 * Хеш-заглушка для сравнения, когда учётной записи нет.
 * Он нужен, чтобы ответ на запрос занимал столько же времени, сколько
 * и настоящий вход: иначе по времени ответа можно отличить
 * существующий адрес от несуществующего.
 */
let dummyHash = null;

function getDummyHash() {
  if (!dummyHash) {
    dummyHash = bcrypt.hashSync('пароль-по-умолчанию', BCRYPT_ROUNDS);
  }

  return dummyHash;
}

/**
 * Возвращает оставшееся время блокировки в минутах
 * или null, если блокировки нет.
 */
export function getLockMinutes(email) {
  const record = loginAttempts.get(email);

  if (!record) {
    return null;
  }

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return Math.ceil((record.lockedUntil - Date.now()) / 60_000);
  }

  // Блокировка истекла — дальше попытки снова считаются заново.
  if (record.lockedUntil) {
    loginAttempts.delete(email);
  }

  return null;
}

/** Засчитывает неудачную попытку входа и при необходимости блокирует адрес. */
function registerFailedAttempt(email) {
  const record = loginAttempts.get(email) ?? { count: 0, lockedUntil: null };

  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }

  loginAttempts.set(email, record);
}

/** Приводит e-mail к общему виду: обрезанные края и нижний регистр. */
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Проверка типов и длины пароля до обращения к базе. */
function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Пароль должен содержать минимум 8 символов');
  }

  // bcrypt учитывает только первые 72 байта — длиннее принимать нет смысла.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw badRequest('Пароль должен быть не длиннее 72 байт');
  }
}

/**
 * Регистрация нового пользователя.
 *
 * @param {object} payload — { name, email, password }
 * @returns {Promise<object>} созданный пользователь без хеша пароля
 */
export async function registerUser(payload) {
  const body = payload ?? {};
  const email = normalizeEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name) {
    throw badRequest('Имя обязательно');
  }

  if (name.length > 60) {
    throw badRequest('Имя длиннее 60 символов');
  }

  if (!email) {
    throw badRequest('E-mail обязателен');
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw badRequest('Некорректный e-mail');
  }

  assertPassword(body.password);

  if (await existsByEmail(email)) {
    throw conflict('Пользователь с таким e-mail уже существует');
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  return repoCreate({ name, email, passwordHash, role: 'user' });
}

/**
 * Проверка входа: e-mail и пароль.
 *
 * Одинаковый ответ на «нет пользователя» и «неверный пароль»:
 * не подсказываем, какие e-mail зарегистрированы.
 *
 * @param {object} payload — { email, password }
 * @returns {Promise<object>} пользователь без хеша пароля
 */
export async function authenticateUser(payload) {
  const body = payload ?? {};
  const email = normalizeEmail(body.email);

  if (!email || typeof body.password !== 'string' || !body.password) {
    throw badRequest('Нужны поля email и password');
  }

  const lockedMinutes = getLockMinutes(email);

  if (lockedMinutes) {
    throw tooManyRequests(
      `Слишком много неудачных попыток входа. Повторите через ${lockedMinutes} мин.`,
    );
  }

  const row = await getByEmailWithHash(email);

  // Сравнение всегда идёт с настоящим хешем: для несуществующего адреса
  // используется хеш-заглушка, чтобы время ответа не выдавало наличие
  // учётной записи.
  const matches = await bcrypt.compare(body.password, row?.password_hash ?? getDummyHash());

  if (!row || !matches) {
    registerFailedAttempt(email);
    throw unauthorized('Неверный e-mail или пароль');
  }

  // Успешный вход снимает счётчик неудачных попыток.
  loginAttempts.delete(email);

  return getById(row.id);
}

/**
 * Выдаёт подписанный токен сессии для пользователя.
 * Токен кладётся в httpOnly-cookie и не доступен скриптам на странице.
 */
export function issueSessionToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.sessionSecret, {
    expiresIn: Math.floor(config.sessionTtlMs / 1000),
  });
}

/** Проверяет токен сессии и возвращает идентификатор пользователя. */
export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(token, config.sessionSecret);

    return { userId: Number(payload.sub) };
  } catch {
    return null;
  }
}

/** Возвращает пользователя по идентификатору. */
export async function findUserById(id) {
  return getById(id);
}
