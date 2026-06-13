import { MAIN_SCREEN_HEADER_HP } from '../ui/MainDrawerScreenHeader';

/** padding אופקי משותף לכל כרטיסיות האקדמיה */
export const ACADEMY_CARD_HP = MAIN_SCREEN_HEADER_HP;

/** רדיוס ועובי מסגרת אחידים — קורס + יוטיוב */
export const ACADEMY_CARD_RADIUS = 24;
export const ACADEMY_CARD_BORDER_WIDTH = 1;

export function academyCardWidth(screenWidth: number): number {
  return screenWidth - ACADEMY_CARD_HP * 2;
}
