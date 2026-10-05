import type { ActionState } from '@/lib/types';

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <div className="alert alert-error">{state.error}</div>;
  if (state.ok && state.message) return <div className="alert alert-ok">{state.message}</div>;
  return null;
}
