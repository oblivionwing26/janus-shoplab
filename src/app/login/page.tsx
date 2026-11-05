import Link from 'next/link';

import { JsonForm } from '@/components/json-form';

export default function LoginPage() {
  return (
    <>
      <h1>Entrar</h1>
      <JsonForm action="/api/auth/login" redirectTo="/" submitLabel="Entrar">
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
      </JsonForm>
      <p>
        ¿No tienes cuenta? <Link href="/register">Crea una</Link>
      </p>
    </>
  );
}
