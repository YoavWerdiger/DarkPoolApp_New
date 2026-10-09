import React from 'react';
import { Image } from 'react-native';
import { useDesignTokens } from '../DesignTokens';
import { useTheme } from '../../../context/ThemeContext';
import { rankColor, type RankMetal } from './userRank';

// סמל השור־ודוב של DarkPool — מסכה אחת (לבנה), נצבעת כולה בצבע הדרגה
const MARK = require('../../../assets/badges/rank_mark.png');
/** רוחב/גובה של הקובץ (686×512) */
export const RANK_MARK_ASPECT = 686 / 512;

type Props = {
  metal: RankMetal;
  /** גובה הסמל; הרוחב לפי היחס */
  size?: number;
};

/** סמל הדרגה — הלוגו המלא, הצבע לפי הוותק */
export function RankMarkIcon({ metal, size = 16 }: Props) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const color = rankColor(metal, isDarkMode, {
    grayToken: tokens.colors.text.tertiary,
    brandGreen: tokens.colors.primary.main,
  });
  // מידות מפורשות על ה-Image עצמו — בלי absoluteFill (שגרם לסמל להתפרס על כל המסך)
  return (
    <Image
      source={MARK}
      style={{ width: Math.round(size * RANK_MARK_ASPECT), height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

export default RankMarkIcon;
