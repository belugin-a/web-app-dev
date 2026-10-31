import { Router } from 'express';

import { getProfile, updateProfile } from '../services/users.service.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * СЛОЙ МАРШУТИРОВАЦИЯ: профиль пользователя.
 *
 * Маршруты доступны только вошедшим: гостю возвращается 401.
 */

export const usersRouter = Router();

// GET /api/users/me — профиль текущего пользователя.
usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await getProfile(req.user.id);

  res.json({ user });
});

// PATCH /api/users/me — изменение профиля.
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const user = await updateProfile(req.user.id, req.body ?? {});

  res.json({ user });
});
