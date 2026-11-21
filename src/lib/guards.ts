import { isExpired } from './subscription';

/**
 * Devuelve el usuario y el negocio de una sesion de tenant, activo o no. Solo exige
 * que el usuario siga activo y pertenezca a ese negocio; el negocio suspendido o con
 * la suscripcion vencida SI se devuelve (para que el panel lo muestre), pero queda
 * marcado. Usar para lo que el usuario puede ver (su propio panel).
 */
export async function getTenantSession(
  db: any,
  payload: { userType: string; userId: string; tenantId?: string } | null
): Promise<{ user: any; tenant: any } | null> {
  if (!payload || payload.userType !== 'tenant' || !payload.tenantId) return null;
  const user = await db.prepare(
    'SELECT id, tenant_id, username, full_name, role FROM nx_tenant_users WHERE id = ? AND tenant_id = ? AND is_active = 1'
  ).bind(payload.userId, payload.tenantId).first();
  if (!user) return null;
  const tenant = await db.prepare(
    'SELECT id, name, slug, status, plan, pos_url, subscription_expires_at FROM nx_tenants WHERE id = ?'
  ).bind(payload.tenantId).first();
  if (!tenant) return null;
  return { user, tenant };
}

/**
 * Igual que getTenantSession, pero solo devuelve algo si el negocio esta activo
 * (status = 'active' y la suscripcion no vencio). Usar para lo que el usuario puede
 * HACER (p. ej. entrar al punto de venta): suspender un negocio o que venza su
 * suscripcion corta esto de inmediato aunque el token no haya vencido.
 */
export async function getActiveTenantSession(
  db: any,
  payload: { userType: string; userId: string; tenantId?: string } | null
): Promise<{ user: any; tenant: any } | null> {
  const session = await getTenantSession(db, payload);
  if (!session) return null;
  if (session.tenant.status !== 'active' || isExpired(session.tenant.subscription_expires_at)) return null;
  return session;
}

/**
 * Devuelve el super admin de la sesion solo si sigue existiendo y activo en la base.
 * Asi, desactivarlo corta su acceso de inmediato aunque su token no haya vencido.
 */
export async function getSuperAdminSession(
  db: any,
  payload: { userType: string; userId: string } | null
): Promise<{ id: string; username: string } | null> {
  if (!payload || payload.userType !== 'super_admin' || !db) return null;
  const admin = await db.prepare(
    'SELECT id, username FROM nx_super_admins WHERE id = ? AND is_active = 1'
  ).bind(payload.userId).first();
  return admin || null;
}

// ===== Limite de intentos de login (fuerza bruta) =====
// Los fallos se guardan en nx_activity_logs (action = 'login_failed'). Se bloquea por
// usuario y por IP durante la ventana, sin importar si el usuario existe.
const LOGIN_WINDOW_MINUTES = 15;
const MAX_FAILS_PER_USER = 8;
const MAX_FAILS_PER_IP = 25;

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';
}

export async function isLoginBlocked(db: any, username: string, ip: string): Promise<boolean> {
  const since = `-${LOGIN_WINDOW_MINUTES} minutes`;
  const row = await db.prepare(
    `SELECT
       SUM(CASE WHEN json_extract(details, '$.username') = ? THEN 1 ELSE 0 END) AS by_user,
       SUM(CASE WHEN ? <> '' AND ip_address = ? THEN 1 ELSE 0 END) AS by_ip
     FROM nx_activity_logs
     WHERE action = 'login_failed' AND created_at > datetime('now', ?)`
  ).bind(username.toLowerCase(), ip, ip, since).first() as any;
  return (row?.by_user || 0) >= MAX_FAILS_PER_USER || (row?.by_ip || 0) >= MAX_FAILS_PER_IP;
}

export async function recordLoginFailure(db: any, username: string, ip: string, kind: string): Promise<void> {
  try {
    await db.prepare(
      'INSERT INTO nx_activity_logs (id, user_type, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      kind, 'login_failed', JSON.stringify({ username: username.toLowerCase() }), ip
    ).run();
  } catch {}
}

export const LOGIN_BLOCKED_MESSAGE = `Demasiados intentos fallidos. Espere ${LOGIN_WINDOW_MINUTES} minutos e intente de nuevo.`;

/** Largo minimo de toda clave nueva (usuarios de negocio y super admin). */
export const MIN_PASSWORD_LENGTH = 8;
