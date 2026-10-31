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
function buildFilters({ status, priority, assignee, assigneeUnassigned, ids, search }) {
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

  if (assigneeUnassigned) {
    // Заявки, которым ещё не назначен исполнитель.
    conditions.push("assignee = ''");
  } else if (assignee) {
    conditions.push('assignee = :assignee');
    params.assignee = assignee;
  }

  if (Array.isArray(ids)) {
    // Отбор по готовому списку номеров: набор просроченных заявок
    // считает бизнес-логика, а база только отбирает по нему.
    if (ids.length === 0) {
      conditions.push('1 = 0');
    } else {
      const placeholders = ids.map((_, index) => `:id${index}`);
      conditions.push(`id IN (${placeholders.join(', ')})`);

      ids.forEach((id, index) => {
        params[`id${index}`] = id;
      });
    }
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

/**
 * Количество заявок, сгруппированных по одному из полей.
 * Возвращает объект вида { 'новая': 4, 'в работе': 5 }.
 */
export async function countBy(column) {
  const db = getDb();

  if (!['status', 'priority', 'assignee'].includes(column)) {
    throw new Error(`Недопустимое поле для группировки: ${column}`);
  }

  const rows = db
    .prepare(`SELECT ${column} AS value, COUNT(*) AS count FROM tickets GROUP BY ${column}`)
    .all();

  return Object.fromEntries(rows.map((row) => [row.value, row.count]));
}

/**
 * Сырые данные для сводки: сколько заявок в каждом статусе и приоритете,
 * среднее время решения в часах и список незакрытых заявок с датой создания.
 *
 * Сроки (SLA) и признак просрочки считаются не здесь, а в слое
 * бизнес-логики — это правила предметной области, а не запрос к базе.
 */
export async function statsRaw() {
  const db = getDb();

  const byStatus = Object.fromEntries(
    db
      .prepare('SELECT status AS value, COUNT(*) AS count FROM tickets GROUP BY status')
      .all()
      .map((row) => [row.value, row.count]),
  );

  const byPriority = Object.fromEntries(
    db
      .prepare('SELECT priority AS value, COUNT(*) AS count FROM tickets GROUP BY priority')
      .all()
      .map((row) => [row.value, row.count]),
  );

  const average = db
    .prepare(
      `SELECT (julianday(updated_at) - julianday(created_at)) * 24 AS hours
       FROM tickets
       WHERE status IN ('решена', 'закрыта')`,
    )
    .all();

  const averageHours = average.length
    ? average.reduce((sum, row) => sum + row.hours, 0) / average.length
    : 0;

  const open = db
    .prepare(
      `SELECT id, priority, created_at FROM tickets
       WHERE status NOT IN ('решена', 'закрыта')`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      priority: row.priority,
      createdAt: row.created_at,
    }));

  return {
    total: db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count,
    byStatus,
    byPriority,
    averageHours: Math.round(averageHours * 10) / 10,
    open,
  };
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
