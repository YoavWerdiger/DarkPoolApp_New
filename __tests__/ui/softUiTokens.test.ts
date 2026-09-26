import { DesignTokens, SoftUI } from '../../components/ui/DesignTokens';
import { APP_SYSTEM_BACKGROUND } from '../../lib/androidSystemUI';

describe('Soft UI design tokens', () => {
  it('locks warm charcoal canvas and three text levels', () => {
    expect(SoftUI.canvas).toBe('#0E0D0D');
    expect(SoftUI.textPrimary).toBe('#F4F1ED');
    expect(SoftUI.textSecondary).toBe('#AAA5A0');
    expect(SoftUI.textMuted).toBe('#716D69');
  });

  it('uses classic DarkPool green for primary and success', () => {
    expect(SoftUI.brand).toBe('#00C805');
    expect(SoftUI.positive).toBe('#6EE7A0');
    expect(SoftUI.negative).toBe('#F87171');
    expect(SoftUI.accentBlue).toBe('#7B96F2');
    expect(DesignTokens.colors.primary.main).toBe('#00C805');
    expect(DesignTokens.colors.text.success).toBe('#00C805');
    expect(DesignTokens.colors.info.main).toBe(SoftUI.accentBlue);
  });

  it('aligns system UI background with canvas', () => {
    expect(APP_SYSTEM_BACKGROUND).toBe(SoftUI.canvas);
    expect(DesignTokens.colors.background.primary).toBe(SoftUI.canvas);
    expect(DesignTokens.colors.background.screen).toBe(SoftUI.canvas);
  });

  it('surfaces step subtly above canvas', () => {
    expect(DesignTokens.colors.background.secondary).toBe(SoftUI.surface1);
    expect(DesignTokens.colors.background.tertiary).toBe(SoftUI.surface2);
    expect(DesignTokens.colors.background.navChrome).toBe(SoftUI.surface2);
    expect(DesignTokens.colors.background.elevated2).toBe(SoftUI.surface3);
  });
});
