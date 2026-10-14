import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { createSessionToken, verifySessionToken, readEnv } from '@/lib/session';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody } from '@/lib/response';
import { getTenantSession } from '@/lib/guards';
import { isExpired, formatDate } from '@/lib/subscription';

export const runtime = 'edge';

// Helper to get D1 from request context
function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

// POST /api/auth - Super Admin Login
export async function POST(req: NextRequest) {
  const db = getDB();
  if (!db) return errorResponse('Database not available');

  try {
    const body = await parseBody<{ username: string; password: string; action: string }>(req);
    const { username, password, action } = body;

    if (!username || !password) {
      return errorResponse('Usuario y clave son requeridos');
    }

    // ===== SUPER ADMIN LOGIN =====
    if (action === 'admin_login' || !action) {
      const admins = await db.prepare('SELECT * FROM nx_super_admins WHERE username = ? AND is_active = 1').bind(username).all();
      const admin = admins.results?.[0] as any;
      if (!admin) return errorResponse('Credenciales invalidas');

      // Primera configuracion: la semilla trae una clave marcador (no utilizable).
      // La clave inicial se toma del secreto SUPERADMIN_INITIAL_PASSWORD; ya no
      // existe una clave por defecto conocida (antes: admin123).
      let storedPassword = admin.password;
      if (storedPassword.includes('fixedsalt')) {
        const initialPassword = readEnv('SUPERADMIN_INITIAL_PASSWORD');
        if (!initialPassword || initialPassword.length < 8) {
          return errorResponse('Super admin sin clave inicial. Configure el secreto SUPERADMIN_INITIAL_PASSWORD (min 8 caracteres).', 503);
        }
        storedPassword = await hashPassword(initialPassword);
        await db.prepare('UPDATE nx_super_admins SET password = ? WHERE id = ?').bind(storedPassword, admin.id).run();
      }

      const valid = await verifyPassword(password, storedPassword);
      if (!valid) return errorResponse('Credenciales invalidas');

      await db.prepare('UPDATE nx_super_admins SET last_login = datetime(\'now\') WHERE id = ?').bind(admin.id).run();

      const token = await createSessionToken({
        userId: admin.id,
        userType: 'super_admin',
        username: admin.username,
        role: 'super_admin',
      });

      return jsonResponse({
        token,
        user: { id: admin.id, username: admin.username, fullName: admin.full_name, email: admin.email },
        userType: 'super_admin',
      });
    }

    // ===== TENANT USER LOGIN =====
    if (action === 'tenant_login') {
      const { tenantSlug } = body as any;
      let tenant: any = null;
      let user: any = null;

      if (tenantSlug) {
        // Se sabe el negocio (vino en la URL /<slug>, o se escribio a mano)
        tenant = await db.prepare('SELECT * FROM nx_tenants WHERE slug = ?').bind(tenantSlug).first();
        if (!tenant) return errorResponse('Negocio no encontrado');
        const users = await db.prepare(
          'SELECT * FROM nx_tenant_users WHERE tenant_id = ? AND username = ? AND is_active = 1'
        ).bind(tenant.id, username).all();
        user = users.results?.[0] || null;
        if (user && !(await verifyPassword(password, user.password))) user = null;
      } else {
        // No se pidio el negocio: se busca el usuario en todos los negocios
        // (evita tener que escribir la URL del negocio para iniciar sesion).
        const candidates = await db.prepare(
          'SELECT * FROM nx_tenant_users WHERE username = ? AND is_active = 1'
        ).bind(username).all();
        for (const row of (candidates.results || []) as any[]) {
          if (await verifyPassword(password, row.password)) {
            user = row;
            tenant = await db.prepare('SELECT * FROM nx_tenants WHERE id = ?').bind(row.tenant_id).first();
            break;
          }
        }
      }

      if (!user || !tenant) return errorResponse('Credenciales invalidas');
      // El negocio suspendido o vencido SI puede entrar a su panel (para ver el aviso y
      // renovar); solo se le bloquea abrir el punto de venta (ver /api/sso).

      await db.prepare('UPDATE nx_tenant_users SET last_login = datetime(\'now\') WHERE id = ?').bind(user.id).run();

      const token = await createSessionToken({
        userId: user.id,
        userType: 'tenant',
        tenantSlug: tenant.slug,
        tenantId: tenant.id,
        username: user.username,
        role: user.role,
      });

      const expired = isExpired(tenant.subscription_expires_at);
      const active = tenant.status === 'active' && !expired;
      const reason = tenant.status !== 'active'
        ? 'Este negocio esta suspendido. Contacte al administrador.'
        : expired
          ? `La suscripcion de este negocio vencio el ${formatDate(tenant.subscription_expires_at)}.`
          : '';

      return jsonResponse({
        token,
        user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
        tenant: {
          id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status,
          plan: tenant.plan, subscriptionExpiresAt: tenant.subscription_expires_at,
          active, reason,
        },
        userType: 'tenant',
      });
    }

    // ===== CREATE TENANT USER (solo super admin) =====
    if (action === 'create_tenant_user') {
      const tokenStr = req.headers.get('authorization')?.replace('Bearer ', '');
      const session = tokenStr ? await verifySessionToken(tokenStr) : null;
      if (!session || session.userType !== 'super_admin') return unauthorizedResponse();

      const { tenantId, fullName, role } = body as any;
      if (!tenantId) return errorResponse('tenantId requerido');
      const tenantExists = await db.prepare('SELECT id FROM nx_tenants WHERE id = ?').bind(tenantId).first();
      if (!tenantExists) return errorResponse('Negocio no encontrado');
      if (password.length < 4) return errorResponse('La clave debe tener al menos 4 caracteres');
      if (role && !['admin', 'vendedor', 'cajero'].includes(role)) return errorResponse('Rol invalido');

      // Check if user already exists for this tenant
      const existing = await db.prepare(
        'SELECT id FROM nx_tenant_users WHERE tenant_id = ? AND username = ?'
      ).bind(tenantId, username).all();
      if (existing.results?.length) return errorResponse('El usuario ya existe en este negocio');

      const hashedPw = await hashPassword(password);
      const id = 'tu-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      await db.prepare(
        'INSERT INTO nx_tenant_users (id, tenant_id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, tenantId, username, hashedPw, fullName || username, role || 'admin').run();

      return jsonResponse({ success: true, userId: id });
    }

    // ===== CHANGE SUPER ADMIN PASSWORD =====
    if (action === 'change_admin_password') {
      const tokenStr = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!tokenStr) return unauthorizedResponse();
      const payload = await verifySessionToken(tokenStr);
      if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

      const { newPassword } = body as any;
      if (!newPassword || newPassword.length < 6) return errorResponse('La clave debe tener al menos 6 caracteres');

      const hashed = await hashPassword(newPassword);
      await db.prepare('UPDATE nx_super_admins SET password = ? WHERE id = ?').bind(hashed, payload.userId).run();
      return jsonResponse({ success: true, message: 'Clave actualizada' });
    }

    return errorResponse('Accion no valida', 400);
  } catch (error: any) {
    return errorResponse(error.message || 'Error del servidor', 500);
  }
}

