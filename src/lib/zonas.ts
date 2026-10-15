// Zonas (Barinas y Portuguesa) con pagina propia en /en/<slug>. Para agregar una zona basta con
// sumarla aqui: aparece en el menu, en la pagina de inicio y se genera su pagina.

export interface Zona {
  slug: string;
  nombre: string;
  estado: string;
}

export const ZONAS: Zona[] = [
  { slug: 'barinas', nombre: 'Barinas', estado: 'Barinas' },
  { slug: 'alto-barinas', nombre: 'Alto Barinas', estado: 'Barinas' },
  { slug: 'santa-lucia', nombre: 'Santa Lucía', estado: 'Barinas' },
  { slug: 'la-luz', nombre: 'La Luz', estado: 'Barinas' },
  { slug: 'sabaneta', nombre: 'Sabaneta', estado: 'Barinas' },
  { slug: 'santa-rosa', nombre: 'Santa Rosa', estado: 'Barinas' },
  { slug: 'santa-barbara', nombre: 'Santa Bárbara', estado: 'Barinas' },
  { slug: 'barinitas', nombre: 'Barinitas', estado: 'Barinas' },
  { slug: 'barrancas', nombre: 'Barrancas', estado: 'Barinas' },
  { slug: 'bum-bum', nombre: 'Bum Bum', estado: 'Barinas' },
  { slug: 'socopo', nombre: 'Socopó', estado: 'Barinas' },
  { slug: 'san-silvestre', nombre: 'San Silvestre', estado: 'Barinas' },
  { slug: 'guanare', nombre: 'Guanare', estado: 'Portuguesa' },
  { slug: 'acarigua', nombre: 'Acarigua', estado: 'Portuguesa' },
];

/** "Socopó, Barinas"; la ciudad que da nombre al estado va sola ("Barinas"). */
export function lugarDe(z: Zona): string {
  return z.nombre === z.estado ? z.nombre : `${z.nombre}, ${z.estado}`;
}

export function zonaPorSlug(slug: string): Zona | undefined {
  return ZONAS.find((z) => z.slug === slug);
}

/** Primer segmento de ruta reservado para estas paginas: ningun negocio puede usarlo como slug. */
export const ZONAS_PREFIJO = 'en';
