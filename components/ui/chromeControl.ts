import type { ViewStyle } from 'react-native';
import type { useDesignTokens } from './DesignTokens';
import type { UiCardVariant } from './cardGlass';

type Tokens = ReturnType<typeof useDesignTokens>;

/** UICard לפקדי כרום (שדה חיפוש, גלולת קלט, כפתור עגול) — לא glass. */
export const CHROME_UICARD = {
  variant: 'soft' as const satisfies UiCardVariant,
  padding: 'none' as const,
  disableBlur: true as const,
};

export function chromeSurfaceFill(tokens: Tokens): string {
  return tokens.colors.background.navChrome;
}

export function chromeSurfaceCardStyle(tokens: Tokens, extra?: ViewStyle): ViewStyle {
  return {
    backgroundColor: chromeSurfaceFill(tokens),
    borderWidth: 0,
    ...extra,
  };
}
