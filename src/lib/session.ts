import { SignJWT, jwtVerify } from 'jose';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Clave usada hasta ahora (estaba publicada en el repo). Se mantiene SOLO como
// respaldo para no cortar el servicio mientras se configura el secreto JWT_SECRET.
const LEGACY_SECRET = 'nexus-one-super-secret-change-in-production-2024';
let warnedLegacy = false;

/**
 * Lee una variable/secreto de Cloudflare (bindings) o de process.env.
 */
export function readEnv(name: string): string | undefined {
  try {
    const value = (getRequestContext().env as any)?.[name];
    if (typeof value === 'string' && value) return value;
  } catch {}
  return process.env[name] || undefined;
}

const getSecret = () => {
  const secret = readEnv('JWT_SECRET');
  if (secret) return new TextEncoder().encode(secret);
  if (!warnedLegacy) {
    warnedLegacy = true;
    console.warn('[session] JWT_SECRET no configurado: usando la clave anterior. Configure: npx wrangler pages secret put JWT_SECRET');
  }
  return new TextEncoder().encode(LEGACY_SECRET);
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

/**
 * Token de acceso de un solo uso practico (5 minutos) para entrar al POS
 * (MyeCommerce /api/nexus-sso). Firmado con NEXUS_SSO_SECRET, que comparten
 * ambos proyectos y es distinto del secreto de sesion de cada uno.
 */
export async function createPosSsoToken(payload: {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
}): Promise<string> {
  const secret = readEnv('NEXUS_SSO_SECRET');
  if (!secret) throw new Error('NEXUS_SSO_SECRET no configurado. Ejecute: npx wrangler pages secret put NEXUS_SSO_SECRET');
  return new SignJWT({ ...payload, purpose: 'pos_sso' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('nexus-one')
    .setAudience('myecommerce-pos')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

export function getSessionFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
