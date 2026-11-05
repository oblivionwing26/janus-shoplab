import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { handle, readJson, setSessionCookie } from '@/lib/http';
import { createSession } from '@/lib/sessions';
import { authenticate } from '@/lib/users';

export function POST(request: NextRequest) {
  return handle(async () => {
    const user = await authenticate(db(), await readJson(request));
    const response = NextResponse.json({ user });
    setSessionCookie(response, await createSession(db(), user.id));
    return response;
  });
}
