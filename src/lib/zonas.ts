// Zonas de Barinas con pagina propia en /en/<slug>. Para agregar una zona basta con
// sumarla aqui: aparece en el menu, en la pagina de inicio y se genera su pagina.

export interface Zona {
  slug: string;
  nombre: string;
}

export const ZONAS: Zona[] = [
  { slug: 'barinas', nombre: 'Barinas' },
  { slug: 'santa-rosa', nombre: 'Santa Rosa' },
  { slug: 'la-luz', nombre: 'La Luz' },
  { slug: 'canagua', nombre: 'Canaguá' },
  { slug: 'carigua', nombre: 'Carigua' },
  { slug: 'santa-barbara', nombre: 'Santa Bárbara' },
  { slug: 'socopo', nombre: 'Socopó' },
  { slug: 'bum-bum', nombre: 'Bum Bum' },
];

export function zonaPorSlug(slug: string): Zona | undefined {
  return ZONAS.find((z) => z.slug === slug);
}

/** Primer segmento de ruta reservado para estas paginas: ningun negocio puede usarlo como slug. */
export const ZONAS_PREFIJO = 'en';
