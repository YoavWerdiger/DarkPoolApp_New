// ============================================
// Voice Playback Controller — ניגון יחיד (WhatsApp-style)
// ============================================

type StopHandler = () => void | Promise<void>;

let activeId: string | null = null;
let activeStop: StopHandler | null = null;

/**
 * רושם נגן פעיל. אם כבר יש נגן אחר — עוצר אותו (כולל איפוס UI).
 */
export function claimVoicePlayback(id: string, onStop: StopHandler): void {
  if (activeId && activeId !== id && activeStop) {
    const prevStop = activeStop;
    activeId = id;
    activeStop = onStop;
    void Promise.resolve(prevStop()).catch(() => {});
    return;
  }
  activeId = id;
  activeStop = onStop;
}

/** משחרר את הרישום אם זה עדיין הנגן הפעיל. */
export function releaseVoicePlayback(id: string): void {
  if (activeId === id) {
    activeId = null;
    activeStop = null;
  }
}

/** האם המזהה הוא הנגן הפעיל כרגע. */
export function isActiveVoicePlayback(id: string): boolean {
  return activeId === id;
}
