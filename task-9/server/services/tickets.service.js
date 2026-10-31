import { badRequest, conflict, notFound } from '../utils/errors.js';
import {
  list as repoList,
  getById as repoGetById,
  create as repoCreate,
  update as repoUpdate,
  remove as repoRemove,
  statsRaw,
} from '../repositories/tickets.repository.js';

/**
 * СЛОЙ БИЗНЕС-ЛОГИКИ (сервис заявок).
 *
 * Здесь живут правила предметной области: какие статусы и приоритеты
 * допустимы, какие переходы между статусами разрешены, когда заявка
 * считается просроченной, что и в каком порядке показывается.
 *
 * Слой ничего не знает ни про Express, ни про SQL: наружу отдаёт
 * обычные объекты и бросает типизированные ошибки из utils/errors.js.
 */

/** Допустимые статусы заявки. */
export const STATUSES = ['новая', 'в работе', 'ожидает', 'решена', 'закрыта'];

/** Допустимые приоритеты заявки. */
export const PRIORITIES = ['низкий', 'обычный', 'высокий', 'критичный'];

/**
 * Таблица переходов статусов: из каких статусов в какие можно перейти.
 * Статус «закрыта» — терминальный, из него переходов нет.
 */
export const TRANSITIONS = {
  'новая': ['в работе', 'закрыта'],
  'в работе': ['ожидает', 'решена', 'закрыта'],
  'ожидает': ['в работе', 'решена', 'закрыта'],
  'решена': ['в работе', 'закрыта'],
  'закрыта': [],
};

/** Срок обработки (SLA) в часах в зависимости от приоритета. */
export const SLA_HOURS = {
  'критичный': 4,
  'высокий': 8,
  'обычный': 24,
  'низкий': 72,
};

/** Статусы, в которых заявка считается незакрытой. */
const OPEN_STATUSES = ['новая', 'в работе', 'ожидает'];

/** Порядок вывода статусов в фильтрах и сводке — по ходу работы. */
const STATUS_ORDER = ['новая', 'в работе', 'ожидает', 'решена', 'закрыта'];

/** Порядок вывода приоритетов — от низкого к критичному. */
const PRIORITY_ORDER = ['низкий', 'обычный', 'высокий', 'критичный'];

const LIMITS = {
  title: { min: 5, max: 120 },
  description: { min: 0, max: 2000 },
  assignee: { min: 2, max: 60 },
};

/** Проверяет, что значение — одно из допустимых. */
function assertOneOf(value, allowed, fieldName, message) {
  if (!allowed.includes(value)) {
    throw badRequest(`${message}: допустимо — ${allowed.join(', ')}`);
  }
}

/** Приводит строку к обрезанному виду. */
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Проверяет и нормализует входящие данные заявки.
 *
 * @param {object} payload — сырые данные из запроса
 * @param {boolean} partial — true для обновления (проверяем только переданные поля)
 * @returns {object} нормализованный объект полей
 */
function validateTicket(payload, { partial = false } = {}) {
  const body = payload ?? {};

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Тело запроса должно быть объектом');
  }

  const result = {};

  if (!partial || body.title !== undefined) {
    const title = clean(body.title);

    if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
      throw badRequest(
        `Тема: от ${LIMITS.title.min} до ${LIMITS.title.max} символов`,
      );
    }

    result.title = title;
  }

  if (!partial || body.description !== undefined) {
    const description = clean(body.description);

    if (description.length > LIMITS.description.max) {
      throw badRequest(`Описание: не более ${LIMITS.description.max} символов`);
    }

    result.description = description;
  }

  if (!partial || body.priority !== undefined) {
    const priority = clean(body.priority);

    assertOneOf(priority, PRIORITIES, 'Приоритет', 'Неизвестный приоритет');

    result.priority = priority;
  }

  if (!partial || body.assignee !== undefined) {
    const assignee = clean(body.assignee);

    if (assignee.length > LIMITS.assignee.max) {
      throw badRequest(`Исполнитель: не более ${LIMITS.assignee.max} символов`);
    }

    if (assignee.length > 0 && assignee.length < LIMITS.assignee.min) {
      throw badRequest(`Исполнитель: от ${LIMITS.assignee.min} символов`);
    }

    result.assignee = assignee;
  }

  if (partial && Object.keys(result).length === 0) {
    throw badRequest('Не передано ни одного изменяемого поля');
  }

  return result;
}

/** Дополняет заявку вычисляемыми полями: срок и признак просрочки. */
function decorate(ticket) {
  if (!ticket) {
    return ticket;
  }

  const slaHours = SLA_HOURS[ticket.priority];
  const createdAt = new Date(ticket.createdAt).getTime();
  const dueAt = createdAt + slaHours * 3600_000;
  const isOpen = OPEN_STATUSES.includes(ticket.status);

  return {
    ...ticket,
    slaHours,
    dueAt: new Date(dueAt).toISOString(),
    isOverdue: isOpen && Date.now() > dueAt,
  };
}

/**
 * Список заявок с фильтрами, поиском и сортировкой.
 * Фильтры проверяются: неизвестный статус или приоритет — ошибка 400.
 */
