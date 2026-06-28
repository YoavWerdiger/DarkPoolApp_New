/**
 * מעטפת כרטיס פיד — UICard glass כמו TradeListCard (יומן מסחר).
 */

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** מסגרת ירוקה — קונפלוונס / סיגנל חזק */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** רטט בלחיצה — ברירת מחדל: selection עדין */
  haptic?: boolean;
}

export function DarkPoolFeedCard({
  children,
  onPress,
  accent = false,
  style,
  accessibilityLabel,
  haptic = true,
}: Props) {
  const tokens = useDesignTokens();
  const cardStyle = [
    styles.card,
    {
      borderRadius: tokens.borderRadius.xl,
      borderColor: accent ? `${tokens.colors.primary.main}44` : tokens.colors.border.subtle,
      marginBottom: tokens.spacing.sm,
    },
    style,
  ];

  const inner = (
    <View style={styles.rtlWrap}>{children}</View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          if (haptic) void HapticFeedback.selection();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="sm"
          style={cardStyle}
        >
          {inner}
        </UICard>
      </Pressable>
    );
  }

  return (
    <UICard variant="glass" glassIntensity="light" padding="sm" style={cardStyle}>
      {inner}
    </UICard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  rtlWrap: {
    direction: 'rtl',
  },
});
