import LoginPage from '../page';

export const runtime = 'edge';

// Pagina de acceso de cada negocio: /<slug> muestra el login con el negocio ya elegido.
export default function Page() {
  return <LoginPage />;
}
