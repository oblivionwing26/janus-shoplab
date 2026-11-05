import { z } from 'zod';

import type { PrismaClient } from '@/generated/prisma/client';

import { ShopError } from './shop-error';

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
});

export async function addReview(
  prisma: PrismaClient,
  userId: string,
  slug: string,
  input: unknown,
): Promise<void> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw new ShopError('invalid_input', 'La reseña necesita nota y texto.');
  const product = await prisma.product.findUnique({ where: { slug } });
  if (product === null) throw new ShopError('not_found', 'Ese producto no existe.');
  await prisma.review.create({ data: { productId: product.id, userId, ...parsed.data } });
}
