import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { getAdvisorOptions, getVehicleOptions } from '@/lib/options';
import { isUuid } from '@/lib/strings';
import { formatPhone } from '@/lib/phone';
import { LEAD_SOURCE_LABEL, formatCLP, formatDateTime, toSantiagoLocalInput, vehicleTitle } from '@/lib/format';
import { LeadStatusBadge } from '@/components/status-badge';
import { LeadEditForm } from '@/components/lead-edit-form';
import { DeleteLeadButton } from '@/components/delete-lead-button';
import { WhatsAppChat } from '@/components/whatsapp-chat';
import { WINDOW_MS } from '@/lib/whatsapp';
import { getUpcomingAppointments, nextHourDefault } from '@/lib/appointments';
import { AppointmentForm } from '@/components/appointment-form';
import { AppointmentList } from '@/components/appointment-list';

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { existente?: string };
}) {
  if (!isUuid(params.id)) notFound();
  const supabase = createClient();

  const { data: lead } = await supabase.from('leads').select('*').eq('id', params.id).maybeSingle();
  if (!lead) notFound();

  const [advisors, vehicles, { data: vehicle }, { data: messages }, appointments, user] = await Promise.all([
    getAdvisorOptions(supabase),
    getVehicleOptions(supabase, lead.vehicle_id),
    lead.vehicle_id
      ? supabase.from('vehicles').select('id, marca, modelo, version, anio, precio_clp').eq('id', lead.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('lead_messages')
      .select('id, direction, body, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(300),
    getUpcomingAppointments(supabase, { leadId: lead.id }),
    getUser(),
  ]);

  const sinceLast = lead.last_message_at ? Date.now() - new Date(lead.last_message_at).getTime() : null;
  const windowHoursLeft = sinceLast !== null && sinceLast < WINDOW_MS ? (WINDOW_MS - sinceLast) / 3_600_000 : null;

  return (
    <>
      <Link href="/leads" className="back">
        ← Leads
      </Link>
      <div className="page-header">
        <div>
          <h1>{lead.name || 'Sin nombre'}</h1>
          <div className="row small muted">
            <LeadStatusBadge status={lead.status} />
            <span>{LEAD_SOURCE_LABEL[lead.source]}</span>
            <span>· Ingresó {formatDateTime(lead.created_at)}</span>
          </div>
        </div>
      </div>

      {searchParams.existente && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Ya existía un lead con ese teléfono. Se completaron los datos que faltaban.
        </div>
      )}

      <div className="detail-layout">
        <div className="stack">
          <section className="card">
            <div className="card-title">
              <h2>Contacto</h2>
            </div>
            <dl className="kv">
              <dt>Teléfono</dt>
              <dd>{lead.phone ? <a href={`tel:+${lead.phone}`}>{formatPhone(lead.phone)}</a> : '—'}</dd>
              <dt>Correo</dt>
              <dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</dd>
              <dt>Auto</dt>
              <dd>
                {vehicle ? (
                  <Link href={`/vehicles/${vehicle.id}`}>
                    {vehicleTitle(vehicle)} · {formatCLP(vehicle.precio_clp)}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              {lead.campaign && (
                <>
                  <dt>Campaña</dt>
                  <dd>{lead.campaign}</dd>
                </>
              )}
            </dl>
            {lead.phone && (
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <a className="btn btn-sm" href={`tel:+${lead.phone}`}>
                  Llamar
                </a>
                <a className="btn btn-sm" href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer">
                  Abrir en WhatsApp
                </a>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-title">
              <h2>Gestión</h2>
            </div>
            <LeadEditForm lead={lead} advisors={advisors} vehicles={vehicles} />
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-title">
              <h2>WhatsApp</h2>
            </div>
            <WhatsAppChat
              leadId={lead.id}
              messages={messages ?? []}
              hasPhone={Boolean(lead.phone)}
              windowHoursLeft={windowHoursLeft}
            />
          </section>
          <section className="card">
            <div className="card-title">
              <h2>Reuniones</h2>
            </div>
            <AppointmentList items={appointments} showLead={false} />
            <h3 style={{ margin: '1rem 0 0.5rem' }}>Agendar reunión</h3>
            <AppointmentForm
              leadId={lead.id}
              advisors={advisors}
              vehicles={vehicles}
              defaultAdvisorId={lead.advisor_id ?? user?.id ?? ''}
              defaultStart={toSantiagoLocalInput(nextHourDefault())}
            />
          </section>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <DeleteLeadButton id={lead.id} />
          </div>
        </div>
      </div>
    </>
  );
}
