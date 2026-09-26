/**
 * קצב/השהייה גלובליים לאורורה בשורש.
 * לא נוגע ב-GLSL — רק מתי ה-RAF רץ.
 */

type Listener = () => void;

let pauseCount = 0;
const listeners = new Set<Listener>();

/** רקע דקורטיבי — 20fps מספיק, 60fps גונב פריימים מגלילה/שיט/מקלדת. */
export const AURORA_ACTIVE_FPS = 20;
export const AURORA_FRAME_MS = 1000 / AURORA_ACTIVE_FPS;

export function isAuroraPaused(): boolean {
  return pauseCount > 0;
}

export function pauseAurora(): void {
  pauseCount += 1;
  if (pauseCount === 1) emit();
}

export function resumeAurora(): void {
  if (pauseCount === 0) return;
  pauseCount -= 1;
  if (pauseCount === 0) emit();
}

export function subscribeAuroraRuntime(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** בדיקות בלבד — מאפס מונה ומאזינים בין טסטים. */
export function resetAuroraRuntime(): void {
  pauseCount = 0;
  listeners.clear();
}
