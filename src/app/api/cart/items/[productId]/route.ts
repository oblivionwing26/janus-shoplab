import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { removeFromCart, setCartQuantity } from '@/lib/cart';
import { db } from '@/lib/db';
import { handle, readJson, requireUser } from '@/lib/http';

interface Context {
  params: Promise<{ productId: string }>;
}

const bodySchema = z.object({ quantity: z.unknown() });

export function PATCH(request: NextRequest, { params }: Context) {
  return handle(async () => {
    const user = await requireUser(request);
    const { productId } = await params;
    const body = bodySchema.parse(await readJson(request));
    await setCartQuantity(db(), user.id, productId, body.quantity);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(request: NextRequest, { params }: Context) {
  return handle(async () => {
    const user = await requireUser(request);
    const { productId } = await params;
    await removeFromCart(db(), user.id, productId);
    return NextResponse.json({ ok: true });
  });
}
