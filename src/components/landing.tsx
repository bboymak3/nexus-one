'use client';
import { useEffect, useState } from 'react';
import LoginPanel from '@/components/login-panel';
import { landingConfig as cfg, whatsappUrl } from '@/lib/landing-config';
import { ZONAS, ZONAS_PREFIJO, type Zona } from '@/lib/zonas';

type LoginMode = 'landing' | 'admin' | 'tenant';

// Landing publica (inicio y paginas de cada zona en /en/<zona>). El login se abre con
// "Iniciar sesion" y se muestra directo en /<slug> (login del negocio), con ?mode=admin,
// ?login o si vuelve con ?error=.
export default function Home({ zona }: { zona?: Zona }) {
  const [login, setLogin] = useState<LoginMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSlug = /^\/([a-z0-9-]+)$/.test(window.location.pathname);
    if (isSlug || params.get('mode') === 'admin' || params.has('login') || params.has('error')) {
      setLogin('landing');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (login) window.scrollTo(0, 0);
    // La pagina se dibuja despues de cargar: ir a la seccion del enlace (#barinas, #planes...)
    else if (ready && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [login, ready]);

  if (!ready) return null;
  if (login) return (
    <>
      <LoginPanel initialMode={login} onBack={() => {
        setLogin(null);
        if (window.location.search || /^\/[a-z0-9-]+$/.test(window.location.pathname)) history.replaceState(null, '', zona ? window.location.pathname : '/');
      }} />
      <WhatsAppButton />
    </>
  );
  return <Landing onLogin={setLogin} zona={zona} />;
}

/* ---------- Iconos (SVG en linea, sin dependencias) ---------- */
const I = {
  logo: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /><line x1="12" y1="22" x2="12" y2="15.5" />
      <polyline points="22 8.5 12 15.5 2 8.5" /><polyline points="2 15.5 12 8.5 22 15.5" /><line x1="12" y1="2" x2="12" y2="8.5" />
    </svg>
  ),
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  whatsapp: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.79.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.77 1.47h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  ),
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS = {
  cart: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z|M3 6h18|M16 10a4 4 0 0 1-8 0',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z|M3.27 6.96 12 12.01l8.73-5.05|M12 22.08V12',
  card: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z|M2 10h20',
  cash: 'M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  chart: 'M3 3v18h18|M18 17V9|M13 17V5|M8 17v-3',
  truck: 'M1 3h15v13H1z|M16 8h4l3 3v5h-7z|M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  printer: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
  building: 'M3 21h18|M5 21V7l8-4v18|M19 21V11l-6-4|M9 9v.01|M9 12v.01|M9 15v.01|M9 18v.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  calendar: 'M3 4h18v18H3z|M16 2v4|M8 2v4|M3 10h18',
  key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  cloud: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  dollar: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8|M12 18V6',
};

/* ---------- Contenido ---------- */
const OWNER_FEATURES = [
  { icon: ICONS.cart, t: 'Punto de venta rápido', d: 'Vende con lector de código de barras, en dólares y bolívares, con la tasa BCV actualizada cada día.' },
  { icon: ICONS.box, t: 'Inventario y kardex', d: 'Stock al día con cada venta y compra, alertas de productos por agotarse y el historial de cada movimiento.' },
  { icon: ICONS.card, t: 'Crédito y cobranza', d: 'Ventas a crédito, abonos de clientes y lista de créditos vencidos para saber quién te debe.' },
  { icon: ICONS.truck, t: 'Compras y proveedores', d: 'Registra compras, lo que debes a cada proveedor y sus pagos.' },
  { icon: ICONS.cash, t: 'Cierre de caja y turnos', d: 'Cuadre del efectivo en $ y Bs incluyendo abonos, gastos y pagos; cierre por cajero.' },
  { icon: ICONS.chart, t: 'Reportes y ganancias', d: 'Ventas del día, productos más vendidos, gastos y estado de resultados.' },
  { icon: ICONS.printer, t: 'Recibos y documentos', d: 'Imprime recibos, notas de entrega y presupuestos; registra devoluciones.' },
  { icon: ICONS.users, t: 'Tu equipo con permisos', d: 'Usuarios para cajeros y encargados, cada uno con lo que puede ver y hacer.' },
];

