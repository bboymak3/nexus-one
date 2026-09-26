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
