'use client';

import { useState, useTransition } from 'react';
import { deleteLead } from '@/actions/leads';

export function DeleteLeadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={pending}
        onClick={() => {
          if (!confirm('¿Eliminar este lead, sus mensajes y reuniones? No se puede deshacer.')) return;
          start(async () => {
            const res = await deleteLead(id);
            if (res && !res.ok) setError(res.error ?? 'No se pudo eliminar.');
          });
        }}
      >
        {pending ? 'Eliminando…' : 'Eliminar lead'}
      </button>
      {error && <div className="alert alert-error">{error}</div>}
    </>
  );
}
