import { Router } from 'express';

import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  changeStatus,
  deleteTicket,
  getStats,
  getMeta,
} from '../services/tickets.service.js';
import { badRequest } from '../utils/errors.js';

/**
 * СЛОЙ МАРШРУТИЗАЦИИ.
 *
 * Здесь только две вещи: какой URL какому действию соответствует
 * и в каком виде ответ уходит клиенту. Все правила живут в слое
 * бизнес-логики, все запросы к базе — в слое доступа к данным.
 *
 * Обработчики ничего не решают самостоятельно: получают данные запроса,
 * вызывают нужную функцию сервиса и отдают результат.
 */

export const apiRouter = Router();

/**
 * Приводит параметр id к числу.
 * Нечисловой идентификатор — ошибка 400, а не 404: клиент ошибся в адресе.
 */
function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest('Идентификатор заявки должен быть положительным целым числом');
  }

  return id;
}

// GET /api/health — проверка живости сервера.
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'task-9-support-tickets',
    time: new Date().toISOString(),
  });
});

// GET /api/meta — справочные значения: статусы, приоритеты, переходы, сроки.
// Клиент берёт их отсюда, чтобы не дублировать правила у себя.
apiRouter.get('/meta', (req, res) => {
  res.json(getMeta());
});

// GET /api/stats — сводка по заявкам.
apiRouter.get('/stats', async (req, res) => {
  res.json(await getStats());
});

// GET /api/tickets — список с фильтрами, поиском, сортировкой и постраничностью.
apiRouter.get('/tickets', async (req, res) => {
  const { status, priority, assignee, search, sortBy, sortOrder, limit, offset } = req.query;

  const result = await listTickets({
    status,
    priority,
    assignee,
    search,
    sortBy,
    sortOrder,
    limit,
    offset,
  });

  res.json(result);
});

// GET /api/tickets/:id — одна заявка.
apiRouter.get('/tickets/:id', async (req, res) => {
  const ticket = await getTicket(parseId(req.params.id));

  res.json({ ticket });
});

// POST /api/tickets — создание новой заявки.
apiRouter.post('/tickets', async (req, res) => {
  const ticket = await createTicket(req.body ?? {});

  res.status(201).json({ ticket });
});

// PATCH /api/tickets/:id — изменение полей заявки (кроме статуса).
apiRouter.patch('/tickets/:id', async (req, res) => {
  const ticket = await updateTicket(parseId(req.params.id), req.body ?? {});

  res.json({ ticket });
});

// POST /api/tickets/:id/status — смена статуса с проверкой перехода.
apiRouter.post('/tickets/:id/status', async (req, res) => {
  const ticket = await changeStatus(parseId(req.params.id), req.body ?? {});

  res.json({ ticket });
});

// DELETE /api/tickets/:id — удаление заявки (только из статуса «новая»).
apiRouter.delete('/tickets/:id', async (req, res) => {
  const result = await deleteTicket(parseId(req.params.id));

  res.json(result);
});
