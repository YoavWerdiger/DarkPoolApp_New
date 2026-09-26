import React, { useMemo } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDesignTokens } from './DesignTokens';
import { chromeSurfaceFill } from './chromeControl';
import { HapticFeedback } from '../../utils/hapticFeedback';

export const DAY_DIVIDER_CARD = {
  glassIntensity: 'light' as const,
  enableBlur: true as const,
};

export const DAY_DIVIDER_SELECTED_INTENSITY = 'medium' as const;

export const DAY_DIVIDER_PILL_PAD_H = 12;
export const DAY_DIVIDER_PILL_PAD_V = 5;
export const DAY_DIVIDER_PILL_MIN_HEIGHT = 30;
export const DAY_DIVIDER_PILL_FONT_SIZE = 11;
export const DAY_DIVIDER_PILL_LINE_HEIGHT = 14;

export type DayDividerPillProps = {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** צ'יפ / כפתור משני — אותו מילוי כמו כפתורי כרום. */
export function DayDividerPill({
  children,
  onPress,
  selected = false,
  disabled = false,
  haptic = false,
  accessibilityLabel,
  style,
  contentContainerStyle,
}: DayDividerPillProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const label = typeof children === 'string' ? children : undefined;
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius =
    (flatStyle?.borderRadius as number | undefined) ?? tokens.borderRadius.lg;
  const baseFill = chromeSurfaceFill(tokens);
  const selectedFill = `${tokens.colors.primary.main}22`;

  const faceStyle: ViewStyle = {
    borderRadius: radius,
    backgroundColor: selected ? selectedFill : baseFill,
    borderWidth: selected ? 1 : 0,
    borderColor: selected ? `${tokens.colors.primary.main}55` : undefined,
    alignSelf: 'flex-start',
    flexShrink: 0,
  };

  const inner = (
    <View style={[faceStyle, flatStyle, styles.frame, contentContainerStyle, styles.dividerInner]}>
      {typeof children === 'string' ? (
        <Text style={[styles.text, selected && styles.textSelected]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={() => {
          if (haptic) void HapticFeedback.impactLight();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel ?? label} pointerEvents={disabled ? 'none' : 'auto'}>
      {inner}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    frame: {},
    dividerInner: {
      minHeight: DAY_DIVIDER_PILL_MIN_HEIGHT,
      paddingHorizontal: DAY_DIVIDER_PILL_PAD_H,
      paddingVertical: DAY_DIVIDER_PILL_PAD_V,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      fontSize: DAY_DIVIDER_PILL_FONT_SIZE,
      lineHeight: DAY_DIVIDER_PILL_LINE_HEIGHT,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    textSelected: {
      color: tokens.colors.text.primary,
      fontWeight: tokens.typography.fontWeight.semibold,
    },
  });
