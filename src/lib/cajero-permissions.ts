// Permisos del rol cajero del POS (MyeCommerce), configurables por negocio desde el
// panel del super admin (boton "Permisos del cajero"). Se guardan en
// nx_tenants.settings.cajeroPermissions y el POS los aplica en su API y pantallas.
//
// Mantener sincronizado con CAJERO_PERMISSIONS del POS (src/lib/permissions.ts):
// mismas claves y mismos valores por defecto.

export const CAJERO_PERMISSIONS = [
  { key: 'ventas', label: 'Vender (punto de venta, ventas en espera, presupuestos y notas de entrega)', default: true },
  { key: 'clientes', label: 'Crear y editar clientes', default: true },
  { key: 'caja', label: 'Turnos y cierre de caja', default: true },
  { key: 'devoluciones', label: 'Devoluciones', default: true },
  { key: 'cobranzas', label: 'Cuentas por cobrar (abonos de clientes)', default: true },
  { key: 'gastos', label: 'Gastos', default: true },
  { key: 'informes', label: 'Dashboard e informes', default: true },
  { key: 'inventario', label: 'Ver kardex, reposicion y catalogo', default: true },
  { key: 'productos', label: 'Crear, editar y eliminar productos, categorias, marcas y ajustes de inventario', default: false },
  { key: 'proveedores', label: 'Proveedores', default: false },
  { key: 'compras', label: 'Compras', default: false },
  { key: 'pagos_proveedores', label: 'Cuentas por pagar (pagos a proveedores)', default: false },
  { key: 'tasa', label: 'Cambiar la tasa del dolar', default: false },
] as const;

/** Roles de los usuarios de un negocio ('vendedor' se fusiono en 'cajero'). */
export const TENANT_ROLES = ['admin', 'cajero'] as const;

export function normalizeTenantRole(role: unknown): 'admin' | 'cajero' {
  return role === 'admin' ? 'admin' : 'cajero';
}

/** Permisos del cajero de un negocio: lo guardado en settings sobre los valores por defecto. */
export function cajeroPermissionsFromSettings(settings: unknown): Record<string, boolean> {
  let cfg: any = {};
  try {
    const parsed = typeof settings === 'string' ? JSON.parse(settings || '{}') : settings;
    cfg = parsed?.cajeroPermissions || {};
  } catch { cfg = {}; }
  const out: Record<string, boolean> = {};
  for (const p of CAJERO_PERMISSIONS) out[p.key] = typeof cfg[p.key] === 'boolean' ? cfg[p.key] : p.default;
  return out;
}

/** Solo claves conocidas con valor booleano (lo demas se descarta). */
export function sanitizeCajeroPermissions(input: unknown): Record<string, boolean> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Record<string, boolean> = {};
  for (const p of CAJERO_PERMISSIONS) {
    const v = (input as any)[p.key];
    if (typeof v === 'boolean') out[p.key] = v;
  }
  return out;
}
