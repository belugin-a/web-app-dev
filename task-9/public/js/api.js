/**
 * Клиентский слой доступа к серверу.
 *
 * Все обращения к бэкенду идут через эти функции. Здесь нет ни логики
 * приложения, ни знания о правилах — только запросы и разбор ответов.
 */

const BASE = '/api';

/** Выполняет запрос к серверу и возвращает разобранный ответ. */
async function request(method, url, body) {
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error ?? `Ошибка сервера (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

/** Собирает строку запроса из параметров, пропуская пустые значения. */
function toQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  }

  const string = query.toString();

  return string ? `?${string}` : '';
}

export const api = {
  /** Проверка живости сервера. */
  health: () => request('GET', '/health'),

  /** Справочные значения: статусы, приоритеты, переходы, сроки. */
  meta: () => request('GET', '/meta'),

  /** Сводка по заявкам. */
  stats: () => request('GET', '/stats'),

  /** Список заявок с фильтрами. */
  listTickets: (filters) => request('GET', `/tickets${toQuery(filters)}`),

  /** Одна заявка. */
  getTicket: (id) => request('GET', `/tickets/${id}`),

  /** Создание заявки. */
  createTicket: (payload) => request('POST', '/tickets', payload),

  /** Изменение полей заявки. */
  updateTicket: (id, payload) => request('PATCH', `/tickets/${id}`, payload),

  /** Смена статуса с проверкой перехода на сервере. */
  changeStatus: (id, status) => request('POST', `/tickets/${id}/status`, { status }),

  /** Удаление заявки. */
  deleteTicket: (id) => request('DELETE', `/tickets/${id}`),
};
