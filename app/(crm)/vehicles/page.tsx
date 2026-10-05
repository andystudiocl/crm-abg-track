import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCLP, formatKm, VEHICLE_STATUSES, VEHICLE_STATUS_LABEL } from '@/lib/format';
import { coverPath, photoUrl } from '@/lib/storage';
import { VehicleStatusBadge } from '@/components/status-badge';
import type { VehicleStatus } from '@/lib/database.types';

export const metadata = { title: 'Autos · ABG CRM' };

export default async function VehiclesPage({ searchParams }: { searchParams: { estado?: string } }) {
  const filter = (VEHICLE_STATUSES as string[]).includes(searchParams.estado ?? '')
    ? (searchParams.estado as VehicleStatus)
    : null;

  const supabase = createClient();
  let query = supabase
    .from('vehicles')
    .select('id, marca, modelo, version, anio, km, precio_clp, status, published, vehicle_photos(path, position, is_cover)')
    .order('created_at', { ascending: false });
  if (filter) query = query.eq('status', filter);
  const { data: vehicles, error } = await query;

  return (
    <>
      <div className="page-header">
        <h1>Autos</h1>
        <Link href="/vehicles/new" className="btn btn-primary">
          + Ingresar auto
        </Link>
      </div>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <Link href="/vehicles" className={`btn btn-sm ${!filter ? 'btn-primary' : 'btn-ghost'}`}>
          Todos
        </Link>
        {VEHICLE_STATUSES.map((s) => (
          <Link key={s} href={`/vehicles?estado=${s}`} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}>
            {VEHICLE_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {error && <div className="alert alert-error">No se pudo cargar el inventario.</div>}
      {vehicles && vehicles.length === 0 && <div className="card empty">No hay autos {filter ? 'con este estado' : 'todavía'}.</div>}

      {vehicles && vehicles.length > 0 && (
        <>
          <div className="table-wrap vehicle-table">
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Auto</th>
                  <th>Año</th>
                  <th>Km</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Web</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const cover = coverPath(v.vehicle_photos);
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/vehicles/${v.id}`}>
                          {cover ? (
                            <img className="thumb" src={photoUrl(cover)} alt="" loading="lazy" />
                          ) : (
                            <div className="thumb-empty">Sin foto</div>
                          )}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/vehicles/${v.id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>
                          {v.marca} {v.modelo}
                        </Link>
                        {v.version && <div className="muted small">{v.version}</div>}
                      </td>
                      <td>{v.anio}</td>
                      <td className="nowrap">{formatKm(v.km)}</td>
                      <td className="nowrap">{formatCLP(v.precio_clp)}</td>
                      <td>
                        <VehicleStatusBadge status={v.status} />
                      </td>
                      <td>{v.published ? <span className="badge badge-ok">Publicado</span> : <span className="badge">No</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="vehicle-cards">
            {vehicles.map((v) => {
              const cover = coverPath(v.vehicle_photos);
              return (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="vehicle-card">
                  {cover ? (
                    <img className="thumb" src={photoUrl(cover)} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-empty">Sin foto</div>
                  )}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {v.marca} {v.modelo} {v.anio}
                    </div>
                    <div className="muted small">
                      {formatKm(v.km)} · {formatCLP(v.precio_clp)}
                    </div>
                    <div className="row" style={{ marginTop: 4 }}>
                      <VehicleStatusBadge status={v.status} />
                      {v.published && <span className="badge badge-ok">Web</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
