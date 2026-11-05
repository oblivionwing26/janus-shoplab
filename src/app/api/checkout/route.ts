import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { handle, readJson, requireUser } from '@/lib/http';
import { placeOrder } from '@/lib/orders';

export function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser(request);
    const { orderId } = await placeOrder(db(), user.id, await readJson(request));
    return NextResponse.json({ orderId }, { status: 201 });
  });
}
