/**
 * ספינר אחיד לכל האפליקציה: טבעת מלאה (קשת על מסילה עדינה) שמסתובבת —
 * לא ה"פסים" של ActivityIndicator הנייטיבי — בצבע ה-CTA של ערכת הנושא
 * (לבן בכהה, שחור בבהיר; primary.lightCta).
 *
 * `ActivityIndicator` מיוצא באותו API של react-native כדי להחליף אותו בכל מקום.
 * צבע מפורש נשמר רק כשהוא צבע הניגוד על כפתור CTA (text.inverse) — אחרת תמיד צבע ה-CTA.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { useDesignTokens } from './DesignTokens';

type Size = 'small' | 'large' | number;

export interface AppSpinnerProps {
  size?: Size;
  color?: ColorValue;
  animating?: boolean;
  style?: StyleProp<ViewStyle>;
  hidesWhenStopped?: boolean;
  /** טבעת סטטית (בלי סיבוב) — למשל בזמן משיכה לפני שהרענון התחיל */
  paused?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

function px(size: Size | undefined): number {
  if (typeof size === 'number') return size;
  return size === 'large' ? 34 : 20;
}

export default function AppSpinner({
  size = 'small',
  color,
  animating = true,
  style,
  hidesWhenStopped = true,
  paused = false,
  testID,
  accessibilityLabel,
}: AppSpinnerProps) {
  const tokens = useDesignTokens();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating || paused) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animating, paused, spin]);

  if (!animating && hidesWhenStopped) return null;

  const d = px(size);
  const stroke = Math.max(2, Math.round(d / 9));
  const inverse = tokens.colors.text.inverse;
  const cta = color != null && String(color) === inverse ? inverse : tokens.colors.primary.lightCta;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={[styles.wrap, { width: d, height: d }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {/* מסילה עדינה */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: d / 2, borderWidth: stroke, borderColor: cta, opacity: 0.18 },
        ]}
      />
      {/* קשת מלאה שמסתובבת */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: d / 2,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderTopColor: cta,
            borderRightColor: cta,
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

/** תחליף drop-in ל-ActivityIndicator של react-native */
export const ActivityIndicator = AppSpinner;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
