import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken } from '@/lib/session';
import { jsonResponse, errorResponse, unauthorizedResponse, parseBody } from '@/lib/response';

export const runtime = 'edge';

function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

// POST /api/tenants/create-d1 - Provision a new D1 database for a tenant
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);
  if (!payload || payload.userType !== 'super_admin') return unauthorizedResponse();

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  try {
    const { tenantId, tenantSlug } = await parseBody<{ tenantId: string; tenantSlug: string }>(req);
    if (!tenantId || !tenantSlug) return errorResponse('tenantId y tenantSlug son requeridos');

    const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first() as any;
    if (!tenant) return errorResponse('Tenant no encontrado');
    if (tenant.d1_database_id) return errorResponse('Este tenant ya tiene una base de datos D1 asignada');

    const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';

    if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
      return errorResponse('CF_API_TOKEN y CF_ACCOUNT_ID deben estar configurados como variables de entorno en Cloudflare');
    }

    // Step 1: Create D1 database via Cloudflare API
    const dbName = `pos-${tenantSlug}-${Date.now().toString(36)}`;
    const createDbResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: dbName }),
      }
    );

    const dbResult = await createDbResp.json() as any;
    if (!dbResult.success) {
      return errorResponse(`Error al crear D1: ${JSON.stringify(dbResult.errors)}`, 500);
    }

    const d1DatabaseId = dbResult.result.uuid;

    // Step 2: Update tenant record with D1 info
    await db.prepare(
      'UPDATE tenants SET d1_database_id = ?, d1_database_name = ?, pos_url = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(d1DatabaseId, dbName, '', tenantId).run();

    // Log activity
    await db.prepare(
      'INSERT INTO activity_logs (id, user_id, user_type, tenant_id, action, details) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      payload.userId, 'super_admin', tenantId, 'd1_created',
      JSON.stringify({ databaseName: dbName, databaseId: d1DatabaseId })
    ).run();

    return jsonResponse({
      success: true,
      message: `Base de datos D1 "${dbName}" creada exitosamente`,
      databaseId: d1DatabaseId,
      databaseName: dbName,
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Error al crear base de datos', 500);
  }
}