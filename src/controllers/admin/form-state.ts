/** What a form's server action returns to the admin view. */
export type FormState = { ok?: boolean; message?: string; error?: string };

export const saved = (message = 'Saved.'): FormState => ({ ok: true, message });
export const failed = (error: string): FormState => ({ error });
