import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import UICard from '../ui/UICard';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';

type Padding = 'none' | 'sm' | 'md' | 'lg';

/** כרטיס תוכן בפאנל — soft / cardSolid, בלי זכוכית ובלי מסגרת. */
export function AdminSurface({
  children,
  padding = 'none',
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  padding?: Padding;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="soft"
      padding={padding}
      disableBlur
      style={[
        {
          borderRadius: UI_CARD_RADIUS,
          marginBottom: tokens.layout.cardStackGap,
          backgroundColor: tokens.colors.background.cardSolid,
        },
        style,
      ]}
      contentContainerStyle={contentStyle}
    >
      {children}
    </UICard>
  );
}

export function AdminScreen({ children }: { children: React.ReactNode }) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.fill, { backgroundColor: tokens.colors.background.primary }]}>
      {children}
    </View>
  );
}

export const adminScreenPad = {
  paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  paddingTop: APP_LAYOUT.groupLabelToContent,
  paddingBottom: 48,
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
