/**
 * תחליף ל-InteractionManager.runAfterInteractions (הוסר מ-react-native 0.88 — SDK 58).
 * אותו API ({ cancel }): מריץ כשה-JS פנוי (requestIdleCallback), עם תקרת זמן כדי שלא יידחה לנצח.
 */
type Task = () => void;

export function runAfterInteractions(task: Task, timeoutMs = 500): { cancel: () => void } {
  let cancelled = false;
  const run = () => {
    if (!cancelled) task();
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  const cic = (globalThis as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(run, { timeout: timeoutMs });
    return {
      cancel: () => {
        cancelled = true;
        cic?.(id);
      },
    };
  }
  const t = setTimeout(run, 0);
  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(t);
    },
  };
}
