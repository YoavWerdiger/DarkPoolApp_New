import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenGradientBackground } from '../VideoBackground';
import { useDesignTokens } from './DesignTokens';
import { BrandTransbackWatermark } from './BrandTransbackWatermark';

type Props = {
  children: React.ReactNode;
  /** שכבת שור־ודוב (transback) כמו ברשימת צ׳אטים — מעל הגרדיאנט */
  withBrandWatermark?: boolean;
};

/**
 * מעטפת מסך — רקע primary + גרדיאנט ירוק־שחור; אופציונלית שכבת transback כמו צ׳אטים.
 */
export function ScreenChrome({ children, withBrandWatermark }: Props) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}>
      <ScreenGradientBackground style={StyleSheet.absoluteFillObject} />
      {withBrandWatermark ? <BrandTransbackWatermark /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
