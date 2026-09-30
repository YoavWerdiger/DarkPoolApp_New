import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DayNavBlurButton } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';

type Props = {
  onPress: () => void;
  /** ברירת מחדל 28 — אייקון דיסקרטי ליד כותרת / P&L */
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * כפתור שיתוף טרייד — עיגול glass קטן ודיסקרטי (לא פעולה ראשית בכרטיס).
 */
export default function TradeShareButton({
  onPress,
  size = 28,
  accessibilityLabel = 'שתף טרייד',
  style,
}: Props) {
  const tokens = useDesignTokens();
  const iconSize = Math.max(13, Math.round(size * 0.46));
  const glassIntensity = size <= 30 ? 'subtle' : 'light';
  const iconColor =
    size <= 30 ? tokens.colors.text.secondary : tokens.colors.primary.main;

  return (
    <DayNavBlurButton
      onPress={onPress}
      size={size}
      glass
      glassIntensity={glassIntensity}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Ionicons name="share-outline" size={iconSize} color={iconColor} />
    </DayNavBlurButton>
  );
}
