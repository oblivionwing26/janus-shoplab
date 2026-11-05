import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { handle, requireUser } from '@/lib/http';
import { findOrderForUser } from '@/lib/orders';
import { ShopError } from '@/lib/shop-error';

interface Context {
  params: Promise<{ id: string }>;
}

export function GET(request: NextRequest, { params }: Context) {
  return handle(async () => {
    const user = await requireUser(request);
    const id = Number((await params).id);
    const order = Number.isInteger(id) ? await findOrderForUser(db(), user.id, id) : null;
    if (order === null) throw new ShopError('not_found', 'Ese pedido no existe.');
    return NextResponse.json({ order });
  });
}
