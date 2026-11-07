/**
 * תחליף ל-InteractionManager.runAfterInteractions (הוסר מ-react-native 0.88 — SDK 58).
 * אותו API ({ cancel }): מריץ כשה-JS פנוי (requestIdleCallback), עם תקרת זמן כדי שלא יידחה לנצח.
 */
type Task = () => void;

export function runAfterInteractions(
  task: Task,
  timeoutMs = 500,
  /** המתנה מינימלית לפני ההרצה — למשל סגירת מגירה (InteractionManager המקורי חיכה לסוף האנימציה) */
  minDelayMs = 0,
): { cancel: () => void } {
  let cancelled = false;
  let idleId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (!cancelled) task();
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  const cic = (globalThis as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
  const schedule = () => {
    if (cancelled) return;
    if (typeof ric === 'function') idleId = ric(run, { timeout: timeoutMs });
    else timer = setTimeout(run, 0);
  };
  if (minDelayMs > 0) timer = setTimeout(schedule, minDelayMs);
  else schedule();
  return {
    cancel: () => {
      cancelled = true;
      if (idleId != null) cic?.(idleId);
      if (timer != null) clearTimeout(timer);
    },
  };
}