const ADMIN_FEATURES = [
  { icon: ICONS.building, t: 'Todos tus negocios en un panel', d: 'Crea negocios en minutos: cada uno con su propio POS, sus datos y su dirección.' },
  { icon: ICONS.calendar, t: 'Planes y suscripciones', d: 'Asigna el plan, el ciclo mensual o anual y la fecha de corte; renueva con un clic.' },
  { icon: ICONS.shield, t: 'Control de acceso', d: 'Suspende un negocio o deja que venza: el POS se bloquea al instante y el dueño ve el aviso.' },
  { icon: ICONS.key, t: 'Usuarios y acceso directo', d: 'Administra los usuarios de cada negocio; ellos entran a su POS con un clic, sin otra clave.' },
];

const STEPS = [
  { n: '1', t: 'Escríbenos', d: 'Cuéntanos de tu negocio por WhatsApp y elige el plan.' },
  { n: '2', t: 'Creamos tu cuenta', d: 'Te damos tu usuario y la dirección de tu negocio.' },
  { n: '3', t: 'Empieza a vender', d: 'Carga tus productos y vende desde la computadora, tablet o teléfono.' },
];

const FAQ = [
  { q: '¿Tengo que instalar algo?', a: 'No. Funciona en el navegador de la computadora, tablet o teléfono. Solo necesitas internet.' },
  { q: '¿Maneja dólares y bolívares?', a: 'Sí. Los precios se llevan en $ y se cobran en $ o Bs con la tasa BCV del día. Aceptas efectivo, pago móvil, punto, transferencia y más.' },
  { q: '¿Mis datos están separados de los de otros negocios?', a: 'Sí. Cada negocio tiene sus datos aislados y solo entran sus usuarios.' },
  { q: '¿Puedo pagar mensual o anual?', a: 'Sí. Eliges el ciclo de pago, mensual o anual, y ves en tu panel la fecha de corte.' },
  { q: '¿Qué pasa si no renuevo?', a: 'Tus datos se conservan. El punto de venta se pausa hasta que renueves.' },
];

