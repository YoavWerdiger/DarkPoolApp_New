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
 * כפתור שיתוף טרייד — עיגול בצבע הקנבס, כדי שיבלוט על הכרטיס.
 */
export default function TradeShareButton({
  onPress,
  size = 28,
  accessibilityLabel = 'שתף טרייד',
  style,
}: Props) {
  const tokens = useDesignTokens();
  const iconSize = Math.max(13, Math.round(size * 0.46));

  return (
    <DayNavBlurButton
      onPress={onPress}
      size={size}
      accessibilityLabel={accessibilityLabel}
      style={[{ backgroundColor: tokens.colors.background.primary }, style]}
    >
      <Ionicons name="share-outline" size={iconSize} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}
