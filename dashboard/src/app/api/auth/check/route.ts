import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ authenticated: false });

  const payload = await verifySession(token);
  if (!payload) return NextResponse.json({ authenticated: false });

  return NextResponse.json({ authenticated: true, user: { username: payload.username } });
}
