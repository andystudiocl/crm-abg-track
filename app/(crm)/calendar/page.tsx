import { createClient, getUser } from '@/lib/supabase/server';
import { getAdvisorOptions, getVehicleOptions } from '@/lib/options';
import { getUpcomingAppointments, nextHourDefault } from '@/lib/appointments';
import { googleConfigured } from '@/lib/google';
import { toSantiagoLocalInput } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { AppointmentForm } from '@/components/appointment-form';
import { AppointmentList } from '@/components/appointment-list';
import { GoogleConnect } from '@/components/google-connect';

export const metadata = { title: 'Agenda · ABG CRM' };

const GOOGLE_MSG: Record<string, { cls: string; text: string }> = {
  ok: { cls: 'alert-ok', text: 'Google Calendar conectado. Las nuevas reuniones se crearán en tu calendario.' },
  error: { cls: 'alert-error', text: 'No se pudo conectar Google Calendar. Intenta de nuevo.' },
  sin_token: {
    cls: 'alert-error',
    text: 'Google no entregó permiso permanente. Quita el acceso de «ABG CRM» en myaccount.google.com/permissions y vuelve a conectar.',
  },
};

export default async function CalendarPage({ searchParams }: { searchParams: { google?: string } }) {
  const supabase = createClient();
  const user = await getUser();

  const [{ data: me }, advisors, vehicles, appointments, { data: leads }] = await Promise.all([
    supabase.from('advisors').select('google_connected').eq('id', user?.id ?? '').maybeSingle(),
    getAdvisorOptions(supabase),
    getVehicleOptions(supabase),
    getUpcomingAppointments(supabase),
    supabase
      .from('leads')
      .select('id, name, phone')
      .not('status', 'in', '(ganado,perdido)')
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const leadOptions = (leads ?? []).map((l) => ({
    value: l.id,
    label: `${l.name || 'Sin nombre'}${l.phone ? ` · ${formatPhone(l.phone)}` : ''}`,
  }));
  const notice = searchParams.google ? GOOGLE_MSG[searchParams.google] : undefined;

  return (
    <>
      <div className="page-header">
        <h1>Agenda</h1>
        <GoogleConnect connected={me?.google_connected ?? false} configured={googleConfigured()} />
      </div>
      {notice && <div className={`alert ${notice.cls}`} style={{ marginBottom: '1rem' }}>{notice.text}</div>}

      <div className="detail-layout">
        <section className="card">
          <div className="card-title">
            <h2>Próximas reuniones</h2>
            <span className="muted small">{appointments.length}</span>
          </div>
          <AppointmentList items={appointments} />
        </section>
        <section className="card">
          <div className="card-title">
            <h2>Agendar reunión</h2>
          </div>
          <AppointmentForm
            leads={leadOptions}
            advisors={advisors}
            vehicles={vehicles}
            defaultAdvisorId={user?.id ?? ''}
            defaultStart={toSantiagoLocalInput(nextHourDefault())}
          />
        </section>
      </div>
    </>
  );
}
