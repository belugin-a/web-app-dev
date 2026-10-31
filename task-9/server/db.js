import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { config } from './config.js';

/**
 * Слой доступа к данным: подключение к SQLite.
 *
 * Здесь только соединение и схема таблиц. Все запросы к данным живут
 * в слое репозиториев (server/repositories/), а правила предметной
 * области — в слое бизнес-логики (server/services/).
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    priority    TEXT    NOT NULL,
    status      TEXT    NOT NULL,
    assignee    TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets (status);
  CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
  CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets (assignee);
`;

let db = null;

/** Открывает базу (создаёт файл и таблицы при первом запуске). */
export function openDatabase() {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

  db = new DatabaseSync(config.dbFile);

  // Внешние ключи и WAL-режим включает привычное поведение SQLite.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');

  // Штатный LIKE в SQLite регистронезависим только для ASCII.
  // Своя функция нужна, чтобы поиск работал и по кириллице.
  db.function('lower_ru', { deterministic: true }, (value) =>
    value === null ? null : String(value).toLowerCase(),
  );

  db.exec(SCHEMA);

  return db;
}

/** Текущее соединение (открывает базу при первом обращении). */
export function getDb() {
  return db ?? openDatabase();
}

/** Закрывает соединение (аккуратное завершение по Ctrl+C). */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
