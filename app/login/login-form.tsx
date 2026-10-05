'use client';

import { useFormState } from 'react-dom';
import { signIn } from '@/actions/auth';
import { initialActionState } from '@/lib/types';
import { SubmitButton } from '@/components/submit-button';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(signIn, initialActionState);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <SubmitButton className="btn btn-primary btn-block" pendingText="Ingresando…">
        Ingresar
      </SubmitButton>
    </form>
  );
}
