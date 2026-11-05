'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

interface JsonFormProps {
  action: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  /** Where to go after success. `{key}` is replaced with that field of the JSON response. */
  redirectTo?: string;
  submitLabel: string;
  className?: string;
  /** Clears every field when the API rejects the submission. */
  resetOnError?: boolean;
  children?: ReactNode;
}

interface ErrorBody {
  error?: { message?: string };
}

// Posts the form fields as JSON and shows the API error without reloading.
export function JsonForm({
  action,
  method = 'POST',
  redirectTo,
  submitLabel,
  className,
  resetOnError = false,
  children,
}: JsonFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    try {
      const body = Object.fromEntries(new FormData(form));
      const response = await fetch(action, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as ErrorBody & Record<string, unknown>;
      if (!response.ok) {
        setError(json.error?.message ?? 'Algo ha fallado. Inténtalo de nuevo.');
        if (resetOnError) form.reset();
        return;
      }
      if (redirectTo !== undefined) {
        router.push(redirectTo.replace(/\{(\w+)\}/g, (_, key: string) => String(json[key] ?? '')));
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {children}
      {error !== null && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
