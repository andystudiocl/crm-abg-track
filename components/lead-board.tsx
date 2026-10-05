'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { updateLeadStatus } from '@/actions/leads';
import { LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, formatDateTime } from '@/lib/format';
import type { LeadSource, LeadStatus } from '@/lib/database.types';

export type BoardLead = {
  id: string;
  name: string;
  source: LeadSource;
  status: LeadStatus;
  created_at: string;
  vehicle: string | null;
  advisor: string | null;
};

const SOURCE_CLASS: Record<LeadSource, string> = {
  meta_ads: 'badge badge-info',
  whatsapp: 'badge badge-ok',
  web: 'badge badge-gold',
  manual: 'badge',
};

export function LeadBoard({ leads: initial }: { leads: BoardLead[] }) {
  const [leads, setLeads] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [, startTransition] = useTransition();

  // Sincroniza con los datos frescos del servidor tras revalidar.
  useEffect(() => setLeads(initial), [initial]);

  function move(id: string, status: LeadStatus) {
    const prev = leads;
    const current = prev.find((l) => l.id === id);
    if (!current || current.status === status) return;
    setError(null);
    setLeads(prev.map((l) => (l.id === id ? { ...l, status } : l)));
    startTransition(async () => {
      const res = await updateLeadStatus(id, status);
      if (!res.ok) {
        setLeads(prev);
        setError(res.error ?? 'No se pudo cambiar el estado.');
      }
    });
  }

  return (
    <>
      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
      <div className="kanban">
        {LEAD_STATUSES.map((status) => {
          const items = leads.filter((l) => l.status === status);
          return (
            <section
              key={status}
              className={`kanban-col${dragOver === status ? ' drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) move(id, status);
              }}
            >
              <div className="kanban-head">
                <h3>{LEAD_STATUS_LABEL[status]}</h3>
                <span className="kanban-count">{items.length}</span>
              </div>
              {items.length === 0 && <div className="empty small">Sin leads</div>}
              {items.map((l) => (
                <article
                  key={l.id}
                  className="lead-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', l.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="row-between" style={{ gap: 6 }}>
                    <Link href={`/leads/${l.id}`} className="lead-name">
                      {l.name || 'Sin nombre'}
                    </Link>
                    <span className={SOURCE_CLASS[l.source]}>{LEAD_SOURCE_LABEL[l.source]}</span>
                  </div>
                  {l.vehicle && <div className="small">{l.vehicle}</div>}
                  <div className="lead-meta">
                    <span>{formatDateTime(l.created_at)}</span>
                    <span>{l.advisor ?? 'Sin asesor'}</span>
                  </div>
                  <select
                    aria-label="Cambiar estado"
                    value={l.status}
                    onChange={(e) => move(l.id, e.target.value as LeadStatus)}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
