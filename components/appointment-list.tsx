'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteAppointment } from '@/actions/appointments';
import { formatAppointment, formatTime } from '@/lib/format';

export type AppointmentItem = {
  id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  google_event_id: string | null;
  lead: { id: string; name: string } | null;
  advisor: string | null;
  vehicle: string | null;
};

export function AppointmentList({ items, showLead = true }: { items: AppointmentItem[]; showLead?: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (items.length === 0) return <div className="empty">No hay reuniones próximas.</div>;

  return (
    <>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} style={{ marginBottom: '0.5rem' }}>{msg.text}</div>}
      <ul className="list">
        {items.map((a) => (
          <li key={a.id} style={{ opacity: busy === a.id && pending ? 0.5 : 1 }}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {formatAppointment(a.starts_at)}–{formatTime(a.ends_at)}
                </div>
                {showLead && a.lead && (
                  <div>
                    <Link href={`/leads/${a.lead.id}`}>{a.lead.name || 'Sin nombre'}</Link>
                  </div>
                )}
                <div className="muted small">
                  {[a.vehicle, a.advisor].filter(Boolean).join(' · ') || '—'}
                </div>
                {a.notes && <div className="small">{a.notes}</div>}
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {a.google_event_id ? (
                  <span className="badge badge-ok">Google</span>
                ) : (
                  <span className="badge" title="No se creó en Google Calendar">Solo en CRM</span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm('¿Cancelar esta reunión?')) return;
                    setBusy(a.id);
                    setMsg(null);
                    start(async () => {
                      const res = await deleteAppointment(a.id);
                      setMsg({ ok: res.ok, text: res.ok ? res.message ?? 'Reunión cancelada.' : res.error ?? 'Error.' });
                      setBusy(null);
                    });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
