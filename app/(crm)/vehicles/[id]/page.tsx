import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/strings';
import { formatDate, vehicleTitle } from '@/lib/format';
import { photoUrl } from '@/lib/storage';
import { VehicleForm } from '@/components/vehicle-form';
import { PhotoManager } from '@/components/photo-manager';
import { DeleteVehicleButton } from '@/components/delete-vehicle-button';
import { VehicleStatusBadge } from '@/components/status-badge';

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { nuevo?: string };
}) {
  if (!isUuid(params.id)) notFound();
  const supabase = createClient();
  const [{ data: vehicle }, { data: photos }] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('vehicle_photos').select('*').eq('vehicle_id', params.id).order('position').order('created_at'),
  ]);
  if (!vehicle) notFound();

  return (
    <>
      <Link href="/vehicles" className="back">
        ← Autos
      </Link>
      <div className="page-header">
        <div>
          <h1>{vehicleTitle(vehicle)}</h1>
          <div className="row small muted">
            <VehicleStatusBadge status={vehicle.status} />
            {vehicle.published && <span className="badge badge-ok">Publicado</span>}
            {vehicle.sold_at && <span>Vendido el {formatDate(vehicle.sold_at)}</span>}
          </div>
        </div>
      </div>

      {searchParams.nuevo && <div className="alert alert-ok" style={{ marginBottom: '1rem' }}>Auto creado. Ahora sube sus fotos.</div>}

      <div className="stack">
        <section className="card">
          <div className="card-title">
            <h2>Fotos</h2>
            <span className="muted small">{photos?.length ?? 0} fotos</span>
          </div>
          <PhotoManager
            vehicleId={vehicle.id}
            photos={(photos ?? []).map((p) => ({ id: p.id, url: photoUrl(p.path), is_cover: p.is_cover }))}
          />
        </section>

        <section className="card">
          <div className="card-title">
            <h2>Datos del auto</h2>
          </div>
          <VehicleForm vehicle={vehicle} />
        </section>

        <section className="card">
          <div className="row-between">
            <div>
              <h3 style={{ marginBottom: 2 }}>Eliminar auto</h3>
              <p className="muted small" style={{ margin: 0 }}>
                Borra el auto y todas sus fotos. Los leads asociados se conservan.
              </p>
            </div>
            <DeleteVehicleButton id={vehicle.id} />
          </div>
        </section>
      </div>
    </>
  );
}
