import { fileURLToPath } from 'node:url';

import { SEED_TICKETS } from '../../data/seed.js';
import { openDatabase, closeDatabase } from '../db.js';
import { count, insertMany } from '../repositories/tickets.repository.js';

/**
 * Заполнение базы демо-данными, если таблица заявок пуста.
 * Запускается при старте сервера и отдельной командой.
 */

export async function seedDatabase() {
  const existing = await count();

  if (existing > 0) {
    console.log(`Сид: база уже содержит заявок — ${existing}, пропускаем.`);
    return { inserted: 0, skipped: true };
  }

  const now = Date.now();

  const tickets = SEED_TICKETS.map((ticket) => {
    const createdAt = new Date(now - ticket.createdHoursAgo * 3600_000).toISOString();
    const updatedAt =
      ticket.resolvedHoursAgo === null || ticket.resolvedHoursAgo === undefined
        ? createdAt
        : new Date(now - ticket.resolvedHoursAgo * 3600_000).toISOString();

    return {
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      assignee: ticket.assignee,
      createdAt,
      updatedAt,
    };
  });

  await insertMany(tickets);

  console.log(`Сид: добавлено демо-заявок — ${tickets.length}.`);

  return { inserted: tickets.length, skipped: false };
}

// Запуск как отдельный скрипт: node server/scripts/seed.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  openDatabase();
  await seedDatabase();
  closeDatabase();
}
