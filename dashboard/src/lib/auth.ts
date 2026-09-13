import * as jose from 'jose';

export const COOKIE_NAME = 'doumori_dashboard_session';

function getSecret() {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
  return new TextEncoder().encode(secret);
}

export async function validateCredentials(username: string, password: string) {
  const validUser = process.env.DASHBOARD_USERNAME;
  const validPass = process.env.DASHBOARD_PASSWORD;

  if (!validUser || !validPass) return null;
  if (username !== validUser || password !== validPass) return null;

  return { username };
}

export async function createSession(payload: { username: string }) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    return payload as { username: string };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30日
