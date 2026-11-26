/**
 * מצב המסחר בוול סטריט (NYSE/Nasdaq), עם ספירה לאחור — לפי שעון ניו יורק, מוצג בשעון ישראל.
 * לא כולל חגים בארה"ב (מוצג «פתוח» גם בחג); מספיק לחיווי בכותרת ובמסך הבית.
 */
export type MarketPhase = 'pre' | 'open' | 'after' | 'closed';

export type MarketSession = {
  phase: MarketPhase;
  /** מתי המצב הבא מתחיל (ms) */
  nextChangeAt: number;
  nextPhase: MarketPhase;
};

const PRE_START = 4 * 60;
const OPEN_START = 9 * 60 + 30;
const CLOSE = 16 * 60;
const AFTER_END = 20 * 60;

function nyParts(ms: number): { weekday: number; minutes: number; seconds: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hour = Number(parts.hour) % 24;
  return { weekday, minutes: hour * 60 + Number(parts.minute), seconds: Number(parts.second) };
}

/** דקות עד יום מסחר הבא ב-PRE_START (מדלג על סופ״ש) */
function minutesToNextPre(weekday: number, minutes: number): number {
  let days = 1;
  let wd = (weekday + 1) % 7;
  while (wd === 0 || wd === 6) {
    days += 1;
    wd = (wd + 1) % 7;
  }
  return days * 1440 - minutes + PRE_START;
}

export function getMarketSession(now: number = Date.now()): MarketSession {
  const { weekday, minutes, seconds } = nyParts(now);
  const base = now - seconds * 1000;
  const at = (deltaMin: number) => base + deltaMin * 60_000;
  const weekend = weekday === 0 || weekday === 6;
  if (!weekend && minutes >= PRE_START && minutes < OPEN_START) {
    return { phase: 'pre', nextPhase: 'open', nextChangeAt: at(OPEN_START - minutes) };
  }
  if (!weekend && minutes >= OPEN_START && minutes < CLOSE) {
    return { phase: 'open', nextPhase: 'after', nextChangeAt: at(CLOSE - minutes) };
  }
  if (!weekend && minutes >= CLOSE && minutes < AFTER_END) {
    return { phase: 'after', nextPhase: 'closed', nextChangeAt: at(AFTER_END - minutes) };
  }
  if (!weekend && minutes < PRE_START) {
    return { phase: 'closed', nextPhase: 'pre', nextChangeAt: at(PRE_START - minutes) };
  }
  return { phase: 'closed', nextPhase: 'pre', nextChangeAt: at(minutesToNextPre(weekday, minutes)) };
}

export const MARKET_PHASE_LABEL: Record<MarketPhase, string> = {
  pre: 'מסחר מוקדם (Pre)',
  open: 'השוק פתוח',
  after: 'מסחר מאוחר (After)',
  closed: 'השוק סגור',
};

/** «בעוד 2:15 שע׳» / «בעוד 12 דק׳» */
export function formatUntil(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return d === 1 ? 'בעוד יום' : d === 2 ? 'בעוד יומיים' : `בעוד ${d} ימים`;
  }
  if (h > 0) return `בעוד ${h}:${String(m).padStart(2, '0')} שע׳`;
  return `בעוד ${m} דק׳`;
}

/** שעה בשעון ישראל, למשל 16:30 */
export function israelTime(ms: number): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}
