import { getDb } from '../db.js';

/**
 * СЛОЙ ДОСТУПА К ДАННЫМ (репозиторий заявок).
 *
 */

const SORT_COLUMNS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  title: 'title',
  status: 'status',
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Преобразует строку таблицы в объект заявки. */
function toTicket(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignee: row.assignee,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Собирает WHERE-условие и параметры по переданным фильтрам.
 * Имена параметров фиксированы и подставляются в SQL как параметры —
 * пользовательские значения в текст запроса не попадают.
 */
function buildFilters({ status, priority, assignee, search }) {
  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('status = :status');
    params.status = status;
  }

  if (priority) {
    conditions.push('priority = :priority');
    params.priority = priority;
  }

  if (assignee) {
    conditions.push('assignee = :assignee');
    params.assignee = assignee;
  }

  if (search) {
    conditions.push('(lower_ru(title) LIKE :search OR lower_ru(description) LIKE :search)');
    params.search = `%${String(search).toLowerCase()}%`;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Список заявок с фильтрами, поиском, сортировкой и постраничным выводом.
 *
 * @param {object} [filters]
 * @param {string} [filters.status]   — фильтр по статусу
 * @param {string} [filters.priority] — фильтр по приоритету
 * @param {string} [filters.assignee] — фильтр по исполнителю
 * @param {string} [filters.search]   — поиск по теме и описанию
 * @param {string} [filters.sortBy]   — createdAt | updatedAt | title | status
 * @param {'asc'|'desc'} [filters.sortOrder]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function list(filters = {}) {
  const db = getDb();
  const { where, params } = buildFilters(filters);

  const sortColumn = SORT_COLUMNS[filters.sortBy] ?? SORT_COLUMNS.createdAt;
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const total = db.prepare(`SELECT COUNT(*) AS count FROM tickets ${where}`).get(params).count;

  const rows = db
    .prepare(
      `SELECT * FROM tickets ${where}
       ORDER BY ${sortColumn} ${sortOrder}, id ${sortOrder}
       LIMIT :limit OFFSET :offset`,
    )
    .all({ ...params, limit, offset });

  return {
    items: rows.map(toTicket),
    total,
  };
}

/** Одна заявка по идентификатору либо null. */
export async function getById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tickets WHERE id = :id').get({ id: Number(id) });

  return toTicket(row);
}

/** Вставляет новую заявку и возвращает её с присвоенным id. */
export async function create(ticket) {
  const db = getDb();

  const result = db
    .prepare(
      `INSERT INTO tickets (title, description, priority, status, assignee, created_at, updated_at)
       VALUES (:title, :description, :priority, :status, :assignee, :createdAt, :updatedAt)`,
    )
    .run({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      status: ticket.status,
      assignee: ticket.assignee ?? '',
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });

  return getById(result.lastInsertRowid);
}

/** Обновляет перечисленные поля заявки. Возвращает обновлённую заявку. */
export async function update(id, changes) {
  const db = getDb();
  const ticketId = Number(id);

  const assignments = [];
  const params = { id: ticketId };

  for (const [key, column] of Object.entries({
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    assignee: 'assignee',
    updatedAt: 'updated_at',
  })) {
    if (changes[key] !== undefined) {
      assignments.push(`${column} = :${key}`);
      params[key] = changes[key];
    }
  }

  if (assignments.length) {
    db.prepare(`UPDATE tickets SET ${assignments.join(', ')} WHERE id = :id`).run(params);
  }

  return getById(ticketId);
}

/** Удаляет заявку. Возвращает true, если строка была удалена. */
export async function remove(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM tickets WHERE id = :id').run({ id: Number(id) });

  return result.changes > 0;
}

/** Общее количество заявок в таблице. */
export async function count() {
  const db = getDb();

  return db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count;
}

/** Массовая вставка — используется для заполнения демо-данными. */
export async function insertMany(tickets) {
  const db = getDb();

  const insert = db.prepare(
    `INSERT INTO tickets (title, description, priority, status, assignee, created_at, updated_at)
     VALUES (:title, :description, :priority, :status, :assignee, :createdAt, :updatedAt)`,
  );

  for (const ticket of tickets) {
    insert.run({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      status: ticket.status,
      assignee: ticket.assignee ?? '',
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  }

  return tickets.length;
}
