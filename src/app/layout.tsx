import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { JsonForm } from '@/components/json-form';
import { currentUser } from '@/lib/current-user';

import './globals.css';

export const metadata: Metadata = {
  title: 'ShopLab',
  description: 'Tienda de demostración para Janus Arena. Todos los datos son ficticios.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            ShopLab
          </Link>
          <nav aria-label="Principal">
            <ul>
              <li>
                <Link href="/">Tienda</Link>
              </li>
              <li>
                <Link href="/cart">Carrito</Link>
              </li>
              {user !== null && (
                <li>
                  <Link href="/orders">Mis pedidos</Link>
                </li>
              )}
            </ul>
          </nav>
          <div className="account">
            {user === null ? (
              <>
                <Link href="/login">Entrar</Link>
                <Link href="/register">Crear cuenta</Link>
              </>
            ) : (
              <>
                <span>Hola, {user.name}</span>
                <JsonForm action="/api/auth/logout" redirectTo="/" submitLabel="Salir" />
              </>
            )}
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          Tienda de demostración. Los productos, usuarios y pagos son ficticios.
        </footer>
      </body>
    </html>
  );
}
