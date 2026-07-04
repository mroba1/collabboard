import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UnauthorizedError } from '../utils/errors.js';
import { isProduction } from '../config/env.js';
import type { AuthResponse } from '@collabboard/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const REFRESH_COOKIE = 'collabboard_refresh';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
};

function sendSession(res: Response, result: authService.AuthResult): void {
  res.cookie(REFRESH_COOKIE, result.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  const body: AuthResponse = {
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  };
  res.json(body);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  const result = await authService.register(name, email, password);
  sendSession(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await authService.login(email, password);
  sendSession(res, result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
  if (!token) {
    throw new UnauthorizedError('No refresh token provided');
  }
  const result = await authService.refresh(token);
  sendSession(res, result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
  if (token) {
    await authService.logout(token);
  }
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const user = await authService.getUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }
  res.json({ user });
});
