'use client';

import { useFormState } from 'react-dom';
import { saveVehicle } from '@/actions/vehicles';
import { initialActionState } from '@/lib/types';
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABEL } from '@/lib/format';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { VehicleRow } from '@/lib/database.types';

const COMBUSTIBLES = ['Bencina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico'];
const TRANSMISIONES = ['Automática', 'Manual'];

export function VehicleForm({ vehicle }: { vehicle?: VehicleRow }) {
  const [state, action] = useFormState(saveVehicle, initialActionState);
  const v = vehicle;
  const thousands = (n: number | undefined) => (n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

  return (
    // key: remonta los campos tras guardar para reflejar cambios hechos por el servidor (ej. despublicar).
    <form action={action} className="stack" key={v?.updated_at ?? 'new'}>
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="marca">Marca *</label>
          <input id="marca" name="marca" type="text" required maxLength={60} defaultValue={v?.marca} placeholder="Porsche" />
        </div>
        <div className="field">
          <label htmlFor="modelo">Modelo *</label>
          <input id="modelo" name="modelo" type="text" required maxLength={80} defaultValue={v?.modelo} placeholder="911" />
        </div>
        <div className="field">
          <label htmlFor="version">Versión</label>
          <input id="version" name="version" type="text" maxLength={120} defaultValue={v?.version ?? ''} placeholder="Carrera S" />
        </div>
        <div className="field">
          <label htmlFor="anio">Año *</label>
          <input id="anio" name="anio" type="number" inputMode="numeric" required min={1950} max={2100} defaultValue={v?.anio} />
        </div>
        <div className="field">
          <label htmlFor="km">Kilometraje</label>
          <input id="km" name="km" type="text" inputMode="numeric" defaultValue={thousands(v?.km)} placeholder="25.000" />
        </div>
        <div className="field">
          <label htmlFor="precio_clp">Precio (CLP)</label>
          <input id="precio_clp" name="precio_clp" type="text" inputMode="numeric" defaultValue={thousands(v?.precio_clp)} placeholder="12.990.000" />
        </div>
        <div className="field">
          <label htmlFor="combustible">Combustible</label>
          <select id="combustible" name="combustible" defaultValue={v?.combustible ?? ''}>
            <option value="">—</option>
            {COMBUSTIBLES.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {v?.combustible && !COMBUSTIBLES.includes(v.combustible) && <option>{v.combustible}</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor="transmision">Transmisión</label>
          <select id="transmision" name="transmision" defaultValue={v?.transmision ?? ''}>
            <option value="">—</option>
            {TRANSMISIONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
            {v?.transmision && !TRANSMISIONES.includes(v.transmision) && <option>{v.transmision}</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor="color">Color</label>
          <input id="color" name="color" type="text" maxLength={40} defaultValue={v?.color ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="patente">Patente</label>
          <input id="patente" name="patente" type="text" maxLength={12} defaultValue={v?.patente ?? ''} placeholder="ABCD12" style={{ textTransform: 'uppercase' }} />
        </div>
        <div className="field">
          <label htmlFor="status">Estado</label>
          <select id="status" name="status" defaultValue={v?.status ?? 'disponible'}>
            {VEHICLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="arrived_at">Fecha de llegada</label>
          <input id="arrived_at" name="arrived_at" type="date" defaultValue={v?.arrived_at ?? ''} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="descripcion">Descripción</label>
        <textarea id="descripcion" name="descripcion" maxLength={5000} rows={5} defaultValue={v?.descripcion ?? ''} />
      </div>
      <label className="checkbox">
        <input type="checkbox" name="published" defaultChecked={v?.published ?? false} />
        Publicar en el sitio web
      </label>
      <p className="muted small" style={{ margin: 0 }}>
        Al marcarlo como vendido se registra la fecha de venta y se despublica automáticamente.
      </p>
      <FormMessage state={state} />
      <div className="form-actions">
        <SubmitButton pendingText="Guardando…">{v ? 'Guardar cambios' : 'Crear auto'}</SubmitButton>
      </div>
    </form>
  );
}
