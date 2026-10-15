import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus One - Punto de venta en la nube para tu negocio',
  description: 'Sistema de punto de venta en la nube para comercios en Venezuela: ventas en dólares y bolívares con tasa BCV, inventario, crédito, cierre de caja y reportes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="grid-bg">
        {children}
      </body>
    </html>
  );
}