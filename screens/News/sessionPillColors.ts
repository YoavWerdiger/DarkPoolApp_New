/**
 * דיבידר מסחר מוקדם / מאוחר — גלולה אטומה בצבע האייקון (כמו תגיות ה-CTA),
 * טקסט ואייקון בצבע מנוגד וקריא. בלי שקיפות / זכוכית.
 */
export type TradingSession = 'before' | 'after';

const SESSION = {
  before: { light: '#D1A11D', dark: '#D9AA22', fg: '#1A1405' },
  after: { light: '#007AFF', dark: '#0A84FF', fg: '#FFFFFF' },
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
