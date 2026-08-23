import { Platform } from 'react-native';
import {
  SHEET_ANDROID_MIN_BOTTOM_INSET,
  SHEET_ANDROID_BOTTOM_EXTRA,
  SHEET_IOS_BOTTOM_EXTRA,
  SHEET_GLASS_FLOOR,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  SHEET_GLASS_TINT,
  sheetContentBottomPadding,
  sheetSafeBottomInset,
  sheetSystemBarFillHeight,
  sheetActionColors,
} from '../../components/ui/BottomSheet/sheetGlass';

describe('sheet glass surface tokens', () => {
  it('keeps chrome surface color as opaque hex (system bar / brand fill)', () => {
    expect(SHEET_GLASS_FLOOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('uses UICard-like dark glass (thin material + light white overlay)', () => {
    expect(SHEET_GLASS_OVERLAY).toBe('rgba(255, 255, 255, 0.05)');
    expect(SHEET_GLASS_FLOOR).toBe('#242625');
    expect(SHEET_GLASS_FLOOR).not.toBe('#141F14');
    expect(SHEET_GLASS_INTENSITY).toBe(48);
    expect(SHEET_GLASS_TINT).toBe('systemThinMaterialDark');
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
          danger: '#FF4444',
        },
        danger: { main: '#FF4444' },
        glass: { card: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)' } },
        border: { primary: 'rgba(255,255,255,0.08)', subtle: 'rgba(255,255,255,0.04)' },
      },
    });

    expect(colors.primary.backgroundColor).toBe('#00C805');
    expect(colors.secondary.backgroundColor.toLowerCase()).not.toBe('#ffffff');
    expect(colors.cancel.backgroundColor).toBe('transparent');
    expect(colors.destructive.backgroundColor.toLowerCase()).not.toBe('#ffffff');
  });
});
