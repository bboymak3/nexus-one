import { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { verifySessionToken, createPosSsoToken, readEnv, getSessionFromRequest } from '@/lib/session';
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { getActiveTenantSession } from '@/lib/guards';

export const runtime = 'edge';

function getDB(): any {
  try {
    const { env } = getRequestContext();
    if (env.DB) return env.DB;
  } catch {}
  return null;
}

// POST /api/sso - Genera el enlace de acceso al Punto de Venta (MyeCommerce) del negocio.
// El POS es compartido (una D1 con tenant_id); cada negocio entra a sus propios datos.
export async function POST(req: NextRequest) {
  const token = getSessionFromRequest(req);
  if (!token) return unauthorizedResponse();
  const payload = await verifySessionToken(token);

  const db = getDB();
  if (!db) return errorResponse('Database not available');

  const active = await getActiveTenantSession(db, payload);
  if (!active) return errorResponse('Sesion invalida, usuario inactivo o negocio suspendido', 401);
  const { user, tenant } = active;

  const posBaseUrl = (tenant.pos_url || readEnv('MYECOMMERCE_URL') || '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(posBaseUrl)) {
    return errorResponse('URL del POS no configurada. Defina la variable MYECOMMERCE_URL (https://...) en nexus-one.', 503);
  }

  try {
    const ssoToken = await createPosSsoToken({
      userId: user.id,
      username: user.username,
      fullName: user.full_name || user.username,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });

    await db.prepare(
      'INSERT INTO activity_logs (id, tenant_id, user_id, user_type, action, details) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      'log-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      tenant.id, user.id, 'tenant', 'pos_sso',
      JSON.stringify({ username: user.username })
    ).run();

    return jsonResponse({ url: `${posBaseUrl}/api/nexus-sso?token=${encodeURIComponent(ssoToken)}` });
  } catch (error: any) {
    return errorResponse(error.message || 'Error al generar acceso al POS', 500);
  }
}
