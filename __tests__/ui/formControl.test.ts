import {
  FORM_FIELD_FOCUS_BORDER,
  formFieldBorderColor,
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldNumericInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { DesignTokens, SoftUI } from '../../components/ui/DesignTokens';
import { createDesignTokensForTheme } from '../../components/ui/designTokensStatic';

describe('formControl', () => {
  it('uses neutral focus border, not brand green', () => {
    expect(FORM_FIELD_FOCUS_BORDER).not.toContain('00C805');
    expect(FORM_FIELD_FOCUS_BORDER).not.toContain('00c805');
    const focused = formFieldBorderColor({
      tokens: DesignTokens as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
      focused: true,
      error: false,
    });
    expect(focused).toBe(FORM_FIELD_FOCUS_BORDER);
  });

  it('field shell has no border — fill only', () => {
    const shell = formFieldShellStyle({
      tokens: DesignTokens as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
      focused: false,
      error: false,
    });
    expect(shell.borderWidth).toBe(0);
    expect(shell).not.toHaveProperty('borderColor');
  });

  it('labels and inputs use primary light-on-dark text in dark theme', () => {
    const dark = createDesignTokensForTheme(true);
    expect(dark.colors.text.primary).toBe(SoftUI.textPrimary);
    expect(dark.colors.text.primary).toBe('#FFFFFF');
    expect(dark.colors.text.secondary).toBe(SoftUI.textSecondary);
    expect(dark.colors.text.secondary).toBe('#8E8E93');

    const label = formFieldLabelStyle({
      tokens: dark as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
      focused: false,
      error: false,
    });
    expect(label.color).toBe('#FFFFFF');

    const input = formFieldInputStyle(
      dark as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
    );
    expect(input.color).toBe('#FFFFFF');
    expect(input.textAlign).toBe('right');
    expect(input.writingDirection).toBe('rtl');
    expect(
      formFieldPlaceholderColor(
        dark as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
      ),
    ).toBe('#8E8E93');
  });

  it('numeric inputs keep LTR glyphs but sit on the physical right', () => {
    const style = formFieldNumericInputStyle();
    expect(style.textAlign).toBe('right');
    expect(style.writingDirection).toBe('ltr');
  });

  it('never uses light-theme ink for dark-theme form labels', () => {
    const dark = createDesignTokensForTheme(true);
    const light = createDesignTokensForTheme(false);
    const darkLabel = formFieldLabelStyle({
      tokens: dark as ReturnType<typeof import('../../components/ui/DesignTokens').useDesignTokens>,
      focused: false,
      error: false,
    });
    expect(darkLabel.color).not.toBe(light.colors.text.primary);
    expect(String(darkLabel.color)).not.toMatch(/rgba\(0,\s*0,\s*0/);
  });
});