export async function listTickets(filters = {}) {
  const status = clean(filters.status);
  const priority = clean(filters.priority);
  const assignee = clean(filters.assignee);
  const search = clean(filters.search);

  if (status) {
    assertOneOf(status, STATUSES, 'Статус', 'Неизвестный статус');
  }

  if (priority) {
    assertOneOf(priority, PRIORITIES, 'Приоритет', 'Неизвестный приоритет');
  }

  const { items, total } = await repoList({
    status,
    priority,
    assignee,
    search,
    sortBy: clean(filters.sortBy),
    sortOrder: clean(filters.sortOrder),
    limit: filters.limit,
    offset: filters.offset,
  });

  return {
    items: items.map(decorate),
    total,
  };
}

/** Одна заявка по идентификатору. */
export async function getTicket(id) {
  const ticket = await repoGetById(id);

  if (!ticket) {
    throw notFound(`Заявка №${id} не найдена`);
  }

  return decorate(ticket);
}

/**
 * Создание новой заявки.
 * Новая заявка всегда попадает в базу в статусе «новая» — сменить статус
 * можно только через changeStatus, который проверяет таблицу переходов.
 */
export async function createTicket(payload) {
  const fields = validateTicket(payload);

  const now = new Date().toISOString();

  const ticket = await repoCreate({
    ...fields,
    status: 'новая',
    createdAt: now,
    updatedAt: now,
  });

  return decorate(ticket);
}

/**
 * Изменение полей заявки.
 * Статус здесь не меняется: для смены статуса есть отдельная операция
 * changeStatus, которая проверяет таблицу переходов.
 */
export async function updateTicket(id, payload) {
  const existing = await repoGetById(id);

  if (!existing) {
    throw notFound(`Заявка №${id} не найдена`);
  }

  if (payload?.status !== undefined) {
    throw badRequest(
      'Статус меняется отдельным запросом POST /api/tickets/:id/status',
    );
  }

  const fields = validateTicket(payload, { partial: true });

  const ticket = await repoUpdate(id, { ...fields, updatedAt: new Date().toISOString() });

  return decorate(ticket);
}

/**
 * Смена статуса заявки с проверкой таблицы переходов.
 *
 * @param {number} id
 * @param {object} payload — { status }
 */
export async function changeStatus(id, payload) {
  const existing = await repoGetById(id);

  if (!existing) {
    throw notFound(`Заявка №${id} не найдена`);
  }

  const status = clean(payload?.status);

  assertOneOf(status, STATUSES, 'Статус', 'Неизвестный статус');

  if (status === existing.status) {
    throw conflict(`Заявка уже в статусе «${status}»`);
  }

  const allowed = TRANSITIONS[existing.status] ?? [];

  if (!allowed.includes(status)) {
    const hint = allowed.length
      ? `Допустимо: ${allowed.join(', ')}`
      : 'Статус «закрыта» — это конечный статус, дальнейшие переходы невозможны';

    throw conflict(`Из статуса «${existing.status}» нельзя перейти в «${status}». ${hint}`);
  }

  const ticket = await repoUpdate(id, {
    status,
    updatedAt: new Date().toISOString(),
  });

  return decorate(ticket);
}

/**
 * Удаление заявки. Разрешено только для заявок в статусе «новая»:
 * заявку, которую уже взяли в работу, удалять нельзя.
 */
export async function deleteTicket(id) {
  const existing = await repoGetById(id);

  if (!existing) {
    throw notFound(`Заявка №${id} не найдена`);
  }

  if (existing.status !== 'новая') {
    throw conflict(
      `Удалить можно только заявку в статусе «новая», а у этой статус «${existing.status}»`,
    );
  }

  await repoRemove(id);

  return { id: existing.id, deleted: true };
}

/**
 * Сводка по заявкам: счётчики, среднее время решения, число просроченных.
 * Сроки (SLA) применяются здесь, в бизнес-логике.
 */
export async function getStats() {
  const raw = await statsRaw();

  const overdue = raw.open.filter((ticket) => {
    const dueAt = new Date(ticket.createdAt).getTime() + SLA_HOURS[ticket.priority] * 3600_000;

    return Date.now() > dueAt;
  });

  const byStatus = {};
  for (const status of STATUS_ORDER) {
    byStatus[status] = raw.byStatus[status] ?? 0;
  }

  const byPriority = {};
  for (const priority of PRIORITY_ORDER) {
    byPriority[priority] = raw.byPriority[priority] ?? 0;
  }

  const open = raw.open.length;

  return {
    total: raw.total,
    open,
    closed: raw.total - open,
    overdue: overdue.length,
    averageHours: raw.averageHours,
    byStatus,
    byPriority,
    slaHours: SLA_HOURS,
    overdueIds: overdue.map((ticket) => ticket.id),
  };
}

/** Справочные значения для клиента: статусы, приоритеты, переходы. */
export function getMeta() {
  return {
    statuses: STATUSES,
    priorities: PRIORITIES,
    transitions: TRANSITIONS,
    slaHours: SLA_HOURS,
    limits: LIMITS,
  };
}
