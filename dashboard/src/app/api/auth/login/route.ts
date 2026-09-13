import { NextResponse } from 'next/server';
import { validateCredentials, createSession, COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'ユーザー名とパスワードを入力してください' }, { status: 400 });
    }

    const payload = await validateCredentials(username, password);
    if (!payload) {
      return NextResponse.json({ error: 'ユーザー名またはパスワードが正しくありません' }, { status: 401 });
    }

    const token = await createSession(payload);
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'ログイン処理中にエラーが発生しました' }, { status: 500 });
  }
}
