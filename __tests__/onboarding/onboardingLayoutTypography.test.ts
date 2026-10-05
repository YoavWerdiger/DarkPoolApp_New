import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { appFlowSubtitleStyle, appFlowTitleStyle } from '../../components/ui/appType';

const layoutSrc = readFileSync(
  join(__dirname, '../../components/onboarding/OnboardingLayout.tsx'),
  'utf8',
);
const inputSrc = readFileSync(
  join(__dirname, '../../components/onboarding/OnboardingInput.tsx'),
  'utf8',
);

describe('registration / onboarding typography', () => {
  it('binds flow title and subtitle to APP_TYPE with tight gap', () => {
    expect(appFlowTitleStyle.fontSize).toBe(28);
    expect(appFlowSubtitleStyle.marginTop).toBe(APP_LAYOUT.titleSubtitleGap);
    expect(appFlowSubtitleStyle.color).toBe('#A0A0A0'); // SoftUI.textSecondary (גרפיט ניטרלי)
    expect(layoutSrc).toContain('appFlowTitleStyle');
    expect(layoutSrc).toContain('appFlowSubtitleStyle');
  });

  it('does not use green tint on input focus shell', () => {
    expect(inputSrc).toContain('formFieldShellStyle');
    expect(inputSrc).not.toMatch(/rgba\(0,\s*200,\s*5/);
    expect(inputSrc).not.toContain('colors.primary.main');
  });

  it('does not render leading icons inside the input shell', () => {
    expect(inputSrc).not.toMatch(/icon\s*\?/);
    expect(inputSrc).not.toContain('formFieldIconColor');
  });
});
