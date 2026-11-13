import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { assertStepUp } from '@/lib/defenses';
import { handle, readJson, requireUser } from '@/lib/http';
import { placeOrder } from '@/lib/orders';

export function POST(request: NextRequest) {
  return handle(request, async () => {
    const user = await requireUser(request);
    const body = await readJson(request);
    const account = await db().user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    assertStepUp({ id: user.id, createdAt: account?.createdAt ?? new Date(0) }, body);
    const { orderId } = await placeOrder(db(), user.id, body);
    return NextResponse.json({ orderId }, { status: 201 });
  });
}
