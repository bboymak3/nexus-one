/**
 * Devuelve el usuario y el negocio de una sesion de tenant solo si ambos siguen activos
 * y el usuario pertenece a ese negocio. Se consulta en cada peticion, por lo que
 * suspender un negocio o desactivar un usuario corta el acceso de inmediato.
 */
export async function getActiveTenantSession(
  db: any,
  payload: { userType: string; userId: string; tenantId?: string } | null
): Promise<{ user: any; tenant: any } | null> {
  if (!payload || payload.userType !== 'tenant' || !payload.tenantId) return null;
  const user = await db.prepare(
    'SELECT id, tenant_id, username, full_name, role FROM tenant_users WHERE id = ? AND tenant_id = ? AND is_active = 1'
  ).bind(payload.userId, payload.tenantId).first();
  if (!user) return null;
  const tenant = await db.prepare(
    "SELECT id, name, slug, status, plan, pos_url FROM tenants WHERE id = ? AND status = 'active'"
  ).bind(payload.tenantId).first();
  if (!tenant) return null;
  return { user, tenant };
}
