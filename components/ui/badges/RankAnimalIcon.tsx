import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { RankAnimal } from './userRank';
import { BEAR_ICON, BULL_ICON } from './rankAnimalPaths';

type Props = {
  animal: RankAnimal;
  color: string;
  size?: number;
};

/** ראש דוב / שור חד-צבעי — הצבע לפי הדרגה */
export function RankAnimalIcon({ animal, color, size = 16 }: Props) {
  const shape = animal === 'bull' ? BULL_ICON : BEAR_ICON;
  return (
    <Svg width={size} height={size} viewBox={shape.viewBox}>
      {shape.paths.map((d, i) => (
        <Path key={i} d={d} fill={color} fillRule={shape.fillRule ?? 'nonzero'} />
      ))}
    </Svg>
  );
}

export default RankAnimalIcon;
