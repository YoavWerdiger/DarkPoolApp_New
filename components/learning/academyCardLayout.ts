import type { ViewStyle } from 'react-native';
import { MAIN_SCREEN_HEADER_HP } from '../ui/MainDrawerScreenHeader';

/** padding אופקי משותף לכל כרטיסיות האקדמיה */
export const ACADEMY_CARD_HP = MAIN_SCREEN_HEADER_HP;

/** רדיוס ועובי מסגרת אחידים — קורס + יוטיוב + דפים פנימיים */
export const ACADEMY_CARD_RADIUS = 24;
export const ACADEMY_CARD_BORDER_WIDTH = 2.5;

export type AcademyFrameTier = 'free' | 'premium' | 'youtube' | 'neutral';

export function academyFrameBorderColor(tier: AcademyFrameTier): string {
  switch (tier) {
    case 'premium':
      return 'rgba(245, 158, 11, 0.55)';
    case 'free':
      return 'rgba(0, 160, 4, 0.5)';
    case 'youtube':
      return 'rgba(255, 0, 51, 0.45)';
    default:
      return 'rgba(255, 255, 255, 0.16)';
  }
}

export function academyCardFrameStyle(tier: AcademyFrameTier = 'neutral'): ViewStyle {
  return {
    borderWidth: ACADEMY_CARD_BORDER_WIDTH,
    borderColor: academyFrameBorderColor(tier),
    borderRadius: ACADEMY_CARD_RADIUS,
  };
}

export function academyCardWidth(screenWidth: number): number {
  return screenWidth - ACADEMY_CARD_HP * 2;
}
