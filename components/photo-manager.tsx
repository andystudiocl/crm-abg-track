'use client';

import { useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VEHICLE_BUCKET } from '@/lib/storage';
import { deletePhoto, movePhoto, registerPhoto, setCoverPhoto } from '@/actions/vehicles';

type Photo = { id: string; url: string; is_cover: boolean };

const MAX_SIDE = 1920;
const QUALITY = 0.85;
const MAX_FILES = 40;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Formato de imagen no soportado'));
    };
    img.src = url;
  });
}

/** Reduce a máx. 1920 px por lado y convierte a JPEG 0,85 en el navegador. */
async function resizeToJpeg(file: File): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadImageElement(file);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar imágenes');
  ctx.fillStyle = '#ffffff'; // fondo para PNG con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if ('close' in source) source.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', QUALITY),
  );
}

export function PhotoManager({ vehicleId, photos }: { vehicleId: string; photos: Photo[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    if (files.length > MAX_FILES) {
      setErrors([`Puedes subir hasta ${MAX_FILES} fotos a la vez.`]);
      return;
    }
    const supabase = createClient();
    const failed: string[] = [];
    setErrors([]);

    // En serie: el progreso es claro y las posiciones quedan en el orden elegido.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });
      try {
        const blob = await resizeToJpeg(file);
        const path = `${vehicleId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(VEHICLE_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
        if (error) throw new Error('error al subir');
        const res = await registerPhoto(vehicleId, path);
        if (!res.ok) {
          await supabase.storage.from(VEHICLE_BUCKET).remove([path]);
          throw new Error(res.error ?? 'error al registrar');
        }
      } catch (e) {
        failed.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setProgress(null);
    setErrors(failed);
    if (inputRef.current) inputRef.current.value = '';
  }

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setErrors([]);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setErrors([res.error ?? 'Ocurrió un error.']);
      setBusyId(null);
    });
  }

  const uploading = progress !== null;

  return (
    <div className="stack">
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) void upload(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        <button type="button" className="btn btn-primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? `Subiendo ${progress.current} de ${progress.total}…` : 'Subir fotos'}
        </button>
        <div className="small" style={{ marginTop: 6 }}>
          o arrástralas aquí. Se reducen a 1920 px antes de subir.
        </div>
        {uploading && (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="alert alert-error">
          {errors.length === 1 ? errors[0] : (
            <>
              No se pudieron subir {errors.length} fotos:
              <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem' }}>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="empty">Este auto aún no tiene fotos.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((p, i) => {
            const busy = busyId === p.id;
            return (
              <div key={p.id} className={`photo${p.is_cover ? ' is-cover' : ''}`} style={{ opacity: busy ? 0.5 : 1 }}>
                <img src={p.url} alt={`Foto ${i + 1}`} loading="lazy" />
                {p.is_cover && <span className="badge badge-gold photo-tag">Portada</span>}
                <div className="photo-actions">
                  <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn" title="Mover antes" disabled={busy || i === 0} onClick={() => run(p.id, () => movePhoto(p.id, 'up'))}>
                      ↑
                    </button>
                    <button type="button" className="btn" title="Mover después" disabled={busy || i === photos.length - 1} onClick={() => run(p.id, () => movePhoto(p.id, 'down'))}>
                      ↓
                    </button>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {!p.is_cover && (
                      <button type="button" className="btn" disabled={busy} onClick={() => run(p.id, () => setCoverPhoto(p.id))}>
                        Portada
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger"
                      title="Borrar foto"
                      disabled={busy}
                      onClick={() => {
                        if (confirm('¿Borrar esta foto?')) run(p.id, () => deletePhoto(p.id));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
