import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken } from '@/lib/session';
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

export const runtime = 'edge';

function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

// GET /api/tenants/[id] - Get single tenant with users
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const { id } = await params;
  const tenant = await db.prepare('SELECT * FROM nx_tenants WHERE id = ?').bind(id).first() as any;
  if (!tenant) return errorResponse('Negocio no encontrado', 404);

  const users = await db.prepare(
    'SELECT id, username, full_name, role, is_active, last_login, created_at FROM nx_tenant_users WHERE tenant_id = ? ORDER BY created_at'
  ).bind(id).all();

  const logs = await db.prepare(
    'SELECT * FROM nx_activity_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(id).all();

  return jsonResponse({ tenant, users: users.results || [], logs: logs.results || [] });
}