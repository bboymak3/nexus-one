import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody, slugify } from '@/lib/response';

export const runtime = 'edge';

function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifySessionToken(token);
}

// GET /api/tenants - List all tenants
export async function GET(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'all';
  const search = url.searchParams.get('search') || '';

  let query = 'SELECT t.*, (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as user_count FROM tenants t';
  const params: any[] = [];

  if (status !== 'all') {
    query += ' WHERE t.status = ?';
    params.push(status);
  }
  if (search) {
    query += (params.length ? ' AND' : ' WHERE') + ' (t.name LIKE ? OR t.slug LIKE ? OR t.owner_email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY t.created_at DESC';

  const result = await (params.length
    ? db.prepare(query).bind(...params).all()
    : db.prepare(query).all()
  );

  const stats = await db.prepare(
    'SELECT COUNT(*) as total, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = \'suspended\' THEN 1 ELSE 0 END) as suspended FROM tenants'
  ).first();

  return jsonResponse({ tenants: result.results || [], stats });
}

// POST /api/tenants - Create tenant
export async function POST(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  try {
    const body = await parseBody<{
      name: string;
      slug?: string;
      description?: string;
      ownerName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
      ownerPassword?: string;
      plan?: string;
      maxUsers?: number;
      maxProducts?: number;
    }>(req);

    const { name, description, ownerName, ownerEmail, ownerPhone, ownerPassword, plan, maxUsers, maxProducts } = body;

    if (!name || name.trim().length < 2) {
      return errorResponse('El nombre del negocio es requerido (min 2 caracteres)');
    }

    const slug = body.slug || slugify(name);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return errorResponse('El slug solo puede contener letras minusculas, numeros y guiones');
    }

    // Check slug uniqueness
    const existing = await db.prepare('SELECT id FROM tenants WHERE slug = ?').bind(slug).first();
    if (existing) return errorResponse('Ya existe un negocio con ese slug/URL');

    const id = 'tn-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO tenants (id, name, slug, description, owner_name, owner_email, owner_phone, plan, max_users, max_products, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name.trim(), slug, description || '', ownerName || '', ownerEmail || '', ownerPhone || '', plan || 'basic', maxUsers || 5, maxProducts || 500, now, now).run();

    // Create owner user if credentials provided
    if (ownerPassword && ownerPassword.length >= 4) {
      const username = slug + '-admin';
      const hashedPw = await hashPassword(ownerPassword);
      const userId = 'tu-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      await db.prepare(
        'INSERT INTO tenant_users (id, tenant_id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, id, username, hashedPw, ownerName || 'Administrador', 'admin').run();
    }

    // Log activity
    await db.prepare(
      'INSERT INTO activity_logs (id, user_id, user_type, action, details) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      payload.userId, 'super_admin', 'tenant_created',
      JSON.stringify({ tenantId: id, tenantName: name, slug })
    ).run();

    return jsonResponse({
      success: true,
      tenant: {
        id, name: name.trim(), slug,
        ownerName: ownerName || '',
        ownerEmail: ownerEmail || '',
        ownerPhone: ownerPhone || '',
        plan: plan || 'basic',
        status: 'active',
        loginUrl: `${slug}`,
        ownerUsername: ownerPassword ? `${slug}-admin` : null,
      },
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Error al crear negocio', 500);
  }
}

// PUT /api/tenants - Update tenant
export async function PUT(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  try {
    const body = await parseBody<{ id: string; name?: string; description?: string; ownerName?: string; ownerEmail?: string; ownerPhone?: string; plan?: string; status?: string; maxUsers?: number; maxProducts?: number; settings?: any }>(req);
    const { id, ...updates } = body;
    if (!id) return errorResponse('ID del tenant es requerido');

    const sets: string[] = ['updated_at = datetime(\'now\')'];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', ownerName: 'owner_name',
      ownerEmail: 'owner_email', ownerPhone: 'owner_phone', plan: 'plan',
      status: 'status', maxUsers: 'max_users', maxProducts: 'max_products',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        sets.push(`${col} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (updates.settings) {
      sets.push('settings = ?');
      values.push(JSON.stringify(updates.settings));
    }

    if (sets.length <= 1) return errorResponse('No hay campos para actualizar');

    values.push(id);
    await db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

    return jsonResponse({ success: true, message: 'Negocio actualizado' });
  } catch (error: any) {
    return errorResponse(error.message || 'Error al actualizar', 500);
  }
}

// DELETE /api/tenants - Delete tenant
export async function DELETE(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const { id } = await parseBody<{ id: string }>(req);
  if (!id) return errorResponse('ID del tenant es requerido');

  const tenant = await db.prepare('SELECT name, slug FROM tenants WHERE id = ?').bind(id).first() as any;
  if (!tenant) return errorResponse('Negocio no encontrado');

  await db.prepare('DELETE FROM activity_logs WHERE tenant_id = ?').bind(id).run();
  await db.prepare('DELETE FROM tenant_users WHERE tenant_id = ?').bind(id).run();
  await db.prepare('DELETE FROM tenants WHERE id = ?').bind(id).run();

  await db.prepare(
    'INSERT INTO activity_logs (id, user_id, user_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    payload.userId, 'super_admin', 'tenant_deleted',
    JSON.stringify({ tenantName: tenant.name, slug: tenant.slug })
  ).run();

  return jsonResponse({ success: true, message: `Negocio "${tenant.name}" eliminado` });
}