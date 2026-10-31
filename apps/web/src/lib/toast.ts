export type ToastTone = 'success' | 'error';

/** Errors stay long enough to read and act on; confirmations pass quickly. */
const TOAST_MS: Record<ToastTone, number> = { success: 4000, error: 8000 };

export const toastDuration = (tone: ToastTone): number => TOAST_MS[tone];
