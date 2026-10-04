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
    // primary — קריא על קנבס כהה; secondary של light (rgba שחור) נעלם על אורורה.
    color: input.error
      ? input.tokens.colors.danger.main
      : input.tokens.colors.text.primary,
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

export function formFieldInputStyle(tokens?: Tokens): TextStyle {
  return {
    flex: 1,
    color: tokens?.colors.text.primary ?? SoftUI.textPrimary,
    fontSize: APP_TYPE.body.fontSize,
    fontWeight: APP_TYPE.body.fontWeight,
    // בלי lineHeight: ב-iOS TextInput חד-שורתי עם lineHeight דוחף את הטקסט למטה («שוקע»).
    // שדות multiline מוסיפים lineHeight בעצמם.
    textAlign: 'right',
    writingDirection: 'rtl',
  };
}

/** מספרים/טיקרים — גליפים LTR, יישור פיזי לימין (placeholder + ערך). */
export function formFieldNumericInputStyle(tokens?: Tokens): TextStyle {
  return {
    ...formFieldInputStyle(tokens),
    textAlign: 'right',
    writingDirection: 'ltr',
  };
}

/** Placeholder / chip לא-נבחר — secondary של הערכה (כהה: #8E8E93, לא muted כהה מדי). */
export function formFieldPlaceholderColor(tokens: Tokens): string {
  return tokens.colors.text.secondary;
}

