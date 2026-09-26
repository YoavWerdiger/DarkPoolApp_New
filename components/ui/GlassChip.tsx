import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import UICard from './UICard';
import { useDesignTokens } from './DesignTokens';

/** גובה צ'יפ קומפקטי — לא להפוך גלולה לכרטיס. */
export const GLASS_CHIP_MIN_HEIGHT = 32;
export const GLASS_CHIP_RADIUS = 999;

/** אותם props ל־UICard — בלי לשכפל שכבות זכוכית. */
export const GLASS_CHIP_CARD = {
  variant: 'soft' as const,
  padding: 'none' as const,
  enableBlur: false as const,
};

export type GlassChipProps = {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  /** כבוי לשורות כבדות (למשל ReactionBar). */
  disableBlur?: boolean;
  enableBlur?: boolean;
  glassIntensity?: 'subtle' | 'light' | 'medium' | 'strong';
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: boolean;
};

/**
 * גלולה — UICard soft (משטח אטום, בלי שכבת לבן).
 */
export function GlassChip({
  children,
  onPress,
  selected = false,
  disableBlur = false,
  enableBlur = GLASS_CHIP_CARD.enableBlur,
  glassIntensity = 'light',
  style,
  contentContainerStyle,
  accessibilityLabel,
  haptic = true,
}: GlassChipProps) {
  const tokens = useDesignTokens();
  const selectedFill = `${tokens.colors.primary.main}1F`;
  const selectedBorder = `${tokens.colors.primary.main}44`;

  return (
    <UICard
      variant={GLASS_CHIP_CARD.variant}
      glassIntensity={glassIntensity}
      padding={GLASS_CHIP_CARD.padding}
      disableBlur={disableBlur}
      enableBlur={enableBlur}
      onPress={onPress}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        { backgroundColor: tokens.colors.background.navChrome },
        selected && {
          borderWidth: 1,
          borderColor: selectedBorder,
        },
        style,
      ]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
    >
      {selected ? (
        <View pointerEvents="none" style={[styles.selectedFill, { backgroundColor: selectedFill }]} />
      ) : null}
      {children}
    </UICard>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: GLASS_CHIP_RADIUS,
    minHeight: GLASS_CHIP_MIN_HEIGHT,
  },
  content: {
    minHeight: GLASS_CHIP_MIN_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  selectedFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: GLASS_CHIP_RADIUS,
  },
});
