// Hook de resolución solo para pruebas: imita lo que hace Next con 'server-only' y el alias '@/'.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(spec, ctx, next) {
  if (spec === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (spec.startsWith('@/')) return { url: pathToFileURL(path.join(root, spec.slice(2) + '.ts')).href, shortCircuit: true };
  return next(spec, ctx);
}
