import { Router } from 'express';

import {
  authenticateUser,
  issueSessionToken,
  registerUser,
} from '../services/auth.service.js';
import { clearAuthCookie, currentUser, setAuthCookie } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';

/**
 * СЛОЙ МАРШУТИРОВАЦИЯ: аутентификация.
 *
 * Здесь только соответствие между URL и действием. Все правила про
 * корректность e-mail, пароля и занятость учётной записи живут в слое
 * бизнес-логики.
 */

export const authRouter = Router();

// POST /api/auth/register — регистрация нового пользователя.
authRouter.post('/register', async (req, res) => {
  const user = await registerUser(req.body ?? {});

  setAuthCookie(res, issueSessionToken(user));

  res.status(201).json({ user });
});

// POST /api/auth/login — вход по e-mail и паролю.
authRouter.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body ?? {});

  setAuthCookie(res, issueSessionToken(user));

  res.json({ user });
});

// POST /api/auth/logout — выход из аккаунта.
authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);

  res.status(204).end();
});

// GET /api/auth/me — текущий пользователь. Гостю возвращается user: null.
authRouter.get('/me', async (req, res) => {
  const user = await currentUser(req);

  res.json({ user });
});
