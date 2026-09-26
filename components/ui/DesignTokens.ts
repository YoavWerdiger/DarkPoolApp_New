/**
 * Barrel — נתונים סטטיים ב-designTokensStatic (בלי ThemeContext).
 * Hook ב-useDesignTokens.ts כדי למנוע require cycle.
 */
export { SoftUI } from './softUiPalette';
export {
  createDesignTokensForTheme,
  DesignTokens,
} from './designTokensStatic';
export type { DesignTokensThemeBundle } from './designTokensStatic';
export { useDesignTokens } from './useDesignTokens';

export { DesignTokens as default } from './designTokensStatic';
