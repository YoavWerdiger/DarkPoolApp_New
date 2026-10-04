import { readFileSync } from 'fs';
import { join } from 'path';
import { createDesignTokensForTheme } from '../../components/ui/designTokensStatic';

const alertSrc = readFileSync(
  join(__dirname, '../../components/ui/UIAlert.tsx'),
  'utf8',
);

describe('global app dialog card', () => {
  it('uses the theme canvas, not a separate card fill', () => {
    expect(alertSrc).toContain('backgroundColor: colors.background.primary');
    expect(alertSrc).toContain('colors.background.cardSolid');
    expect(alertSrc).toContain("direction: 'ltr'");
    expect(alertSrc).toContain("flexDirection: 'row-reverse'");
    expect(alertSrc).not.toContain('I18nManager');
    expect(alertSrc).toContain('UI_CARD_RADIUS');
    expect(alertSrc).toContain('borderWidth: 0');
    expect(alertSrc).not.toContain('bubbleOther');
    expect(alertSrc).not.toContain('getGlassCardStyle');
    expect(alertSrc).not.toContain('#2C2C2E');
    expect(alertSrc).not.toContain('#262626');
  });

  it('matches the light canvas, not the white card', () => {
    const light = createDesignTokensForTheme(false);
    expect(light.colors.background.primary).toBe('#F4F2F1');
    expect(light.colors.background.cardSolid).toBe('#FFFFFF');
    expect(light.colors.text.primary).toBe('#1E1A24');
  });

  it('types the dialog from shared tokens', () => {
    expect(alertSrc).toContain('APP_TYPE.sectionTitle');
    expect(alertSrc).toContain('APP_TYPE.body');
    expect(alertSrc).toContain('appSheetButtonLabelStyle');
    expect(alertSrc).toContain('borderRadius.full');
    expect(alertSrc).toContain('minHeight: 52');
    expect(alertSrc).toContain('colors.background.secondary');
    expect(alertSrc).toContain('colors.text.danger');
    expect(alertSrc).toContain('useWindowDimensions');
    expect(alertSrc).toContain('copyWidth');
    expect(alertSrc).toContain("alignItems: 'stretch'");
    expect(alertSrc).toContain('colors.text.primary');
    expect(alertSrc).not.toContain('colors.primary.lightCta');
    expect(alertSrc).not.toContain('#FFFFFF');
  });
});
