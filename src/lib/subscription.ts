// Suscripcion de cada negocio: ciclo de cobro y fecha de corte.
// Un negocio esta habilitado si status = 'active' y su fecha de corte no paso.

export const BILLING_CYCLES = ['monthly', 'annual', 'none'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value);
}

/** Suma un periodo del ciclo a una fecha. 'none' no tiene corte (null). */
export function addBillingCycle(from: Date, cycle: BillingCycle): Date | null {
  if (cycle === 'none') return null;
  const d = new Date(from.getTime());
  if (cycle === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** Nueva fecha de corte al renovar: un periodo mas desde el corte actual (o desde hoy si ya vencio). */
export function renewedExpiry(currentExpiry: string | null, cycle: BillingCycle): Date | null {
  const now = new Date();
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  return addBillingCycle(base, cycle);
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
}
