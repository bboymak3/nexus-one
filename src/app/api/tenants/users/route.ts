import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody } from '@/lib/response';

export const runtime = 'edge';

function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

// GET /api/tenants/users?tenantId=xxx - List users for a tenant
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);
  if (!payload) return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId') || payload.tenantId;

  if (payload.userType !== 'super_admin' && payload.tenantId !== tenantId) {
    return unauthorizedResponse();
  }

  if (!tenantId) return errorResponse('tenantId es requerido');

  const users = await db.prepare(
    'SELECT id, tenant_id, username, full_name, role, is_active, last_login, created_at FROM tenant_users WHERE tenant_id = ? ORDER BY created_at'
  ).bind(tenantId).all();

  return jsonResponse({ users: users.results || [] });
}

// POST /api/tenants/users - Create user for tenant
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);
  if (!payload) return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  try {
    const body = await parseBody<{
      tenantId: string;
      username: string;
      password: string;
      fullName: string;
      role: string;
    }>(req);

    const { tenantId, username, password, fullName, role } = body;

    if (!tenantId || !username || !password) {
      return errorResponse('tenantId, username y password son requeridos');
    }
    if (password.length < 4) return errorResponse('La clave debe tener al menos 4 caracteres');

    const tenant = await db.prepare('SELECT id FROM tenants WHERE id = ?').bind(tenantId).first();
    if (!tenant) return errorResponse('Negocio no encontrado');

    const existing = await db.prepare(
      'SELECT id FROM tenant_users WHERE tenant_id = ? AND username = ?'
    ).bind(tenantId, username).first();
    if (existing) return errorResponse('El usuario ya existe en este negocio');

    const count = await db.prepare('SELECT COUNT(*) as c FROM tenant_users WHERE tenant_id = ?').bind(tenantId).first() as any;
    const maxUsers = await db.prepare('SELECT max_users FROM tenants WHERE id = ?').bind(tenantId).first() as any;
    if (count.c >= maxUsers.max_users && payload.userType !== 'super_admin') {
      return errorResponse(`Limite de usuarios alcanzado (${maxUsers.max_users})`);
    }

    const hashedPw = await hashPassword(password);
    const id = 'tu-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await db.prepare(
      'INSERT INTO tenant_users (id, tenant_id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, username, hashedPw, fullName || username, role || 'cajero').run();

    return jsonResponse({
      success: true,
      user: { id, username, fullName: fullName || username, role: role || 'cajero' },
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Error al crear usuario', 500);
  }
}

// DELETE /api/tenants/users - Delete user
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const { id } = await parseBody<{ id: string }>(req);
  if (!id) return errorResponse('ID del usuario es requerido');

  await db.prepare('DELETE FROM tenant_users WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true, message: 'Usuario eliminado' });
}