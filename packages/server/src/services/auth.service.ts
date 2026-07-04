import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { generateRefreshToken, hashRefreshToken, getRefreshTokenExpiry } from '../utils/refreshToken.js';
import { pickColor } from '../utils/colors.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import type { AuthUser } from '@collabboard/shared';

function toAuthUser(user: { id: string; name: string; email: string; color: string; createdAt: Date }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    color: user.color,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      color: pickColor(email.toLowerCase()),
    },
  });

  return issueSession(user.id, user.email, user.name, user.color, user.createdAt);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }
  return issueSession(user.id, user.email, user.name, user.color, user.createdAt);
}

async function issueSession(
  userId: string,
  email: string,
  name: string,
  color: string,
  createdAt: Date
): Promise<AuthResult> {
  const { token: accessToken, expiresIn } = signAccessToken({ sub: userId, email });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    user: toAuthUser({ id: userId, name, email, color, createdAt }),
    accessToken,
    expiresIn,
    refreshToken,
  };
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  return issueSession(stored.user.id, stored.user.email, stored.user.name, stored.user.color, stored.user.createdAt);
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toAuthUser(user) : null;
}
