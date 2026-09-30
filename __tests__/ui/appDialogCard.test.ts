import { readFileSync } from 'fs';
import { join } from 'path';
import { SoftUI } from '../../components/ui/softUiPalette';
import { DesignTokens, createDesignTokensForTheme } from '../../components/ui/designTokensStatic';

const alertSrc = readFileSync(
  join(__dirname, '../../components/ui/UIAlert.tsx'),
  'utf8',
);

describe('global app dialog card', () => {
  it('uses the content card fill, not glass or the old bubble', () => {
    expect(SoftUI.surface1).toBe('#1C1C1E');
    expect(DesignTokens.colors.background.cardSolid).toBe('#1C1C1E');
    expect(alertSrc).toContain('colors.background.cardSolid');
    expect(alertSrc).toContain('UI_CARD_RADIUS');
    expect(alertSrc).toContain('borderWidth: 0');
    expect(alertSrc).not.toContain('bubbleOther');
    expect(alertSrc).not.toContain('getGlassCardStyle');
    expect(alertSrc).not.toContain('#2C2C2E');
    expect(alertSrc).not.toContain('#262626');
  });

  it('uses a white card on the warm canvas in light mode', () => {
    const light = createDesignTokensForTheme(false);
    expect(light.colors.background.primary).toBe('#F4F2F1');
    expect(light.colors.background.cardSolid).toBe('#FFFFFF');
    expect(light.colors.text.primary).toBe('#1E1A24');
  });

  it('types the dialog from shared tokens', () => {
    expect(alertSrc).toContain('APP_TYPE.cardTitle');
    expect(alertSrc).toContain('APP_TYPE.body');
    expect(alertSrc).toContain('appSheetButtonLabelStyle');
    expect(alertSrc).toContain('colors.primary.main');
    expect(alertSrc).toContain('colors.danger.main');
    expect(alertSrc).toContain('colors.text.secondary');
  });
});
