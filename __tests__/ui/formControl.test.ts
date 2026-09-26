import {
  FORM_FIELD_FOCUS_BORDER,
  formFieldBorderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { DesignTokens } from '../../components/ui/DesignTokens';

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
});
