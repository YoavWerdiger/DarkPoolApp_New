import { readFileSync } from 'fs';
import { join } from 'path';
import { Platform } from 'react-native';
import {
  SHEET_ANDROID_MIN_BOTTOM_INSET,
  SHEET_ANDROID_BOTTOM_EXTRA,
  SHEET_IOS_BOTTOM_EXTRA,
  SHEET_GLASS_BASE,
  SHEET_GLASS_FLOOR,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  SHEET_HANDLE_FILL,
  latchSheetGlass,
  canLatchSheetGlass,
  sheetContentBottomPadding,
  sheetSafeBottomInset,
  sheetSystemBarFillHeight,
  sheetActionColors,
} from '../../components/ui/BottomSheet/sheetGlass';
import { DesignTokens } from '../../components/ui/DesignTokens';

/** α של צבע rgba/rgb — 1 כשאין ערוץ אלפא. */
function alphaOf(color: string): number {
  const match = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color);
  if (!match) return 1;
  return match[1] === undefined ? 1 : Number(match[1]);
}

/** מתחת לזה ה-BlurView כבר לא נקרא כזכוכית אלא כרעש עדין. */
const MIN_READABLE_BLUR_INTENSITY = 24;
/** מעל זה ה-overlay חונק את הטשטוש גם אם טכנית הוא שקוף־למחצה. */
const MAX_GLASS_OVERLAY_ALPHA = 0.3;

describe('sheet glass stays opaque during motion', () => {
  it('latches blur once shown — drag/close must not unmount the glass', () => {
    expect(latchSheetGlass(false, false)).toBe(false);
    expect(latchSheetGlass(false, true)).toBe(true);
    expect(latchSheetGlass(true, false)).toBe(true);
    expect(latchSheetGlass(true, true)).toBe(true);
  });

  it('does not mount blur until layout and open-defer are done', () => {
    expect(canLatchSheetGlass(false, true, false, false)).toBe(false);
    expect(canLatchSheetGlass(false, true, true, false)).toBe(false);
    expect(canLatchSheetGlass(false, true, true, true)).toBe(true);
    expect(canLatchSheetGlass(true, true, true, false)).toBe(true);
  });
});

