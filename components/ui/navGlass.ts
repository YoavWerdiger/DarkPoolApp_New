import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { DesignTokens } from './DesignTokens';
import {
  CARD_GLASS_ANDROID_BLUR_METHOD,
  CARD_GLASS_ANDROID_BLUR_REDUCTION,
  cardGlassBlurTint,
  type GlassIntensity,
} from './cardGlass';

export type NavGlassIntensity = GlassIntensity;

export function navGlassBlurIntensity(intensity: NavGlassIntensity = 'light'): number {
  return DesignTokens.glassmorphism.blurIntensity[intensity];
}

/** tint מעל BlurView — ב-dark שקוף־למחצה כדי לקרוא «זכוכית» ולא slab אטום. */
export function navGlassOverlay(isDarkMode: boolean, intensity: NavGlassIntensity = 'light'): string {
  if (!isDarkMode) {
    return DesignTokens.glassmorphism.cardBackground.light[intensity];
  }
  switch (intensity) {
    case 'subtle':
      return 'rgba(255, 255, 255, 0.07)';
    case 'medium':
      return 'rgba(255, 255, 255, 0.12)';
    case 'strong':
      return 'rgba(255, 255, 255, 0.16)';
    case 'light':
    default:
      return 'rgba(255, 255, 255, 0.10)';
  }
}

/** רצפה דקה כשה-blur חלש — לא slab אטום שמסתיר את הזכוכית. */
export function navGlassBaseFill(isDarkMode: boolean): string {
  return isDarkMode ? 'rgba(22, 21, 20, 0.22)' : 'rgba(255, 255, 255, 0.18)';
}

export function navGlassBorderStyle(
  isDarkMode: boolean,
  intensity: NavGlassIntensity = 'light',
): ViewStyle {
  const theme = isDarkMode ? 'dark' : 'light';
  const gm = DesignTokens.glassmorphism;
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gm.border[theme][intensity],
    borderTopColor: gm.topHighlight[theme][intensity],
  };
}

export function navGlassBlurTint(isDarkMode: boolean) {
  return cardGlassBlurTint(isDarkMode);
}

export const navGlassAndroidBlurProps =
  Platform.OS === 'android'
    ? {
        blurMethod: CARD_GLASS_ANDROID_BLUR_METHOD,
        blurReductionFactor: CARD_GLASS_ANDROID_BLUR_REDUCTION,
      }
    : {};
