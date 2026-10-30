/**
 * צבע מותג של חברות ציבוריות (13F) — לרקע הכרטיס/הכותרת סביב הלוגו.
 * בהיר: גוון בהיר של הצבע; כהה: גוון כהה שלו. בלי צבע ידוע — כחול-פחם ניטרלי.
 */
const BRAND: Record<string, string> = {
  NVDA: '#76B900',
  GOOGL: '#4285F4',
  GOOG: '#4285F4',
  AMZN: '#FF9900',
  AMD: '#ED1C24',
  BABA: '#FF6A00',
  CSCO: '#049FD9',
  GE: '#3B73B9',
  GILD: '#C8102E',
  INTC: '#0071C5',
  JNJ: '#D51900',
  MRK: '#00857C',
  NTES: '#E60012',
  PFE: '#0093D0',
  REGN: '#003DA5',
  SNY: '#7A00E6',
  SFTBY: '#8C9399',
  TM: '#EB0A1E',
  UBER: '#276EF1',
  WMT: '#0071CE',
  AAPL: '#A2AAAD',
  MSFT: '#00A4EF',
  META: '#0866FF',
  TSLA: '#E31937',
};

const NEUTRAL_DARK: [string, string] = ['#1E2A3A', '#0B0F15'];
const NEUTRAL_LIGHT: [string, string] = ['#E8EDF3', '#D5DDE7'];

function mix(hex: string, target: [number, number, number], amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c: number, t: number) => Math.round(c + (t - c) * amount);
  const out = (m(r, target[0]) << 16) | (m(g, target[1]) << 8) | m(b, target[2]);
  return `#${out.toString(16).padStart(6, '0')}`;
}

/** שתי עצירות לגרדיאנט: בהיר — הצבע מעורבב בלבן; כהה — מעורבב בשחור */
export function companyBrandGradient(ticker: string | null | undefined, dark: boolean): [string, string] {
  const hex = ticker ? BRAND[ticker.trim().toUpperCase()] : undefined;
  if (!hex) return dark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  return dark
    ? [mix(hex, [0, 0, 0], 0.62), mix(hex, [0, 0, 0], 0.82)]
    : [mix(hex, [255, 255, 255], 0.52), mix(hex, [255, 255, 255], 0.66)];
}
