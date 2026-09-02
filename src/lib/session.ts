import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.JWT_SECRET || 'nexus-one-fallback-secret';
  return new TextEncoder().encode(secret);
};

export async function createSessionToken(payload: {
  userId: string;
  userType: 'super_admin' | 'tenant';
  tenantSlug?: string;
  tenantId?: string;
  username: string;
  role?: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as {
      userId: string;
      userType: 'super_admin' | 'tenant';
      tenantSlug?: string;
      tenantId?: string;
      username: string;
      role?: string;
      iat?: number;
      exp?: number;
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
