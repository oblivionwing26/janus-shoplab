import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { applyCoupon, removeCoupon } from '@/lib/cart';
import { db } from '@/lib/db';
import { handle, readJson, requireUser } from '@/lib/http';

const bodySchema = z.object({ code: z.unknown() });

export function POST(request: NextRequest) {
  return handle(request, async () => {
    const user = await requireUser(request);
    const body = bodySchema.parse(await readJson(request));
    await applyCoupon(db(), user.id, body.code);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(request: NextRequest) {
  return handle(request, async () => {
    const user = await requireUser(request);
    await removeCoupon(db(), user.id);
    return NextResponse.json({ ok: true });
  });
}
