import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus One - Multi-Tenant Platform',
  description: 'Plataforma de gestion multi-tenant para negocios',
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