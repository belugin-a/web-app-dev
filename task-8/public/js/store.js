const STORAGE_KEY = 'pr8.session';

/**
 * На этом этапе сервер ещё не умеет отвечать «кто я» по cookie,
 * поэтому клиент запоминает минимум: id и имя. Пароль и почта здесь
 * не хранятся. После п.10 это заменится запросом /api/users/me.
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
