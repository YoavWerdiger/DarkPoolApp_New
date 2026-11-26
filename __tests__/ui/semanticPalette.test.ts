import { createDesignTokensForTheme } from '../../components/ui/designTokensStatic';

/**
 * פריטים 45–46: הפלטה הסמנטית נעולה — שינוי ערך מחייב לעדכן כאן במכוון,
 * וכל צבע טקסט סמנטי חייב ניגודיות 4.5:1 (WCAG AA) מול הקנבס ומול הכרטיס, בשתי ערכות הנושא.
 */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const isHex = (c: string) => /^#[0-9A-Fa-f]{6}$/.test(c);

describe.each([
  ['dark', true],
  ['light', false],
])('semantic palette — %s', (_name, isDark) => {
  const t = createDesignTokensForTheme(isDark);
  const backgrounds = [t.colors.neutral[0], t.colors.neutral[1]];

  it('market and status colors pass 4.5:1 on canvas and card', () => {
    const texts = { ...t.colors.market, ...t.colors.status } as Record<string, string>;
    for (const [name, color] of Object.entries(texts)) {
      if (!isHex(color)) continue; // rgba (flat בלייט) — שקיפות מעל רקע, נבדק ידנית
      for (const bg of backgrounds) {
        // name / bg בהודעת הכישלון
        expect([name, bg, contrast(color, bg) >= 4.5]).toEqual([name, bg, true]);
      }
    }
  });

  it('gain and loss differ from success and danger (prices are not statuses)', () => {
    expect(t.colors.market.gain).not.toBe(t.colors.status.success);
    expect(t.colors.market.loss).not.toBe(t.colors.status.danger);
  });

  it('neutral scale has 8 steps from canvas to primary text', () => {
    expect(Object.keys(t.colors.neutral)).toHaveLength(8);
    expect(t.colors.neutral[0]).toBe(t.colors.background.primary);
    expect(t.colors.neutral[7]).toBe(t.colors.text.primary);
  });
});

describe('locked values', () => {
  it('dark', () => {
    const c = createDesignTokensForTheme(true).colors;
    expect(c.market).toEqual({ gain: '#00C805', loss: '#EF4444', extended: '#A78BFA', flat: '#A0A0A0' });
    expect(c.status).toEqual({ success: '#6EE7A0', danger: '#F87171', warning: '#E8B56A', info: '#7B96F2' });
  });
  it('light', () => {
    const c = createDesignTokensForTheme(false).colors;
    expect(c.market).toEqual({ gain: '#007A35', loss: '#C62828', extended: '#7C3AED', flat: 'rgba(0, 0, 0, 0.65)' });
    expect(c.status).toEqual({ success: '#166534', danger: '#B91C1C', warning: '#8A5A00', info: '#3B5BDB' });
  });
  it('onMedia is theme-independent', () => {
    expect(createDesignTokensForTheme(true).colors.onMedia).toEqual(createDesignTokensForTheme(false).colors.onMedia);
  });
});
