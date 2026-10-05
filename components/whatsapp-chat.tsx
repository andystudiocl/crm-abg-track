'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import { sendWhatsApp } from '@/actions/messages';
import { initialActionState } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { MessageDirection } from '@/lib/database.types';

type Msg = { id: string; direction: MessageDirection; body: string; created_at: string };

export function WhatsAppChat({
  leadId,
  messages,
  hasPhone,
  windowHoursLeft,
}: {
  leadId: string;
  messages: Msg[];
  hasPhone: boolean;
  /** Horas que quedan de la ventana de 24 h; null si está cerrada. */
  windowHoursLeft: number | null;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState(sendWhatsApp, initialActionState);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Revisa mensajes nuevos cada 20 s mientras la pestaña está visible.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [router]);

  const open = windowHoursLeft !== null;

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <div className="chat" ref={listRef}>
        {messages.length === 0 && <div className="empty">Sin mensajes de WhatsApp.</div>}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.direction === 'in' ? 'msg-in' : 'msg-out'}`}>
            {m.body}
            <span className="msg-time">{formatDateTime(m.created_at)}</span>
          </div>
        ))}
      </div>

      {open ? (
        <div className="alert alert-info small">
          Ventana abierta: puedes escribir texto libre por {windowHoursLeft < 1 ? 'menos de 1 hora' : `${Math.floor(windowHoursLeft)} h más`}. WhatsApp solo permite texto libre dentro de las 24 h posteriores al último mensaje del cliente.
        </div>
      ) : (
        <div className="alert alert-warn small">
          Solo se puede escribir texto libre dentro de las 24 h posteriores al último mensaje del cliente. Ahora la ventana está cerrada: espera a que el cliente escriba o contáctalo por llamada.
        </div>
      )}

      {hasPhone ? (
        <form action={action} ref={formRef} className="stack" style={{ gap: '0.5rem' }}>
          <input type="hidden" name="lead_id" value={leadId} />
          <textarea name="body" rows={3} maxLength={4096} placeholder="Escribe una respuesta…" disabled={!open} required />
          <FormMessage state={state} />
          <div className="row-between">
            <button type="button" className="link-btn small" onClick={() => router.refresh()}>
              Actualizar
            </button>
            <SubmitButton pendingText="Enviando…" className="btn btn-primary">
              Enviar por WhatsApp
            </SubmitButton>
          </div>
        </form>
      ) : (
        <div className="muted small">El lead no tiene teléfono registrado.</div>
      )}
    </div>
  );
}
