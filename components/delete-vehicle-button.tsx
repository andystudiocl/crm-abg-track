'use client';

import { useState, useTransition } from 'react';
import { deleteVehicle } from '@/actions/vehicles';

export function DeleteVehicleButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!confirm('¿Eliminar este auto y todas sus fotos? No se puede deshacer.')) return;
          setError(null);
          start(async () => {
            const res = await deleteVehicle(id);
            // Si tiene éxito, la acción redirige y no vuelve aquí.
            if (res && !res.ok) setError(res.error ?? 'No se pudo eliminar.');
          });
        }}
      >
        {pending ? 'Eliminando…' : 'Eliminar'}
      </button>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
