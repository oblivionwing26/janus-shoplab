import { z } from 'zod';

import type { PrismaClient } from '@/generated/prisma/client';

import { computeTotals, type Totals } from './pricing';
import { ShopError } from './shop-error';

export const MAX_QUANTITY = 10;

export const quantitySchema = z.coerce.number().int().min(1).max(MAX_QUANTITY);
export const couponCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((code) => code.toUpperCase());

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  stock: number;
}

export interface CartView {
  lines: CartLine[];
  coupon: { code: string; percentOff: number } | null;
  totals: Totals;
}

export async function getCart(prisma: PrismaClient, userId: string): Promise<CartView> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { coupon: true, items: { include: { product: true } } },
  });
  const lines: CartLine[] = (cart?.items ?? [])
    .map((item) => ({
      productId: item.productId,
      slug: item.product.slug,
      name: item.product.name,
      unitPriceCents: item.product.priceCents,
      quantity: item.quantity,
      stock: item.product.stock,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const coupon =
    cart?.coupon && cart.coupon.active
      ? { code: cart.coupon.code, percentOff: cart.coupon.percentOff }
      : null;
  return { lines, coupon, totals: computeTotals(lines, coupon?.percentOff ?? null) };
}

async function ensureCart(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function addToCart(
  prisma: PrismaClient,
  userId: string,
  productId: string,
  rawQuantity: unknown,
): Promise<void> {
  const quantity = quantitySchema.safeParse(rawQuantity);
  if (!quantity.success) throw new ShopError('invalid_input', 'Cantidad no válida.');
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (product === null) throw new ShopError('not_found', 'Ese producto no existe.');
  await ensureCart(prisma, userId);
  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  const next = Math.min((existing?.quantity ?? 0) + quantity.data, MAX_QUANTITY);
  if (next > product.stock) throw new ShopError('out_of_stock', 'No hay stock suficiente.');
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity: next },
    update: { quantity: next },
  });
}

export async function setCartQuantity(
  prisma: PrismaClient,
  userId: string,
  productId: string,
  rawQuantity: unknown,
): Promise<void> {
  const quantity = quantitySchema.safeParse(rawQuantity);
  if (!quantity.success) throw new ShopError('invalid_input', 'Cantidad no válida.');
  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    include: { product: true },
  });
  if (item === null) throw new ShopError('not_found', 'Ese producto no está en tu carrito.');
  if (quantity.data > item.product.stock) {
    throw new ShopError('out_of_stock', 'No hay stock suficiente.');
  }
  await prisma.cartItem.update({
    where: { userId_productId: { userId, productId } },
    data: { quantity: quantity.data },
  });
}

export async function removeFromCart(
  prisma: PrismaClient,
  userId: string,
  productId: string,
): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { userId, productId } });
}

export async function applyCoupon(
  prisma: PrismaClient,
  userId: string,
  rawCode: unknown,
): Promise<void> {
  const code = couponCodeSchema.safeParse(rawCode);
  if (!code.success) throw new ShopError('coupon_invalid', 'Ese cupón no es válido.');
  const coupon = await prisma.coupon.findUnique({ where: { code: code.data } });
  if (coupon === null || !coupon.active) {
    throw new ShopError('coupon_invalid', 'Ese cupón no es válido.');
  }
  const used = await prisma.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });
  if (used !== null) throw new ShopError('coupon_used', 'Ya has usado ese cupón.');
  await ensureCart(prisma, userId);
  await prisma.cart.update({ where: { userId }, data: { couponId: coupon.id } });
}

export async function removeCoupon(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.cart.updateMany({ where: { userId }, data: { couponId: null } });
}
