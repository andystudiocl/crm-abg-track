'use client';

import { useFormState } from 'react-dom';
import { updateLead } from '@/actions/leads';
import { initialActionState } from '@/lib/types';
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from '@/lib/format';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { LeadRow } from '@/lib/database.types';
import type { Option } from '@/lib/options';

export function LeadEditForm({ lead, advisors, vehicles }: { lead: LeadRow; advisors: Option[]; vehicles: Option[] }) {
  const [state, action] = useFormState(updateLead, initialActionState);
  return (
    // key: remonta solo si cambian los campos editables (no con cada mensaje entrante del chat).
    <form action={action} className="stack" key={[lead.status, lead.advisor_id, lead.vehicle_id, lead.name, lead.phone, lead.email, lead.campaign, lead.notes].join('|')}>
      <input type="hidden" name="id" value={lead.id} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor="le-status">Estado</label>
          <select id="le-status" name="status" defaultValue={lead.status}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="le-advisor">Asesor asignado</label>
          <select id="le-advisor" name="advisor_id" defaultValue={lead.advisor_id ?? ''}>
            <option value="">Sin asignar</option>
            {advisors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="le-name">Nombre</label>
          <input id="le-name" name="name" type="text" maxLength={120} defaultValue={lead.name} />
        </div>
        <div className="field">
          <label htmlFor="le-phone">Teléfono</label>
          <input id="le-phone" name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={lead.phone ?? ''} placeholder="56912345678" />
        </div>
        <div className="field">
          <label htmlFor="le-email">Correo</label>
          <input id="le-email" name="email" type="email" maxLength={254} defaultValue={lead.email ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="le-campaign">Campaña</label>
          <input id="le-campaign" name="campaign" type="text" maxLength={200} defaultValue={lead.campaign ?? ''} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="le-vehicle">Auto de interés</label>
        <select id="le-vehicle" name="vehicle_id" defaultValue={lead.vehicle_id ?? ''}>
          <option value="">—</option>
          {vehicles.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="le-notes">Notas</label>
        <textarea id="le-notes" name="notes" maxLength={10000} rows={6} defaultValue={lead.notes ?? ''} />
      </div>
      <FormMessage state={state} />
      <div className="form-actions">
        <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
