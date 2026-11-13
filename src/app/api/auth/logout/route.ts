import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { clearSessionCookie, handle } from '@/lib/http';
import { deleteSession, SESSION_COOKIE } from '@/lib/sessions';

export function POST(request: NextRequest) {
  return handle(request, async () => {
    await deleteSession(db(), request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
