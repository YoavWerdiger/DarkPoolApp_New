import { addBreadcrumb } from './sentry';

/**
 * שגיאה שמותר לבלוע (ניקוי, cache, פעולת רקע) — לא שולחים אירוע ל-Sentry,
 * אבל משאירים breadcrumb כדי שאם תהיה תקלה אמיתית אחר כך, יראו מה קדם לה (פריט 24).
 */
export function noteError(tag: string, error: unknown): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    addBreadcrumb('silent-error', tag, { message: message.slice(0, 200) });
    if (__DEV__) console.warn(`[silent] ${tag}:`, message);
  } catch {
    // אסור ש-breadcrumb יפיל משהו
  }
}

/** ל-promise: somePromise.catch(silent('tag')) במקום .catch(() => {}) */
export function silent(tag: string): (error: unknown) => void {
  return (error) => noteError(tag, error);
}
