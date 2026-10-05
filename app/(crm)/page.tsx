import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUpcomingAppointments } from '@/lib/appointments';
import { LEAD_SOURCE_LABEL, formatDateTime, vehicleTitle } from '@/lib/format';
import { LeadStatusBadge } from '@/components/status-badge';
import { AppointmentList } from '@/components/appointment-list';

export const metadata = { title: 'Resumen · ABG CRM' };

export default async function HomePage() {
  const supabase = createClient();
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const count = { count: 'exact' as const, head: true };

  const [week, uncontacted, available, sold, { data: latest }, appointments] = await Promise.all([
    supabase.from('leads').select('id', count).gte('created_at', days(7)),
    supabase.from('leads').select('id', count).eq('status', 'nuevo'),
    supabase.from('vehicles').select('id', count).eq('status', 'disponible'),
    supabase.from('vehicles').select('id', count).eq('status', 'vendido').gte('sold_at', days(30)),
    supabase
      .from('leads')
      .select('id, name, source, status, created_at, vehicle:vehicles(marca, modelo, version, anio), advisor:advisors(name, email)')
      .order('created_at', { ascending: false })
      .limit(8),
    getUpcomingAppointments(supabase, { limit: 6 }),
  ]);

  const stats = [
    { label: 'Leads últimos 7 días', value: week.count, href: '/leads' },
    { label: 'Leads sin contactar', value: uncontacted.count, href: '/leads' },
    { label: 'Autos disponibles', value: available.count, href: '/vehicles?estado=disponible' },
    { label: 'Vendidos en 30 días', value: sold.count, href: '/vehicles?estado=vendido' },
  ];
  const failed = [week, uncontacted, available, sold].some((r) => r.error);

  return (
    <>
      <div className="page-header">
        <h1>Resumen</h1>
      </div>
      {failed && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>Algunos indicadores no se pudieron cargar.</div>}

      <div className="stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="stat" style={{ color: 'inherit' }}>
            <div className="stat-value">{s.value ?? '—'}</div>
            <div className="stat-label">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="detail-layout">
        <section className="card">
          <div className="card-title">
            <h2>Últimos leads</h2>
            <Link href="/leads" className="small">
              Ver todos
            </Link>
          </div>
          {!latest?.length ? (
            <div className="empty">Aún no hay leads.</div>
          ) : (
            <ul className="list">
              {latest.map((l) => (
                <li key={l.id}>
                  <div className="row-between">
                    <Link href={`/leads/${l.id}`} style={{ fontWeight: 600 }}>
                      {l.name || 'Sin nombre'}
                    </Link>
                    <LeadStatusBadge status={l.status} />
                  </div>
                  <div className="muted small">
                    {[
                      LEAD_SOURCE_LABEL[l.source],
                      l.vehicle ? vehicleTitle(l.vehicle) : null,
                      l.advisor ? l.advisor.name || l.advisor.email : 'Sin asesor',
                      formatDateTime(l.created_at),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>Próximas reuniones</h2>
            <Link href="/calendar" className="small">
              Agenda
            </Link>
          </div>
          <AppointmentList items={appointments} />
        </section>
      </div>
    </>
  );
}
