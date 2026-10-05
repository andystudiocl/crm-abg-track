import Link from 'next/link';
import { VehicleForm } from '@/components/vehicle-form';

export const metadata = { title: 'Ingresar auto · ABG CRM' };

export default function NewVehiclePage() {
  return (
    <>
      <Link href="/vehicles" className="back">
        ← Autos
      </Link>
      <div className="page-header">
        <h1>Ingresar auto</h1>
      </div>
      <div className="card">
        <VehicleForm />
      </div>
      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        Después de crear el auto podrás subir sus fotos.
      </p>
    </>
  );
}
