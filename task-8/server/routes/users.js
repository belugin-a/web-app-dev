import { Router } from 'express';

import { requireAuth, requireSelf } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import { User } from '../models/User.js';
import { removeAvatar } from '../storage.js';
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

function assertIdParam(req, res, next) {
  try {
    assertUuid(req.params.id);
    next();
  } catch (err) {
    next(err);
  }
}

/** Публичное представление чужого профиля: без e-mail и служебных полей. */
function publicProfile(user) {
  return {
    _id: user._id,
    name: user.name,
    about: user.about,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
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

// GET /api/users — список профилей. Открыт всем, поэтому без e-mail.
usersRouter.get('/', async (req, res) => {
  const users = await User.find()
    .select('name about avatar createdAt')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ users });
});

// GET /api/users/me — свой профиль целиком. Объявлен до /:id,
// иначе Express примет «me» за UUID.
usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/users/:id — профиль по UUID. Только для вошедших:
// свой — целиком, чужой — без e-mail.
usersRouter.get('/:id', requireAuth, async (req, res) => {
  assertUuid(req.params.id);

  const user = await User.findById(req.params.id);
  if (!user) {
    throw notFound('Профиль не найден');
  }

  const isSelf = req.user._id === user._id;
  res.json({ user: isSelf ? user : publicProfile(user) });
});

// PATCH /api/users/:id — обновление только своего профиля.
usersRouter.patch('/:id', requireAuth, assertIdParam, requireSelf(), async (req, res) => {
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

// DELETE /api/users/:id — удаление только своего профиля.
usersRouter.delete('/:id', requireAuth, assertIdParam, requireSelf(), async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw notFound('Профиль не найден');
  }

  await removeAvatar(user.avatar);
  res.status(204).end();
});

// POST /api/users/:id/avatar — загрузка аватара только в свой профиль.
usersRouter.post(
  '/:id/avatar',
  requireAuth,
  assertIdParam,
  requireSelf(),
  uploadAvatar,
  async (req, res) => {
    if (!req.file) {
      throw badRequest('Файл не передан в поле avatar');
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      await removeAvatar(req.file.filename);
      throw notFound('Профиль не найден');
    }

    const previousAvatar = user.avatar;
    user.avatar = req.file.filename;
    await user.save();
    await removeAvatar(previousAvatar);

    res.json({ user });
  },
);
