'use client';

import { useState, useTransition } from 'react';
import { disconnectGoogle } from '@/actions/appointments';

export function GoogleConnect({ connected, configured }: { connected: boolean; configured: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return <div className="alert alert-warn small">Google Calendar aún no está configurado en el servidor (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).</div>;
  }
  if (!connected) {
    return (
      // Enlace normal (no <Link>): es una redirección completa a Google.
      <a href="/api/google/auth" className="btn btn-primary">
        Conectar mi Google Calendar
      </a>
    );
  }
  return (
    <div className="row">
      <span className="badge badge-ok">Google Calendar conectado</span>
      <button
        type="button"
        className="link-btn small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await disconnectGoogle();
            if (!res.ok) setError(res.error ?? 'Error.');
          })
        }
      >
        {pending ? 'Desconectando…' : 'Desconectar'}
      </button>
      {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
