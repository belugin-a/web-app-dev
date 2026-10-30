const STORAGE_KEY = 'pr8.session';

/**
 * Клиент помнит id и имя, чтобы шапка не мигала до ответа /api/users/me.
 * Источник правды — сервер: при загрузке сессия проверяется запросом /me.
 * Подделка localStorage доступа не даёт — JWT лежит в httpOnly-cookie.
 */
function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

let session = read();

export function getSession() {
  return session;
}

export function setSession(user) {
  session = { id: user._id, name: user.name };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  session = null;
  localStorage.removeItem(STORAGE_KEY);
  return null;
}