// GET /api/auth - Verify token
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();

  const payload = await verifySessionToken(token);
  if (!payload) return unauthorizedResponse();

  const db = getDB();
  if (db && payload.userType === 'super_admin') {
    const admins = await db.prepare('SELECT id, username, full_name, email FROM nx_super_admins WHERE id = ? AND is_active = 1').bind(payload.userId).all();
    const admin = admins.results?.[0] as any;
    if (admin) {
      return jsonResponse({ valid: true, user: { id: admin.id, username: admin.username, fullName: admin.full_name, email: admin.email }, userType: 'super_admin' });
    }
  }

  if (db && payload.userType === 'tenant') {
    // Un usuario desactivado pierde el acceso aunque su token no haya vencido. El negocio
    // suspendido o vencido SI puede ver su panel (para el aviso de licencia); solo se le
    // bloquea abrir el punto de venta (ver /api/sso, que usa getActiveTenantSession).
    const session = await getTenantSession(db, payload);
    if (session) {
      const { user, tenant } = session;
      const expired = isExpired(tenant.subscription_expires_at);
      const active = tenant.status === 'active' && !expired;
      const reason = tenant.status !== 'active'
        ? 'Este negocio esta suspendido. Contacte al administrador.'
        : expired
          ? `La suscripcion de este negocio vencio el ${formatDate(tenant.subscription_expires_at)}.`
          : '';
      return jsonResponse({
        valid: true,
        user: { id: user.id, username: user.username, full_name: user.full_name, fullName: user.full_name, role: user.role },
        tenant: {
          id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status,
          plan: tenant.plan, subscriptionExpiresAt: tenant.subscription_expires_at,
          active, reason,
        },
        userType: 'tenant',
      });
    }
  }

  return unauthorizedResponse();
}