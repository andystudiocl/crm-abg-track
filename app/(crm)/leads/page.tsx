import Link from 'next/link';
import { createClient, getUser } from '@/lib/supabase/server';
import { getAdvisorOptions, getVehicleOptions } from '@/lib/options';
import { isUuid } from '@/lib/strings';
import { vehicleTitle } from '@/lib/format';
import { LeadBoard, type BoardLead } from '@/components/lead-board';
import { NewLeadForm } from '@/components/new-lead-form';

export const metadata = { title: 'Leads · ABG CRM' };

export default async function LeadsPage({ searchParams }: { searchParams: { q?: string; asesor?: string } }) {
  const supabase = createClient();
  const user = await getUser();
  // Solo letras, números y algunos símbolos: evita romper el filtro .or() de PostgREST.
  const q = (searchParams.q ?? '').replace(/[^\p{L}\p{N} @.+_-]/gu, '').trim().slice(0, 60);
  const asesor = searchParams.asesor === 'yo' ? user?.id : isUuid(searchParams.asesor) ? searchParams.asesor : null;

  let query = supabase
    .from('leads')
    .select('id, name, source, status, created_at, vehicle:vehicles(marca, modelo, version, anio), advisor:advisors(name, email)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q.replace(/\D/g, '') || q}%,email.ilike.%${q}%`);
  if (asesor) query = query.eq('advisor_id', asesor);

  const [{ data, error }, advisors, vehicles] = await Promise.all([
    query,
    getAdvisorOptions(supabase),
    getVehicleOptions(supabase),
  ]);

  const leads: BoardLead[] = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    source: l.source,
    status: l.status,
    created_at: l.created_at,
    vehicle: l.vehicle ? vehicleTitle(l.vehicle) : null,
    advisor: l.advisor ? l.advisor.name || l.advisor.email : null,
  }));

  return (
    <>
      <div className="page-header">
        <h1>Leads</h1>
      </div>

      <details className="collapsible">
        <summary>Nuevo lead manual</summary>
        <div className="collapsible-body">
          <NewLeadForm advisors={advisors} vehicles={vehicles} currentAdvisorId={user?.id ?? ''} />
        </div>
      </details>

      <form className="row" style={{ marginBottom: '1rem' }} action="/leads">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o correo" style={{ flex: '1 1 220px', width: 'auto' }} />
        <select name="asesor" defaultValue={searchParams.asesor ?? ''} style={{ flex: '0 1 200px', width: 'auto' }}>
          <option value="">Todos los asesores</option>
          <option value="yo">Mis leads</option>
          {advisors.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Filtrar
        </button>
        {(q || asesor) && (
          <Link href="/leads" className="btn btn-ghost">
            Limpiar
          </Link>
        )}
      </form>

      {error ? <div className="alert alert-error">No se pudieron cargar los leads.</div> : <LeadBoard leads={leads} />}
    </>
  );
}
