import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { createSessionToken, verifySessionToken } from '@/lib/session';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody } from '@/lib/response';

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
      const admins = await db.prepare('SELECT * FROM super_admins WHERE username = ? AND is_active = 1').bind(username).all();
      const admin = admins.results?.[0] as any;
      if (!admin) return errorResponse('Credenciales invalidas');

      // First-time setup: if password is the placeholder, set the real one
      let storedPassword = admin.password;
      if (storedPassword.includes('fixedsalt')) {
        storedPassword = await hashPassword('admin123');
        await db.prepare('UPDATE super_admins SET password = ? WHERE id = ?').bind(storedPassword, admin.id).run();
      }

      const valid = await verifyPassword(password, storedPassword);
      if (!valid) return errorResponse('Credenciales invalidas');

      await db.prepare('UPDATE super_admins SET last_login = datetime(\'now\') WHERE id = ?').bind(admin.id).run();

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
      if (!tenantSlug) return errorResponse('Slug del negocio es requerido');

      const tenants = await db.prepare('SELECT * FROM tenants WHERE slug = ? AND status = ?').bind(tenantSlug, 'active').all();
      const tenant = tenants.results?.[0] as any;
      if (!tenant) return errorResponse('Negocio no encontrado o inactivo');

      const users = await db.prepare(
        'SELECT * FROM tenant_users WHERE tenant_id = ? AND username = ? AND is_active = 1'
      ).bind(tenant.id, username).all();
      const user = users.results?.[0] as any;
      if (!user) return errorResponse('Credenciales invalidas');

      const valid = await verifyPassword(password, user.password);
      if (!valid) return errorResponse('Credenciales invalidas');

      await db.prepare('UPDATE tenant_users SET last_login = datetime(\'now\') WHERE id = ?').bind(user.id).run();

      const token = await createSessionToken({
        userId: user.id,
        userType: 'tenant',
        tenantSlug: tenant.slug,
        tenantId: tenant.id,
        username: user.username,
        role: user.role,
      });

      return jsonResponse({
        token,
        user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        userType: 'tenant',
      });
    }

    // ===== CREATE TENANT USER (first user when creating tenant) =====
    if (action === 'create_tenant_user') {
      const { tenantId, fullName, role } = body as any;
      if (!tenantId) return errorResponse('tenantId requerido');

      // Check if user already exists for this tenant
      const existing = await db.prepare(
        'SELECT id FROM tenant_users WHERE tenant_id = ? AND username = ?'
      ).bind(tenantId, username).all();
      if (existing.results?.length) return errorResponse('El usuario ya existe en este negocio');

      const hashedPw = await hashPassword(password);
      const id = 'tu-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      await db.prepare(
        'INSERT INTO tenant_users (id, tenant_id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
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
      await db.prepare('UPDATE super_admins SET password = ? WHERE id = ?').bind(hashed, payload.userId).run();
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
    const admins = await db.prepare('SELECT id, username, full_name, email FROM super_admins WHERE id = ?').bind(payload.userId).all();
    const admin = admins.results?.[0] as any;
    if (admin) {
      return jsonResponse({ valid: true, user: { id: admin.id, username: admin.username, fullName: admin.full_name, email: admin.email }, userType: 'super_admin' });
    }
  }

  if (db && payload.userType === 'tenant') {
    const users = await db.prepare('SELECT id, username, full_name, role FROM tenant_users WHERE id = ?').bind(payload.userId).all();
    const user = users.results?.[0] as any;
    const tenants = await db.prepare('SELECT id, name, slug, status FROM tenants WHERE id = ?').bind(payload.tenantId).all();
    const tenant = tenants.results?.[0] as any;
    if (user) {
      return jsonResponse({ valid: true, user, tenant, userType: 'tenant' });
    }
  }

  return unauthorizedResponse();
}