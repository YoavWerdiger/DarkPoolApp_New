import React from 'react';
import { Image } from 'react-native';
import type { RankAnimal } from './userRank';

// השור והדוב מהלוגו של DarkPool (assets/badges — מסכה לבנה, נצבעת לפי הדרגה)
const ANIMAL_IMAGES = {
  bull: require('../../../assets/badges/bull.png'),
  bear: require('../../../assets/badges/bear.png'),
} as const;

type Props = {
  animal: RankAnimal;
  color: string;
  size?: number;
};

/** ראש שור / דוב מהלוגו — חד-צבעי, הצבע לפי הדרגה */
export function RankAnimalIcon({ animal, color, size = 16 }: Props) {
  return (
    <Image
      source={ANIMAL_IMAGES[animal]}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export default RankAnimalIcon;
