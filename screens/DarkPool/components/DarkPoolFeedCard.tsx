/**
 * מעטפת כרטיס פיד — UICard glass.
 * הריפוד על שכבת התוכן (לא על ה-outer), כדי שה-Blur יעטוף גם את התמונה עד שולי הכרטיס.
 */

import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

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

export const DarkPoolFeedCard = memo(function DarkPoolFeedCard({
  children,
  onPress,
  accent = false,
  style,
  accessibilityLabel,
  haptic = true,
}: Props) {
  const tokens = useDesignTokens();

  return (
    <View style={styles.slot}>
      <UICard
        variant="glass"
        glassIntensity="medium"
        padding="none"
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        haptic={haptic}
        showGlassBorder={!accent}
        style={[
          {
            borderRadius: 36,
            borderWidth: 1,
            borderColor: accent
              ? `${tokens.colors.primary.main}44`
              : tokens.colors.border.subtle,
            overflow: 'hidden',
          },
          accent ? { borderWidth: 1.5 } : null,
          style,
        ]}
      >
        <View style={styles.inner}>{children}</View>
      </UICard>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: {
    marginBottom: 8,
  },
  inner: {
    direction: 'rtl',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
