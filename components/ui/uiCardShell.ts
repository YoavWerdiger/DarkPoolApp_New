import type { ViewStyle } from 'react-native';
import { UI_CARD_RADIUS } from './appLayout';
import { SoftUI } from './softUiPalette';
import { LIGHT_CARD } from './designTokensStatic';

/** מעטפת כרטיס כמו CourseCard — אטום, בלי border. */
export function uiCardAcademyShellStyle(isDarkMode: boolean): ViewStyle {
  return {
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? SoftUI.surface1 : LIGHT_CARD,
  };
}

/** @deprecated השתמשו ב־`colors.background.navChrome` / `chromeSurfaceFill` */
export function navChromeSurfaceColor(isDarkMode: boolean): string {
  return isDarkMode ? SoftUI.surface2 : '#FFFFFF';
}

export { UI_CARD_RADIUS };
