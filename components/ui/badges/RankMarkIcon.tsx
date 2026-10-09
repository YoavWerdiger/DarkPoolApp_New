import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useDesignTokens } from '../DesignTokens';
import { useTheme } from '../../../context/ThemeContext';
import { rankMarkColors, type RankMetal } from './userRank';

// סמל השור־ודוב מהלוגו — שתי שכבות על אותו קנבס (מסכות לבנות), כל אחת נצבעת בנפרד
const BULL = require('../../../assets/badges/mark_bull.png');
const BEAR = require('../../../assets/badges/mark_bear.png');

type Props = {
  metal: RankMetal;
  size?: number;
};

/** סמל הדרגה — אותו שור־ודוב, הצבע לפי הוותק */
export function RankMarkIcon({ metal, size = 16 }: Props) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const c = rankMarkColors(metal, isDarkMode, {
    grayToken: tokens.colors.text.tertiary,
    brandGreen: tokens.colors.primary.main,
  });
  const box = { width: size, height: size };
  return (
    <View style={box}>
      <Image
        source={BEAR}
        style={[StyleSheet.absoluteFill, { tintColor: c.bear, opacity: c.bearOpacity }]}
        resizeMode="contain"
      />
      <Image source={BULL} style={[StyleSheet.absoluteFill, { tintColor: c.bull }]} resizeMode="contain" />
    </View>
  );
}

export default RankMarkIcon;
