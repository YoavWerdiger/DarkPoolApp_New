/**
 * דיבידר מסחר מוקדם / מאוחר — גלולה אטומה בצבע האייקון (כמו תגיות ה-CTA),
 * טקסט ואייקון בצבע מנוגד וקריא. בלי שקיפות / זכוכית.
 */
export type TradingSession = 'before' | 'after';

const SESSION = {
  // זהב מעט עמוק יותר כדי שטקסט לבן ייקרא — כמו הכחול של מסחר מאוחר
  before: { light: '#C7950F', dark: '#C99A12', fg: '#FFFFFF' },
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
