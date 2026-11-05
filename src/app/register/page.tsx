import Link from 'next/link';

import { JsonForm } from '@/components/json-form';

export default function RegisterPage() {
  return (
    <>
      <h1>Crear cuenta</h1>
      <JsonForm action="/api/auth/register" redirectTo="/" submitLabel="Crear cuenta">
        <label>
          Nombre
          <input name="name" autoComplete="name" required maxLength={100} />
        </label>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña (mínimo 8 caracteres)
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Dirección de envío
          <textarea name="address" rows={3} autoComplete="street-address" required />
        </label>
      </JsonForm>
      <p>
        ¿Ya tienes cuenta? <Link href="/login">Entra</Link>
      </p>
    </>
  );
}
