import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { addToCart } from '@/lib/cart';
import { db } from '@/lib/db';
import { handle, readJson, requireUser } from '@/lib/http';

const bodySchema = z.object({ productId: z.string().min(1), quantity: z.unknown() });

export function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = bodySchema.parse(await readJson(request));
    await addToCart(db(), user.id, body.productId, body.quantity);
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
