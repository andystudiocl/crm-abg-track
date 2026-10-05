'use client';

import { useFormState } from 'react-dom';
import { createLead } from '@/actions/leads';
import { initialActionState } from '@/lib/types';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { Option } from '@/lib/options';

export function NewLeadForm({
  advisors,
  vehicles,
  currentAdvisorId,
}: {
  advisors: Option[];
  vehicles: Option[];
  currentAdvisorId: string;
}) {
  const [state, action] = useFormState(createLead, initialActionState);
  return (
    <form action={action} className="stack">
      <div className="grid-3">
        <div className="field">
          <label htmlFor="nl-name">Nombre *</label>
          <input id="nl-name" name="name" type="text" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="nl-phone">Teléfono</label>
          <input id="nl-phone" name="phone" type="tel" inputMode="tel" maxLength={30} placeholder="+56 9 1234 5678" />
        </div>
        <div className="field">
          <label htmlFor="nl-email">Correo</label>
          <input id="nl-email" name="email" type="email" maxLength={254} />
        </div>
        <div className="field">
          <label htmlFor="nl-vehicle">Auto de interés</label>
          <select id="nl-vehicle" name="vehicle_id" defaultValue="">
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nl-advisor">Asesor</label>
          <select id="nl-advisor" name="advisor_id" defaultValue={currentAdvisorId}>
            <option value="">Sin asignar</option>
            {advisors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nl-campaign">Campaña / referido</label>
          <input id="nl-campaign" name="campaign" type="text" maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="nl-notes">Notas</label>
        <textarea id="nl-notes" name="notes" maxLength={5000} rows={3} />
      </div>
      <FormMessage state={state} />
      <div className="form-actions">
        <SubmitButton pendingText="Creando…">Crear lead</SubmitButton>
      </div>
    </form>
  );
}
