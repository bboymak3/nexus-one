// Datos editables de la landing (pagina de inicio). Cambiar aqui el WhatsApp, los precios
// y los textos de "Quienes somos" sin tocar el diseño.

export const landingConfig = {
  marca: 'Nexus One',

  /**
   * WhatsApp de contacto en formato internacional, solo digitos (Venezuela: 58 + numero sin
   * el 0). Ejemplo: '584121234567'. Vacio = el boton abre WhatsApp para elegir el contacto.
   */
  whatsapp: '',
  whatsappMensaje: 'Hola, quiero información sobre Nexus One y el sistema de punto de venta.',

  /** Correo de contacto (opcional; vacio = no se muestra). */
  email: '',

  /** Moneda de los precios. */
  moneda: 'US$',

  /**
   * Planes. `precioMensual` / `precioAnual` en la moneda de arriba; null = "Consultar".
   * Los ids son los planes que usa el panel (basic, business, premium).
   */
  planes: [
    {
      id: 'basic',
      nombre: 'Básico',
      precioMensual: null as number | null,
      precioAnual: null as number | null,
      descripcion: 'Para empezar a vender con orden.',
      destacado: false,
      incluye: [
        'Punto de venta en $ y Bs con tasa BCV',
        'Productos, categorías y marcas',
        'Cierre de caja y devoluciones',
        'Impresión de recibos',
        'Reportes básicos',
        'Hasta 300 productos y 1 usuario',
      ],
    },
    {
      id: 'business',
      nombre: 'Business',
      precioMensual: null as number | null,
      precioAnual: null as number | null,
      descripcion: 'Para negocios con equipo y crédito.',
      destacado: true,
      incluye: [
        'Todo lo del plan Básico',
        'Productos ilimitados',
        'Hasta 5 usuarios con roles',
        'Ventas a crédito, abonos y cuentas por cobrar',
        'Compras, proveedores y cuentas por pagar',
        'Reportes avanzados, gráficos y estado de resultados',
        'Alertas de inventario y kardex',
        'Notas de entrega y presupuestos',
      ],
    },
    {
      id: 'premium',
      nombre: 'Premium',
      precioMensual: null as number | null,
      precioAnual: null as number | null,
      descripcion: 'Acompañamiento completo.',
      destacado: false,
      incluye: [
        'Todo lo del plan Business',
        'Configuración y carga inicial de productos asistida',
        'Capacitación para tu equipo',
        'Soporte prioritario por WhatsApp',
      ],
    },
  ],

  quienesSomos: [
    'Somos un equipo venezolano que desarrolla software para comercios: bodegas, ferreterías, tiendas y distribuidoras que necesitan vender rápido, controlar su inventario y saber cuánto ganan.',
    'Nexus One nació para que cada negocio tenga su propio sistema de punto de venta en la nube, sin instalar nada y pensado para la realidad del país: precios en dólares y bolívares, tasa BCV y ventas a crédito.',
  ],
};

export function whatsappUrl(mensaje = landingConfig.whatsappMensaje): string {
  const num = landingConfig.whatsapp.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}
