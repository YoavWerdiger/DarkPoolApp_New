/**
 * דיבידר מסחר מוקדם / מאוחר — גלולה אטומה בצבע האייקון (כמו תגיות ה-CTA),
 * טקסט ואייקון בצבע מנוגד וקריא. בלי שקיפות / זכוכית.
 */
export type TradingSession = 'before' | 'after';

const SESSION = {
  // צהוב (לא זהב/חרדל) — טקסט לבן כמו הכחול של מסחר מאוחר
  before: { light: '#F5B400', dark: '#F5B400', fg: '#FFFFFF' },
  after: { light: '#007AFF', dark: '#0A84FF', fg: '#FFFFFF' },
} as const;

/** צבע אייקון / טקסט של זמן הדיווח (לפני / אחרי המסחר) — מקור אחד לכל מסכי הדוחות */
export const SESSION_ACCENT = {
  before: '#D1A11D',
  after: '#007AFF',
} as const;

export function sessionPillColors(session: TradingSession, isDark: boolean) {
  const c = SESSION[session];
  return {
    icon: c.fg,
    text: c.fg,
    background: isDark ? c.dark : c.light,
    border: 'transparent',
  };
}