describe('sheet glass surface tokens', () => {
  it('uses solid light-gray grabber fill with no hairline border on shared styles', () => {
    expect(SHEET_HANDLE_FILL).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SHEET_HANDLE_FILL).toBe('#8E8E93');
    expect(SHEET_HANDLE_FILL).toBe(DesignTokens.colors.text.secondary);
    const stylesSrc = readFileSync(
      join(__dirname, '../../components/ui/BottomSheet/BottomSheet.styles.ts'),
      'utf8',
    );
    const handleBlock = stylesSrc.match(/handle:\s*\{[\s\S]*?\n  \},/)?.[0] ?? '';
    expect(handleBlock).toContain('SHEET_HANDLE_FILL');
    expect(handleBlock).not.toMatch(/borderWidth/);
    expect(handleBlock).not.toMatch(/borderColor/);
  });

  it('keeps chrome surface color as opaque hex (system bar / brand fill)', () => {
    expect(SHEET_GLASS_FLOOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('uses soft surface hex for no-blur sheet base (not legacy #262626)', () => {
    expect(SHEET_GLASS_BASE).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SHEET_GLASS_BASE).toBe(DesignTokens.colors.background.secondary);
  });

  it('uses opaque soft surface for sheet overlay (no white rgba wash)', () => {
    expect(SHEET_GLASS_OVERLAY).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SHEET_GLASS_OVERLAY).toBe(DesignTokens.colors.background.secondary);
  });

  it('keeps blur intensity high enough to read as glass', () => {
    expect(SHEET_GLASS_INTENSITY).toBeGreaterThanOrEqual(MIN_READABLE_BLUR_INTENSITY);
  });

  it('tints sheet blur and paints the body from the active theme', () => {
    const glassSrc = readFileSync(
      join(__dirname, '../../components/ui/BottomSheet/SheetGlassBackground.tsx'),
      'utf8',
    );
    const sheetSrc = readFileSync(
      join(__dirname, '../../components/ui/BottomSheet/BottomSheet.tsx'),
      'utf8',
    );
    const uiSrc = readFileSync(
      join(__dirname, '../../components/ui/UIBottomSheet.tsx'),
      'utf8',
    );
    expect(glassSrc).toContain('cardGlassBlurTint(isDark)');
    expect(glassSrc).not.toMatch(/tint=["']dark["']/);
    expect(glassSrc).toContain('background.cardSolid');
    expect(sheetSrc).toContain('tokens.colors.text.secondary');
    expect(sheetSrc).toContain('tokens.colors.background.cardSolid');
    expect(sheetSrc).toContain('tokens.colors.border.divider');
    expect(uiSrc).toContain('tokens.colors.text.secondary');
    expect(uiSrc).toContain('tokens.colors.background.cardSolid');
  });

  it('does not fall back to the old hardcoded green surface', () => {
    expect(SHEET_GLASS_FLOOR).not.toBe('#141F14');
  });
});

describe('shared glass tokens (UICard + every glass surface)', () => {
  const intensities = ['subtle', 'light', 'medium', 'strong'] as const;

  it('keeps every dark card surface opaque hex', () => {
    for (const intensity of intensities) {
      const overlay = DesignTokens.glassmorphism.cardBackground.dark[intensity];
      expect(overlay).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keeps every blur intensity readable as glass', () => {
    for (const intensity of intensities) {
      expect(DesignTokens.glassmorphism.blurIntensity[intensity]).toBeGreaterThanOrEqual(
        MIN_READABLE_BLUR_INTENSITY,
      );
    }
  });

  it('keeps dark baseFill opaque soft surface; light theme stays translucent', () => {
    expect(DesignTokens.glassmorphism.baseFill.dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DesignTokens.glassmorphism.baseFill.light).toMatch(/^rgba\(/);
    expect(alphaOf(DesignTokens.glassmorphism.baseFill.light)).toBeLessThan(0.88);
  });

  it('keeps dark borders barely visible (Soft UI restraint)', () => {
    for (const intensity of intensities) {
      const border = DesignTokens.glassmorphism.border.dark[intensity];
      expect(border).toMatch(/^rgba\(255,\s*255,\s*255/);
      const alpha = alphaOf(border);
      expect(alpha).toBeGreaterThanOrEqual(0.04);
      expect(alpha).toBeLessThanOrEqual(0.10);
    }
  });
});

describe('sheetSafeBottomInset', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('falls back to android minimum when inset is 0 (Galaxy 3-button / edge-to-edge)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(sheetSafeBottomInset(0)).toBe(SHEET_ANDROID_MIN_BOTTOM_INSET);
  });

  it('keeps larger reported insets', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(sheetSafeBottomInset(48)).toBe(48);
  });

  it('uses ios inset as-is (including 0)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(sheetSafeBottomInset(0)).toBe(0);
    expect(sheetSafeBottomInset(34)).toBe(34);
  });
});

describe('sheetContentBottomPadding', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('adds android extra above safe inset', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(sheetContentBottomPadding(0)).toBe(
      SHEET_ANDROID_MIN_BOTTOM_INSET + SHEET_ANDROID_BOTTOM_EXTRA,
    );
    expect(sheetContentBottomPadding(48)).toBe(48 + SHEET_ANDROID_BOTTOM_EXTRA);
  });

  it('adds ios extra above safe inset', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(sheetContentBottomPadding(34)).toBe(34 + SHEET_IOS_BOTTOM_EXTRA);
  });
});

describe('sheetSystemBarFillHeight', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('matches android safe inset minimum (covers white Modal under Galaxy nav)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(sheetSystemBarFillHeight(0)).toBe(SHEET_ANDROID_MIN_BOTTOM_INSET);
    expect(sheetSystemBarFillHeight(48)).toBe(48);
  });
});

describe('sheetActionColors', () => {
  it('never forces solid white fills on dark-friendly action variants', () => {
    const colors = sheetActionColors({
      colors: {
        primary: { main: '#00C805' },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255,255,255,0.7)',
          inverse: '#0A0E0A',
          danger: '#EF4444',
        },
        danger: { main: '#EF4444' },
        glass: { card: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)' } },
        border: { primary: 'rgba(255,255,255,0.08)', subtle: 'rgba(255,255,255,0.04)' },
      },
    });

    expect(colors.primary.backgroundColor).toBe('#00C805');
    expect(colors.secondary.backgroundColor.toLowerCase()).not.toBe('#ffffff');
    expect(colors.cancel.backgroundColor).toBe('transparent');
    expect(colors.destructive.backgroundColor.toLowerCase()).not.toBe('#ffffff');
  });

  it('uses the screen canvas for secondary actions so they contrast with a card sheet', () => {
    const colors = sheetActionColors({
      colors: {
        primary: { main: '#00C805' },
        background: { primary: '#F4F2F1' },
        text: {
          primary: '#1E1A24',
          secondary: 'rgba(0,0,0,0.65)',
          inverse: '#FFFFFF',
          danger: '#EF4444',
        },
        border: { primary: 'rgba(0,0,0,0.10)', subtle: 'rgba(0,0,0,0.04)' },
      },
    });
    expect(colors.secondary.backgroundColor).toBe('#F4F2F1');
  });
});
