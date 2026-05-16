import { db } from '../../lib/db.js';
import { getEnv } from '../../lib/env.js';
import {
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
} from '../../lib/auth.js';

export async function createUser(input: {
  email: string;
  username?: string | undefined;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      email: input.email,
      ...(input.username ? { username: input.username } : {}),
      passwordHash,
    },
    select: { id: true, email: true, username: true },
  });

  const tokens = await issueSession(user.id as string);
  return { user, tokens };
}

export async function loginUser(input: { account: string; password: string }) {
  const user = await db.user.findFirst({
    where: {
      OR: [{ email: input.account }, { username: input.account }],
    },
    select: { id: true, email: true, username: true, passwordHash: true },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash as string))) {
    throw new Error('Invalid credentials');
  }

  const { passwordHash: _passwordHash, ...safeUser } = user as Record<string, unknown> & { passwordHash: string };
  const tokens = await issueSession(user.id as string);
  return { user: safeUser, tokens };
}

async function issueSession(userId: string) {
  const env = getEnv();
  const accessToken = await signAccessToken(userId, env.JWT_ACCESS_SECRET);
  const refreshToken = await signRefreshToken(userId, env.JWT_REFRESH_SECRET);
  await db.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: addDays(new Date(), 30),
    },
  });
  return { accessToken, refreshToken };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
