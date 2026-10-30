const REQUEST_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Разбирает ответ: 204 — пусто, иначе JSON; ошибки превращает в ApiError. */
async function readResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || `Ошибка ${response.status}`, response.status);
  }

  return data;
}

/**
 * Обёртка над fetch: JSON туда-обратно, единый формат ошибок,
 * cookie отправляется автоматически (same-origin).
 */
async function request(method, url, body) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError('Сервер не отвечает. Проверьте, что он запущен.', 0);
  }

  return readResponse(response);
}

export const api = {
  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  logout: () => request('POST', '/api/auth/logout'),

  listUsers: () => request('GET', '/api/users'),
  getUser: (id) => request('GET', `/api/users/${encodeURIComponent(id)}`),
  updateUser: (id, patch) => request('PATCH', `/api/users/${encodeURIComponent(id)}`, patch),
  deleteUser: (id) => request('DELETE', `/api/users/${encodeURIComponent(id)}`),

  /** multipart/form-data: Content-Type выставляет сам браузер вместе с boundary. */
  async uploadAvatar(id, file) {
    const body = new FormData();
    body.append('avatar', file);

    let response;

    try {
      response = await fetch(`/api/users/${encodeURIComponent(id)}/avatar`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
    } catch {
      throw new ApiError('Сервер не отвечает. Проверьте, что он запущен.', 0);
    }

    return readResponse(response);
  },
};
