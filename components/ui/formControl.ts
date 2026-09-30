import type { ViewStyle, TextStyle } from 'react-native';
import type { useDesignTokens } from './DesignTokens';
import { APP_TYPE, appPhysicalRightText } from './appType';
import { SoftUI } from './softUiPalette';

type Tokens = ReturnType<typeof useDesignTokens>;

/** גבול שדה בפוקוס — לא ירוק; הדגשה נейтральית (Soft UI). */
export const FORM_FIELD_FOCUS_BORDER = 'rgba(255, 255, 255, 0.22)';

export function formFieldBorderColor(input: {
  tokens: Tokens;
  focused: boolean;
  error?: boolean;
}): string {
  if (input.error) return input.tokens.colors.danger.main;
  if (input.focused) return FORM_FIELD_FOCUS_BORDER;
  return input.tokens.colors.border.divider;
}

export function formFieldShellStyle(input: {
  tokens: Tokens;
  focused: boolean;
  error?: boolean;
  multiline?: boolean;
}): ViewStyle {
  const { tokens, focused, error, multiline } = input;
  const bg = error
    ? 'rgba(239, 68, 68, 0.1)'
    : focused
      ? tokens.colors.background.tertiary
      : tokens.colors.background.input;
  return {
    borderWidth: 0,
    backgroundColor: bg,
    paddingVertical: multiline ? 12 : 0,
    alignItems: multiline ? ('flex-start' as const) : ('center' as const),
  };
}

export function formFieldLabelStyle(input: {
  tokens: Tokens;
  focused: boolean;
  error?: boolean;
}): TextStyle {
  return {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardMetricLabel.fontSize,
    fontWeight: APP_TYPE.cardMetricLabel.fontWeight,
    lineHeight: APP_TYPE.cardMetricLabel.lineHeight,
    marginBottom: 8,
    color: input.error
      ? input.tokens.colors.danger.main
      : input.focused
        ? input.tokens.colors.text.secondary
        : input.tokens.colors.text.tertiary,
  };
}

/** @deprecated אייקונים לא בתוך שדה — נשמר לתאימות גרסאות ישנות */
export function formFieldIconColor(input: {
  tokens: Tokens;
  focused: boolean;
  error?: boolean;
}): string {
  if (input.error) return input.tokens.colors.danger.main;
  if (input.focused) return input.tokens.colors.text.secondary;
  return input.tokens.colors.text.tertiary;
}

export function formFieldInputStyle(): TextStyle {
  return {
    flex: 1,
    color: SoftUI.textPrimary,
    fontSize: APP_TYPE.body.fontSize,
    fontWeight: APP_TYPE.body.fontWeight,
    lineHeight: APP_TYPE.body.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  };
}

