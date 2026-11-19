/**
 * דיבידר מסחר מוקדם / מאוחר — הגלולה צבועה בצבע האייקון:
 * רקע שקוף של הצבע, קו מתאר עדין, והטקסט בגוון שקריא בכל ערכה.
 */
export type TradingSession = 'before' | 'after';

const SESSION = {
  before: { icon: '#D1A11D', rgb: '209,161,29', textLight: '#8A6408', textDark: '#F2C94C' },
  after: { icon: '#007AFF', rgb: '0,122,255', textLight: '#0058C2', textDark: '#64AEFF' },
} as const;

export function sessionPillColors(session: TradingSession, isDark: boolean) {
  const c = SESSION[session];
  return {
    icon: isDark ? c.textDark : c.icon,
    text: isDark ? c.textDark : c.textLight,
    background: `rgba(${c.rgb},${isDark ? 0.16 : 0.12})`,
    border: `rgba(${c.rgb},${isDark ? 0.32 : 0.26})`,
  };
}