/* ---------- Piezas ---------- */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>{I.logo(20)}</div>
      <span className="font-bold tracking-wide gradient-text text-lg">NEXUS ONE</span>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function WhatsAppButton({ mensaje }: { mensaje?: string }) {
  return (
    <a
      href={whatsappUrl(mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="lp-wa fixed z-40 bottom-5 right-5 flex items-center gap-2 rounded-full pl-3.5 pr-4 py-3 text-white font-semibold shadow-lg"
    >
      {I.whatsapp(24)}
      <span className="hidden sm:inline text-sm">Escríbenos</span>
    </a>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>{kicker}</p>
      <h2 className="text-2xl sm:text-4xl font-bold leading-tight">{title}</h2>
      {sub && <p className="mt-4 text-base" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  );
}

function FeatureCard({ icon, t, d, tone }: { icon: string; t: string; d: string; tone: 'violet' | 'cyan' }) {
  const c = tone === 'violet' ? { bg: 'rgba(139,92,246,0.12)', fg: '#a78bfa' } : { bg: 'rgba(6,182,212,0.12)', fg: '#22d3ee' };
  return (
    <div className="lp-card rounded-2xl p-5">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: c.bg, color: c.fg }}><Icon d={icon} /></div>
      <h3 className="font-semibold mb-1.5">{t}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{d}</p>
    </div>
  );
}

function price(n: number | null) {
  return n == null ? null : `${cfg.moneda} ${n % 1 === 0 ? n : n.toFixed(2)}`;
}

/* ---------- Landing ---------- */
const zonaUrl = (z: Zona) => `/${ZONAS_PREFIJO}/${z.slug}`;

function Landing({ onLogin, zona }: { onLogin: (m: LoginMode) => void; zona?: Zona }) {
  const [audience, setAudience] = useState<'owner' | 'admin'>('owner');
  const [annual, setAnnual] = useState(false);
  const [menu, setMenu] = useState(false);
  const [zonasOpen, setZonasOpen] = useState(false);
  const lugar = zona ? (zona.slug === 'barinas' ? 'Barinas' : `${zona.nombre}, Barinas`) : cfg.ubicacion;
  const hasAnnual = cfg.planes.some((p) => p.precioAnual != null);
  const nav = [['#funciones', 'Funciones'], ['#planes', 'Planes'], ['#nosotros', 'Quiénes somos'], ['#contacto', 'Contacto']];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.14), transparent 70%)' }} />
        <div className="absolute top-1/3 -left-48 w-[30rem] h-[30rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 lp-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href={zona ? '/' : '#inicio'} aria-label="Inicio"><Logo /></a>
          <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {nav.map(([h, l]) => <a key={h} href={h} className="hover:text-white transition-colors">{l}</a>)}
            <div className="relative" onMouseLeave={() => setZonasOpen(false)}>
              <button onClick={() => setZonasOpen(!zonasOpen)} onMouseEnter={() => setZonasOpen(true)} className="flex items-center gap-1 hover:text-white transition-colors" aria-expanded={zonasOpen}>
                Barinas
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {zonasOpen && (
                <div className="absolute right-0 top-full pt-3">
                  <div className="rounded-xl p-2 w-56 grid gap-0.5 shadow-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {ZONAS.map((z) => (
                      <a key={z.slug} href={zonaUrl(z)} className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5" style={zona?.slug === z.slug ? { color: '#c4b5fd' } : undefined}>{z.nombre}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <a href={cfg.empresa.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{cfg.empresa.nombre}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => onLogin('landing')} className="nexus-btn nexus-btn-primary nexus-btn-sm sm:px-4 sm:py-2 sm:text-sm">Iniciar sesión</button>
            <button onClick={() => setMenu(!menu)} className="md:hidden p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }} aria-label="Menú">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={menu ? 'M18 6 6 18M6 6l12 12' : 'M3 6h18M3 12h18M3 18h18'} /></svg>
            </button>
          </div>
        </div>
        {menu && (
          <nav className="md:hidden px-4 pb-4 flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {nav.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="py-2.5 px-2 rounded-lg hover:text-white">{l}</a>)}
            <a href={cfg.empresa.url} target="_blank" rel="noopener noreferrer" className="py-2.5 px-2 rounded-lg hover:text-white">{cfg.empresa.nombre}</a>
            <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Barinas</p>
            <div className="grid grid-cols-2 gap-1">
              {ZONAS.map((z) => (
                <a key={z.slug} href={zonaUrl(z)} className="py-2 px-2 rounded-lg hover:text-white" style={zona?.slug === z.slug ? { color: '#c4b5fd' } : undefined}>{z.nombre}</a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section id="inicio" className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 mb-6" style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
            <PinIcon /> {zona ? `Ahora en ${lugar}` : `Estamos en ${cfg.ubicacion}`} · Punto de venta en la nube
          </span>
          {zona ? (
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight max-w-4xl mx-auto">
              El punto de venta para los comercios de <span className="gradient-text">{zona.nombre}</span>
            </h1>
          ) : (
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight max-w-4xl mx-auto">
              Vende, controla tu inventario y <span className="gradient-text">administra tu negocio</span> desde un solo lugar
            </h1>
          )}
          <p className="mt-6 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {zona
              ? `Bodegas, ferreterías, tiendas y distribuidoras de ${lugar} ya pueden tener su propio punto de venta con precios en dólares y bolívares, crédito a clientes, cierre de caja y reportes. Sin instalar nada.`
              : `${cfg.marca} te da tu propio punto de venta con precios en dólares y bolívares, crédito a clientes, cierre de caja y reportes. Sin instalar nada.`}
          </p>

          {/* Selector de perfil */}
          <div className="mt-10 inline-flex rounded-xl p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {([['owner', 'Soy propietario de un negocio'], ['admin', 'Soy administrador']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setAudience(k)}
                className="px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all"
                style={audience === k ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--text-secondary)' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="mt-8 max-w-3xl mx-auto glass rounded-2xl p-6 sm:p-8 text-left animate-fade" key={audience}>
            {audience === 'owner' ? (
              <>
                <h2 className="text-xl font-bold mb-2">Para el propietario del negocio</h2>
                <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Todo lo que pasa en tu tienda, a la vista y en orden.</p>
                <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                  {['Vende en $ y Bs con la tasa BCV del día', 'Controla el stock y recibe alertas', 'Fía con control: créditos, abonos y vencidos', 'Cuadra la caja al cierre de cada día', 'Mira cuánto vendes y cuánto ganas', 'Tus cajeros con usuario y permisos'].map((x) => (
                    <li key={x} className="flex gap-2.5"><span style={{ color: '#22d3ee' }} className="mt-0.5">{I.check}</span>{x}</li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="nexus-btn lp-wa-btn justify-center">{I.whatsapp(18)} Quiero mi punto de venta</a>
                  <button onClick={() => onLogin('tenant')} className="nexus-btn nexus-btn-secondary justify-center">Entrar a mi negocio</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2">Para el administrador de la plataforma</h2>
                <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Gestiona muchos negocios y sus suscripciones desde un panel.</p>
                <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                  {['Crea negocios con su propio POS', 'Asigna planes: básico, business o premium', 'Ciclo mensual o anual con fecha de corte', 'Renueva, suspende o reactiva al instante', 'Administra los usuarios de cada negocio', 'Registro de actividad de la plataforma'].map((x) => (
                    <li key={x} className="flex gap-2.5"><span style={{ color: '#a78bfa' }} className="mt-0.5">{I.check}</span>{x}</li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => onLogin('admin')} className="nexus-btn nexus-btn-primary justify-center">Entrar al panel de administración</button>
                </div>
              </>
            )}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {[[ICONS.cloud, 'En la nube, sin instalar'], [ICONS.dollar, 'Dólares y bolívares'], [ICONS.shield, 'Datos separados por negocio']].map(([ic, l]) => (
              <span key={l} className="flex items-center gap-2"><span style={{ color: '#22d3ee' }}><Icon d={ic} /></span>{l}</span>
            ))}
          </div>
        </section>

        {/* Funciones del propietario */}
        <section id="funciones" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Para tu negocio" title="Todo lo que necesitas para vender y controlar" sub="Un punto de venta completo, pensado para comercios en Venezuela." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OWNER_FEATURES.map((f) => <FeatureCard key={f.t} {...f} tone="cyan" />)}
          </div>
        </section>

        {/* Funciones del administrador */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Para el administrador" title="Un panel para todos los negocios" sub="Crea, cobra y controla cada negocio sin entrar uno por uno." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ADMIN_FEATURES.map((f) => <FeatureCard key={f.t} {...f} tone="violet" />)}
          </div>
        </section>

        {/* Como funciona */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Cómo empezar" title="Listo en tres pasos" />
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="lp-card rounded-2xl p-6">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-4 text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>{s.n}</div>
                <h3 className="font-semibold mb-1.5">{s.t}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Planes y precios" title="Elige el plan para tu negocio" sub="Pago mensual o anual. Sin costos de instalación." />
          {hasAnnual && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-xl p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {[[false, 'Mensual'], [true, 'Anual']].map(([v, l]) => (
                  <button key={String(v)} onClick={() => setAnnual(v as boolean)} className="px-5 py-2 text-sm font-medium rounded-lg"
                    style={annual === v ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--text-secondary)' }}>{l as string}</button>
                ))}
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {cfg.planes.map((p) => {
              const amount = price(annual ? p.precioAnual : p.precioMensual);
              return (
                <div key={p.id} className={`rounded-2xl p-6 flex flex-col relative ${p.destacado ? 'lp-plan-hot' : 'lp-card'}`}>
                  {p.destacado && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>Más elegido</span>
                  )}
                  <h3 className="text-lg font-bold">{p.nombre}</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{p.descripcion}</p>
                  <div className="mt-5 mb-6">
                    {amount ? (
                      <p><span className="text-4xl font-extrabold">{amount}</span><span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/{annual ? 'año' : 'mes'}</span></p>
                    ) : (
                      <p className="text-2xl font-bold">Consultar precio</p>
                    )}
                  </div>
                  <ul className="space-y-2.5 text-sm flex-1">
                    {p.incluye.map((x) => (
                      <li key={x} className="flex gap-2.5"><span className="mt-0.5 shrink-0" style={{ color: p.destacado ? '#a78bfa' : '#22d3ee' }}>{I.check}</span>{x}</li>
                    ))}
                  </ul>
                  <a href={whatsappUrl(`Hola, me interesa el plan ${p.nombre} de ${cfg.marca}.`)} target="_blank" rel="noopener noreferrer"
                    className={`nexus-btn justify-center mt-7 ${p.destacado ? 'nexus-btn-primary' : 'nexus-btn-secondary'}`}>
                    {amount ? 'Lo quiero' : 'Pedir precio'}
                  </a>
                </div>
              );
            })}
          </div>
        </section>

        {/* Barinas */}
        <section id="barinas" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="rounded-3xl p-6 sm:p-12 lp-cta">
            <div className="grid md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#22d3ee' }}><PinIcon /> {cfg.ubicacion}</p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">{zona ? `Estamos en ${zona.nombre}` : 'Llegamos a Barinas'}</h2>
                <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {zona
                    ? `Atendemos a los comercios de ${lugar} con instalación, carga de productos y soporte por WhatsApp. También estamos en el resto de Barinas:`
                    : 'Estamos en Barinas, Venezuela, y atendemos a los comercios de toda la región: te ayudamos a arrancar, cargamos tus productos y te damos soporte por WhatsApp. Busca tu zona:'}
                </p>
              </div>
              <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ZONAS.map((z) => {
                  const actual = zona?.slug === z.slug;
                  return (
                    <a key={z.slug} href={zonaUrl(z)} className="lp-card rounded-xl px-3 py-3.5 text-center text-sm font-medium"
                      style={actual ? { borderColor: 'rgba(139,92,246,0.7)', color: '#c4b5fd' } : undefined}>
                      {z.nombre}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Quienes somos */}
        <section id="nosotros" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="glass rounded-3xl p-6 sm:p-12 grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>Quiénes somos</p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-5">Tecnología hecha para el comercio venezolano</h2>
              {cfg.quienesSomos.map((t) => <p key={t} className="mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t}</p>)}
              <a href={cfg.empresa.url} target="_blank" rel="noopener noreferrer" className="nexus-btn nexus-btn-secondary mt-2">Conoce {cfg.empresa.nombre} ↗</a>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              {[['$ / Bs', 'Divisa dual'], ['BCV', 'Tasa diaria'], ['24/7', 'En la nube'], ['1 clic', 'Acceso al POS']].map(([a, b]) => (
                <div key={b} className="lp-card rounded-2xl p-4 text-center">
                  <p className="text-2xl font-extrabold gradient-text">{a}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Preguntas frecuentes" title="Lo que más nos preguntan" />
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="lp-card rounded-xl px-5 py-4 group">
                <summary className="cursor-pointer font-medium list-none flex justify-between items-center gap-4">
                  {f.q}<span className="transition-transform group-open:rotate-45 text-xl leading-none" style={{ color: '#a78bfa' }}>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="rounded-3xl p-8 sm:p-14 text-center lp-cta">
            <h2 className="text-2xl sm:text-4xl font-bold">¿Listo para ordenar tu negocio?</h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Escríbenos por WhatsApp: te explicamos los planes, resolvemos tus dudas y dejamos tu punto de venta listo.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="nexus-btn lp-wa-btn justify-center py-3 px-6 text-base">{I.whatsapp(20)} Escríbenos por WhatsApp</a>
              {cfg.email && <a href={`mailto:${cfg.email}`} className="nexus-btn nexus-btn-secondary justify-center py-3 px-6 text-base">{cfg.email}</a>}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-6 justify-between items-center text-sm" style={{ color: 'var(--text-muted)' }}>
          <Logo />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {nav.map(([h, l]) => <a key={h} href={h} className="hover:text-white">{l}</a>)}
            <button onClick={() => onLogin('landing')} className="hover:text-white">Iniciar sesión</button>
          </div>
          <div className="text-center md:text-right">
            <p>© {new Date().getFullYear()} {cfg.marca} · {cfg.ubicacion}</p>
            <p className="mt-1">Un producto de <a href={cfg.empresa.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{cfg.empresa.nombre}</a></p>
          </div>
        </div>
      </footer>

      <WhatsAppButton mensaje={zona ? `Hola, tengo un negocio en ${lugar} y quiero información sobre ${cfg.marca}.` : undefined} />
    </div>
  );
}
