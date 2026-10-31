import { badRequest, notFound } from '../utils/errors.js';
import { update as repoUpdate, getById } from '../repositories/users.repository.js';

/**
 * СЛОЙ БИЗНЕС-ЛОГИКИ (профиль пользователя).
 *
 * Правила профиля: что можно изменить, как выглядит допустимое имя
 * и e-mail. Слой ничего не знает ни про Express, ни про SQL.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Допустимые роли пользователя. */
export const ROLES = ['user', 'admin'];

const LIMITS = {
  name: { min: 1, max: 60 },
};

/** Приводит строку к обрезанному виду. */
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Текущий профиль пользователя. */
export async function getProfile(id) {
  const user = await getById(id);

  if (!user) {
    throw notFound('Пользователь не найден');
  }

  return user;
}

/**
 * Изменение профиля.
 *
 * @param {number} id — идентификатор текущего пользователя
 * @param {object} payload — поля профиля
 * @returns {Promise<object>} обновлённый профиль
 */
export async function updateProfile(id, payload) {
  const body = payload ?? {};

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Тело запроса должно быть объектом');
  }

  const fields = {};

  if (body.name !== undefined) {
    const name = clean(body.name);

    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
      throw badRequest(`Имя: от ${LIMITS.name.min} до ${LIMITS.name.max} символов`);
    }

    fields.name = name;
  }

  if (body.email !== undefined) {
    const email = clean(body.email).toLowerCase();

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      throw badRequest('Некорректный e-mail');
    }

    fields.email = email;
  }

  if (body.role !== undefined) {
    const role = clean(body.role);

    if (!ROLES.includes(role)) {
      throw badRequest(`Неизвестная роль: ${role}`);
    }

    fields.role = role;
  }

  if (Object.keys(fields).length === 0) {
    throw badRequest('Не передано ни одного изменяемого поля');
  }

  return repoUpdate(id, fields);
}
