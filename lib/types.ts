/** Resultado estándar de las Server Actions usado por los formularios. */
export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export const initialActionState: ActionState = { ok: false };
