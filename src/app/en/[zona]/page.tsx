import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Home from '@/components/landing';
import { ZONAS, zonaPorSlug } from '@/lib/zonas';

// Landing de cada zona de Barinas: /en/<zona> (lista en src/lib/zonas.ts). Se generan al compilar.
export const dynamicParams = false;

export function generateStaticParams() {
  return ZONAS.map((z) => ({ zona: z.slug }));
}

type Props = { params: Promise<{ zona: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const zona = zonaPorSlug((await params).zona);
  if (!zona) return {};
  const lugar = zona.slug === 'barinas' ? 'Barinas' : `${zona.nombre}, Barinas`;
  return {
    title: `Punto de venta en ${lugar} - Nexus One`,
    description: `Sistema de punto de venta en la nube para comercios de ${lugar}, Venezuela: ventas en dólares y bolívares con tasa BCV, inventario, crédito, cierre de caja y reportes.`,
  };
}

export default async function Page({ params }: Props) {
  const zona = zonaPorSlug((await params).zona);
  if (!zona) notFound();
  return <Home zona={zona} />;
}
