import { readFileSync } from 'fs';
import { join } from 'path';
import { DesignTokens, SoftUI } from '../../components/ui/DesignTokens';
import { createDesignTokensForTheme } from '../../components/ui/designTokensStatic';
import { APP_SYSTEM_BACKGROUND } from '../../lib/androidSystemUI';

describe('Soft UI design tokens', () => {
  it('locks black canvas, card surface, and three text levels', () => {
    expect(SoftUI.canvas).toBe('#000000');
    expect(SoftUI.surface1).toBe('#1C1C1E');
    expect(SoftUI.textPrimary).toBe('#FFFFFF');
    expect(SoftUI.textSecondary).toBe('#8E8E93');
    expect(SoftUI.textMuted).toBe('#636366');
  });

  it('uses classic DarkPool green for primary and success', () => {
    expect(SoftUI.brand).toBe('#00C805');
    expect(SoftUI.positive).toBe('#6EE7A0');
    expect(SoftUI.negative).toBe('#EF4444');
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

  it('locks the light canvas and white cards with dark text', () => {
    const light = createDesignTokensForTheme(false);
    expect(light.colors.background.primary).toBe('#F4F2F1');
    expect(light.colors.background.screen).toBe('#F4F2F1');
    expect(light.colors.background.card).toBe('#FFFFFF');
    expect(light.colors.background.cardSolid).toBe('#FFFFFF');
    expect(light.colors.text.primary).toBe('#1E1A24');
    expect(light.colors.text.secondary).not.toMatch(/^#fff/i);
    expect(light.colors.text.inverse).toBe('#FFFFFF');
    expect(light.colors.primary.lightCta).toBe('#010000');
    expect(DesignTokens.colors.primary.lightCta).toBe('#FFFFFF');
    expect(DesignTokens.colors.primary.main).toBe('#00C805');
    expect(DesignTokens.colors.text.inverse).toBe('#1A1918');
    expect(DesignTokens.colors.background.cardSolid).toBe('#1C1C1E');
    expect(DesignTokens.colors.background.navChrome).toBe(SoftUI.surface2);
  });

  it('uses a theme-aware hairline for row dividers', () => {
    expect(DesignTokens.colors.border.divider).toBe('rgba(255, 255, 255, 0.13)');
    const light = createDesignTokensForTheme(false);
    expect(light.colors.border.divider).toBe('rgba(0, 0, 0, 0.10)');
  });

  it('keeps the primary CTA a full pill and leaves secondary square', () => {
    const buttonSrc = readFileSync(join(__dirname, '../../components/ui/UIButton.tsx'), 'utf8');
    const primaryBlock = buttonSrc.slice(
      buttonSrc.indexOf("case 'primary':"),
      buttonSrc.indexOf("case 'secondary':"),
    );
    const secondaryBlock = buttonSrc.slice(
      buttonSrc.indexOf("case 'secondary':"),
      buttonSrc.indexOf("case 'danger':"),
    );
    expect(primaryBlock).toContain('colors.primary.lightCta');
    expect(primaryBlock).toContain('borderRadius.full');
    expect(primaryBlock).not.toContain('borderRadius.md');
    expect(primaryBlock).toContain('colors.text.inverse');
    expect(primaryBlock).toContain('fontWeight.semibold');
    expect(primaryBlock).not.toContain('typography.button.weight');
    expect(primaryBlock).not.toContain("'700'");
    expect(primaryBlock).not.toContain("'800'");
    expect(secondaryBlock).toContain('borderRadius.md');
    expect(secondaryBlock).toContain('background.navChrome');
    expect(secondaryBlock).not.toContain('lightCta');
  });
});
