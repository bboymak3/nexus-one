import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody, slugify } from '@/lib/response';
import { isBillingCycle, addBillingCycle, renewedExpiry, type BillingCycle } from '@/lib/subscription';

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

  let query = 'SELECT t.*, (SELECT COUNT(*) FROM nx_tenant_users WHERE tenant_id = t.id) as user_count FROM nx_tenants t';
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
    'SELECT COUNT(*) as total, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = \'suspended\' THEN 1 ELSE 0 END) as suspended, SUM(CASE WHEN status = \'active\' AND subscription_expires_at IS NOT NULL AND subscription_expires_at <= ? THEN 1 ELSE 0 END) as expired FROM nx_tenants'
  ).bind(new Date().toISOString()).first();

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
      billingCycle?: string;
    }>(req);

    const { name, description, ownerName, ownerEmail, ownerPhone, ownerPassword, plan, maxUsers, maxProducts } = body;
    const billingCycle: BillingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : 'monthly';
    // Primer corte: un periodo desde hoy (null si no tiene corte)
    const firstExpiry = addBillingCycle(new Date(), billingCycle);

    if (!name || name.trim().length < 2) {
      return errorResponse('El nombre del negocio es requerido (min 2 caracteres)');
    }

    const slug = body.slug || slugify(name);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return errorResponse('El slug solo puede contener letras minusculas, numeros y guiones');
    }

    // Check slug uniqueness
    const existing = await db.prepare('SELECT id FROM nx_tenants WHERE slug = ?').bind(slug).first();
    if (existing) return errorResponse('Ya existe un negocio con ese slug/URL');

    const id = 'tn-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO nx_tenants (id, name, slug, description, owner_name, owner_email, owner_phone, plan, max_users, max_products, billing_cycle, subscription_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name.trim(), slug, description || '', ownerName || '', ownerEmail || '', ownerPhone || '', plan || 'basic', maxUsers || 5, maxProducts || 500, billingCycle, firstExpiry ? firstExpiry.toISOString() : null, now, now).run();

    // Create owner user if credentials provided
    if (ownerPassword && ownerPassword.length >= 4) {
      const username = slug + '-admin';
      const hashedPw = await hashPassword(ownerPassword);
      const userId = 'tu-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      await db.prepare(
        'INSERT INTO nx_tenant_users (id, tenant_id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, id, username, hashedPw, ownerName || 'Administrador', 'admin').run();
    }

    // Log activity
    await db.prepare(
      'INSERT INTO nx_activity_logs (id, user_id, user_type, action, details) VALUES (?, ?, ?, ?, ?)'
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
        billingCycle,
        subscriptionExpiresAt: firstExpiry ? firstExpiry.toISOString() : null,
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
    const body = await parseBody<{ id: string; name?: string; description?: string; ownerName?: string; ownerEmail?: string; ownerPhone?: string; plan?: string; status?: string; maxUsers?: number; maxProducts?: number; settings?: any; billingCycle?: string; subscriptionExpiresAt?: string | null; renew?: boolean }>(req);
    const { id, renew, billingCycle, subscriptionExpiresAt, ...updates } = body;
    if (!id) return errorResponse('ID del tenant es requerido');

    const current = await db.prepare('SELECT billing_cycle, subscription_expires_at FROM nx_tenants WHERE id = ?').bind(id).first() as any;
    if (!current) return errorResponse('Negocio no encontrado', 404);

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

    // Suscripcion: ciclo de cobro, fecha de corte y renovacion con un clic
    let cycle: BillingCycle = isBillingCycle(current.billing_cycle) ? current.billing_cycle : 'monthly';
    if (billingCycle !== undefined) {
      if (!isBillingCycle(billingCycle)) return errorResponse('Ciclo invalido. Use: monthly, annual, none');
      cycle = billingCycle;
      sets.push('billing_cycle = ?');
      values.push(cycle);
    }
    let newExpiry: string | null | undefined;
    if (subscriptionExpiresAt !== undefined) {
      if (subscriptionExpiresAt === null || subscriptionExpiresAt === '') newExpiry = null;
      else {
        const d = new Date(subscriptionExpiresAt);
        if (isNaN(d.getTime())) return errorResponse('Fecha de corte invalida');
        newExpiry = d.toISOString();
      }
    }
    if (renew) {
      if (cycle === 'none') return errorResponse('El negocio no tiene ciclo de cobro; elija mensual o anual para renovar');
      const base = newExpiry !== undefined ? newExpiry : current.subscription_expires_at;
      newExpiry = renewedExpiry(base, cycle)!.toISOString();
    } else if (billingCycle === 'none' && subscriptionExpiresAt === undefined) {
      newExpiry = null; // sin ciclo = sin corte
    }
    if (newExpiry !== undefined) {
      sets.push('subscription_expires_at = ?');
      values.push(newExpiry);
    }

    if (updates.status !== undefined && !['active', 'suspended'].includes(updates.status)) {
      return errorResponse('Estado invalido. Use: active, suspended');
    }
    if (updates.plan !== undefined && !['basic', 'business', 'premium'].includes(updates.plan)) {
      return errorResponse('Plan invalido. Use: basic, business, premium');
    }

    if (sets.length <= 1) return errorResponse('No hay campos para actualizar');

    values.push(id);
    await db.prepare(`UPDATE nx_tenants SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

    return jsonResponse({ success: true, message: renew ? 'Suscripcion renovada' : 'Negocio actualizado', subscriptionExpiresAt: newExpiry !== undefined ? newExpiry : current.subscription_expires_at });
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

  const tenant = await db.prepare('SELECT name, slug FROM nx_tenants WHERE id = ?').bind(id).first() as any;
  if (!tenant) return errorResponse('Negocio no encontrado');

  await db.prepare('DELETE FROM nx_activity_logs WHERE tenant_id = ?').bind(id).run();
  await db.prepare('DELETE FROM nx_tenant_users WHERE tenant_id = ?').bind(id).run();
  await db.prepare('DELETE FROM nx_tenants WHERE id = ?').bind(id).run();

  await db.prepare(
    'INSERT INTO nx_activity_logs (id, user_id, user_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    payload.userId, 'super_admin', 'tenant_deleted',
    JSON.stringify({ tenantName: tenant.name, slug: tenant.slug })
  ).run();

  return jsonResponse({ success: true, message: `Negocio "${tenant.name}" eliminado` });
}