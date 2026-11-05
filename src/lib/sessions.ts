import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient } from '@/generated/prisma/client';

import type { PublicUser } from './users';

export const SESSION_COOKIE = 'shoplab_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(prisma: PrismaClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export async function findSessionUser(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<PublicUser | null> {
  if (token === undefined || token === '') return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (session === null || session.expiresAt.getTime() <= Date.now()) return null;
  const { id, email, name, address } = session.user;
  return { id, email, name, address };
}

export async function deleteSession(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<void> {
  if (token === undefined || token === '') return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
