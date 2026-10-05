'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { createAppointment } from '@/actions/appointments';
import { initialActionState } from '@/lib/types';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { Option } from '@/lib/options';

export function AppointmentForm({
  leads,
  leadId,
  advisors,
  vehicles,
  defaultAdvisorId,
  defaultVehicleId,
  defaultStart,
}: {
  /** Lista para elegir lead (en /calendar). Si se pasa leadId, el lead queda fijo. */
  leads?: Option[];
  leadId?: string;
  advisors: Option[];
  vehicles: Option[];
  defaultAdvisorId: string;
  defaultVehicleId?: string | null;
  /** Valor inicial para datetime-local en hora de Santiago (calculado en el servidor). */
  defaultStart: string;
}) {
  const [state, action] = useFormState(createAppointment, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form action={action} ref={formRef} className="stack">
      {leadId ? (
        <input type="hidden" name="lead_id" value={leadId} />
      ) : (
        <div className="field">
          <label htmlFor="ap-lead">Lead *</label>
          <select id="ap-lead" name="lead_id" required defaultValue="">
            <option value="" disabled>
              Elige un lead…
            </option>
            {(leads ?? []).map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ap-start">Fecha y hora *</label>
          <input id="ap-start" name="starts_at" type="datetime-local" required defaultValue={defaultStart} step={900} />
        </div>
        <div className="field">
          <label htmlFor="ap-duration">Duración (minutos)</label>
          <input id="ap-duration" name="duration" type="number" inputMode="numeric" min={15} max={480} step={15} defaultValue={60} />
        </div>
        <div className="field">
          <label htmlFor="ap-advisor">Asesor</label>
          <select id="ap-advisor" name="advisor_id" defaultValue={defaultAdvisorId}>
            {advisors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-vehicle">Auto</label>
          <select id="ap-vehicle" name="vehicle_id" defaultValue={defaultVehicleId ?? ''}>
            <option value="">{leadId ? 'El de interés del lead' : '—'}</option>
            {vehicles.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ap-notes">Notas</label>
        <textarea id="ap-notes" name="notes" rows={2} maxLength={2000} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>Hora de Santiago de Chile.</p>
      <FormMessage state={state} />
      <div className="form-actions">
        <SubmitButton pendingText="Agendando…">Agendar reunión</SubmitButton>
      </div>
    </form>
  );
}
