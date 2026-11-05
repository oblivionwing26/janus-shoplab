import { z } from 'zod';

import type { PrismaClient } from '@/generated/prisma/client';

import { hashPassword, verifyPassword } from './password';
import { ShopError } from './shop-error';

export const registerSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  address: z.string().trim().min(5).max(300),
});

export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  address: string;
}

const publicFields = { id: true, email: true, name: true, address: true } as const;

export async function registerUser(prisma: PrismaClient, input: unknown): Promise<PublicUser> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new ShopError('invalid_input', 'Revisa los campos del formulario.');
  }
  const { email, name, password, address } = parsed.data;
  if ((await prisma.user.count({ where: { email } })) > 0) {
    throw new ShopError('email_taken', 'Ya existe una cuenta con ese email.');
  }
  return prisma.user.create({
    data: { email, name, address, passwordHash: await hashPassword(password) },
    select: publicFields,
  });
}

export async function authenticate(prisma: PrismaClient, input: unknown): Promise<PublicUser> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    throw new ShopError('invalid_credentials', 'Email o contraseña incorrectos.');
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user === null || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    throw new ShopError('invalid_credentials', 'Email o contraseña incorrectos.');
  }
  return { id: user.id, email: user.email, name: user.name, address: user.address };
}
