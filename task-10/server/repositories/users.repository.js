import { getDb } from '../db.js';

/**
 * Слой доступа к данным: пользователи.
 *
 * Репозиторий отвечает только за SQL и за форму строк. Он ничего не знает
 * про пароли, роли и правила доступа — этим занимается слой бизнес-логики.
 */

/** Приводит строку базы к объекту пользователя без пароля. */
function toUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** Пользователь по идентификатору. */
export async function getById(id) {
  const db = getDb();

  const row = db.prepare('SELECT * FROM users WHERE id = :id').get({ id: Number(id) });

  return toUser(row);
}

/**
 * Пользователь по e-mail вместе с хешем пароля.
 * Хеш нужен только для проверки пароля, наружу он не отдаётся.
 */
export async function getByEmailWithHash(email) {
  const db = getDb();

  const row = db
    .prepare('SELECT * FROM users WHERE email = :email')
    .get({ email: String(email) });

  return row ?? null;
}

/** Есть ли уже пользователь с таким e-mail. */
export async function existsByEmail(email) {
  const db = getDb();

  const row = db.prepare('SELECT 1 AS found FROM users WHERE email = :email').get({
    email: String(email),
  });

  return Boolean(row);
}

/** Создаёт пользователя и возвращает его без хеша пароля. */
export async function create({ name, email, passwordHash, role }) {
  const db = getDb();

  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES (:name, :email, :passwordHash, :role, :createdAt)`,
    )
    .run({ name, email, passwordHash, role, createdAt: now });

  return getById(result.lastInsertRowid);
}

/** Обновляет поля пользователя. Возвращает обновлённого пользователя. */
export async function update(id, fields) {
  const db = getDb();

  const assignments = [];
  const params = { id: Number(id) };

  const columns = {
    name: 'name',
    email: 'email',
    role: 'role',
  };

  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      assignments.push(`${column} = :${key}`);
      params[key] = fields[key];
    }
  }

  if (assignments.length === 0) {
    return getById(id);
  }

  db.prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = :id`).run(params);

  return getById(id);
}

/** Количество пользователей в базе. */
export async function count() {
  const db = getDb();

  return db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
}
