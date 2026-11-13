import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { handle, readJson, requireUser } from '@/lib/http';
import { addReview } from '@/lib/reviews';

interface Context {
  params: Promise<{ slug: string }>;
}

export function POST(request: NextRequest, { params }: Context) {
  return handle(request, async () => {
    const user = await requireUser(request);
    const { slug } = await params;
    await addReview(db(), user.id, slug, await readJson(request));
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
