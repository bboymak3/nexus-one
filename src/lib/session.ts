import { SignJWT, jwtVerify } from 'jose';
import { getRequestContext } from '@cloudflare/next-on-pages';

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

/** true si el secreto JWT_SECRET esta configurado (sin el no se puede iniciar sesion). */
export function hasSessionSecret(): boolean {
  return !!readEnv('JWT_SECRET');
}

// Sin JWT_SECRET no hay sesiones: antes se usaba una clave fija publicada en el repo,
// con la que cualquiera podia firmar un token de super admin.
const getSecret = () => {
  const secret = readEnv('JWT_SECRET');
  if (!secret) throw new Error('JWT_SECRET no configurado. Ejecute: npx wrangler pages secret put JWT_SECRET --project-name=nexus-one');
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
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
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
