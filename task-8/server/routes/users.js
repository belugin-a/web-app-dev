import { Router } from 'express';

import { User } from '../models/User.js';
import { badRequest, notFound } from '../utils/errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Поля, которые разрешено менять через PATCH.
// passwordHash, _id, avatar и timestamps сюда намеренно не входят.
const EDITABLE_FIELDS = ['name', 'email', 'about'];

function assertUuid(id) {
  if (!UUID_RE.test(id)) {
    throw badRequest('Идентификатор профиля должен быть UUID');
  }
}

/** Собирает патч только из разрешённых полей. */
function pickEditableFields(body) {
  const patch = {};

  for (const field of EDITABLE_FIELDS) {
    if (Object.hasOwn(body, field)) {
      patch[field] = body[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    throw badRequest(`Нет полей для обновления: ${EDITABLE_FIELDS.join(', ')}`);
  }

  return patch;
}

export const usersRouter = Router();

// GET /api/users — список профилей для навигации.
usersRouter.get('/', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  res.json({ users });
});

// GET /api/users/:id — профиль по UUID.
usersRouter.get('/:id', async (req, res) => {
  assertUuid(req.params.id);

  const user = await User.findById(req.params.id);
  if (!user) {
    throw notFound('Профиль не найден');
  }

  res.json({ user });
});

// PATCH /api/users/:id — обновление профиля.
usersRouter.patch('/:id', async (req, res) => {
  assertUuid(req.params.id);

  const patch = pickEditableFields(req.body ?? {});

  const user = await User.findByIdAndUpdate(req.params.id, patch, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!user) {
    throw notFound('Профиль не найден');
  }

  res.json({ user });
});

// DELETE /api/users/:id — удаление профиля.
usersRouter.delete('/:id', async (req, res) => {
  assertUuid(req.params.id);

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw notFound('Профиль не найден');
  }

  res.status(204).end();
});
