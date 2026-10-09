import React, { useEffect, useMemo } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
import { SlidingIndicatorLayer, type SlidingIndicator } from './SlidingIndicator';

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
  /** בלי מעבר צבע (שורות עם מחוון מחליק — העותק המחליק כבר מנפיש את הבחירה) */
  instantSelection?: boolean;
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
  instantSelection = false,
}: DayDividerPillProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const label = typeof children === 'string' ? children : undefined;
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius =
    (flatStyle?.borderRadius as number | undefined) ?? tokens.borderRadius.lg;
  const baseFill = chromeSurfaceFill(tokens);

  // מושן: מעבר צבע לבחירה (מילוי + טקסט) ולחיצה שמתכווצת קלות — בכל הצ'יפים באפליקציה
  const reduceMotion = useReducedMotion();
  const selectedFill = tokens.colors.primary.lightCta;
  const textColor = tokens.colors.text.primary;
  const textSelectedColor = tokens.colors.text.inverse;
  const sel = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    const target = selected ? 1 : 0;
    sel.value =
      instantSelection || reduceMotion
        ? target
        : withTiming(target, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [selected, instantSelection, reduceMotion, sel]);

  const faceAnim = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(sel.value, [0, 1], [baseFill, selectedFill]),
      transform: [{ scale: press.value }],
    }),
    [baseFill, selectedFill]
  );
  const pressAnim = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const textAnim = useAnimatedStyle(
    () => ({ color: interpolateColor(sel.value, [0, 1], [textColor, textSelectedColor]) }),
    [textColor, textSelectedColor]
  );

  const faceStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth: 0,
    alignSelf: 'flex-start',
    flexShrink: 0,
  };

  // instantSelection (שורות עם מחוון מחליק): צבע ישירות ברינדור — ערך מונפש מתעדכן ב-useEffect
  // אחרי הציור, כך שכשהעותק המחליק נוחת ונעלם היה פריים בלי צ'יפ נבחר → הבהוב
  const staticFace = instantSelection ? { backgroundColor: selected ? selectedFill : baseFill } : null;
  const inner = (
    <Animated.View
      style={[
        faceStyle,
        flatStyle,
        styles.frame,
        contentContainerStyle,
        styles.dividerInner,
        instantSelection ? pressAnim : faceAnim,
        staticFace,
      ]}
    >
      {typeof children === 'string' ? (
        <Animated.Text
          style={[styles.text, selected && styles.textSelected, instantSelection ? null : textAnim]}
        >
          {children}
        </Animated.Text>
      ) : (
        children
      )}
    </Animated.View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={() => {
          if (haptic) void HapticFeedback.impactLight();
          onPress();
        }}
        onPressIn={() => {
          if (!reduceMotion) press.value = withTiming(0.95, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
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

/**
 * מחוון מחליק לשורת DayDividerPill — עותק של הצ'יפ הנבחר (אותו מילוי, רדיוס וטקסט).
 * ילד אחרון של המיכל שבו כל צ'יפ עטוף ב־View עם indicator.onItemLayout(id).
 */
export function DayDividerSlidingLayer<K extends string>({
  indicator,
  labelOf,
}: {
  indicator: SlidingIndicator<K>;
  labelOf: (key: K) => string;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  return (
    <SlidingIndicatorLayer
      indicator={indicator}
      renderFace={(content) => (
        <View
          style={{
            flex: 1,
            borderRadius: tokens.borderRadius.lg,
            backgroundColor: tokens.colors.primary.lightCta,
          }}
        >
          {content}
        </View>
      )}
      renderLabel={(key) => (
        <Text numberOfLines={1} style={[styles.text, styles.textSelected]}>
          {labelOf(key)}
        </Text>
      )}
    />
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
      color: tokens.colors.text.primary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    textSelected: {
      color: tokens.colors.text.inverse,
      fontWeight: tokens.typography.fontWeight.semibold,
    },
  });
