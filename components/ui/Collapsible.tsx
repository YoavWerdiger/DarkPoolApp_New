import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const COLLAPSIBLE_MS = 260;
const EASE = Easing.out(Easing.cubic);

/**
 * פתיחה/סגירה של דרופדאון בתנועה: גובה נפתח מ-0 לגובה התוכן, התוכן דוהה ויורד קלות למקומו.
 * מחליף `{open && …}` / LayoutAnimation (שב-Fabric לרוב לא רץ — הדרופ פשוט «קפץ»).
 * התוכן נשאר mounted עד סוף הסגירה. Reduce Motion → פתיחה מיידית.
 */
export function Collapsible({
  open,
  children,
  style,
  duration = COLLAPSIBLE_MS,
}: {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const contentH = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (open) setMounted(true);
    const target = open ? 1 : 0;
    if (reduceMotion) {
      progress.value = target;
      if (!open) setMounted(false);
      return;
    }
    progress.value = withTiming(target, { duration, easing: EASE }, (finished) => {
      if (finished && target === 0) scheduleOnRN(unmount);
    });
  }, [open, duration, reduceMotion, progress, unmount]);

  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      contentH.value = e.nativeEvent.layout.height;
    },
    [contentH]
  );

  const containerStyle = useAnimatedStyle(() => ({
    height: contentH.value * progress.value,
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -6 * (1 - progress.value) }],
  }));

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.clip, style, containerStyle]}>
      {/* absolute — נמדד בגובה הטבעי שלו בלי תלות בגובה המונפש */}
      <Animated.View style={[styles.content, contentStyle]} onLayout={onContentLayout}>
        <View>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
