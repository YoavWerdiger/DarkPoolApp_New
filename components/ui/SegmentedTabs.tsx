/**
 * סרגל טאבים אחיד לכל האפליקציה — כמו בורר התקופה בדף המסלול:
 * מסילה tertiary ברוחב מלא, טאבים ברוחב שווה, ורקע cardSolid שמחליק לטאב הנבחר (260ms).
 * בעברית / ערבית הטאב הראשון מימין; באנגלית (ממשק מראה) משמאל.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useDesignTokens } from './DesignTokens';
import { APP_TYPE } from './appType';
import { IS_RTL_UI } from '../../lib/i18n/direction';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type SegmentedTabOption<K extends string> = { id: K; label: string };

export function SegmentedTabs<K extends string>({
  options,
  value,
  onChange,
  style,
  haptic = true,
  accessibilityLabelFor,
}: {
  options: readonly SegmentedTabOption<K>[];
  value: K;
  onChange: (id: K) => void;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabelFor?: (opt: SegmentedTabOption<K>) => string;
}) {
  const tokens = useDesignTokens();
  const reduceMotion = useReducedMotion();
  const frames = useRef(new Map<string, { x: number; width: number }>());
  const [measured, setMeasured] = useState(false);
  const hx = useSharedValue(0);
  const hw = useSharedValue(0);

  const moveTo = useCallback(
    (id: string, animate: boolean) => {
      const f = frames.current.get(id);
      if (!f) return;
      const cfg = { duration: 260, easing: Easing.out(Easing.cubic) };
      hx.value = animate && !reduceMotion ? withTiming(f.x, cfg) : f.x;
      hw.value = animate && !reduceMotion ? withTiming(f.width, cfg) : f.width;
    },
    [hx, hw, reduceMotion],
  );

  useEffect(() => {
    moveTo(value, measured);
  }, [value, measured, moveTo]);

  const highlightStyle = useAnimatedStyle(() => ({
    width: hw.value,
    transform: [{ translateX: hx.value }],
  }));

  // style חיצוני = מיקום/שוליים בלבד (עטיפה) — לא דורס את כיוון המסילה
  return (
    <View style={style}>
    <View style={[styles.track, { backgroundColor: tokens.colors.background.tertiary }]} accessibilityRole="tablist">
      {/* שכבה פיזית (ltr): ה-x של onLayout תמיד משמאל */}
      <View style={styles.highlightLayer} pointerEvents="none">
        {measured ? (
          <Animated.View style={[styles.highlight, { backgroundColor: tokens.colors.background.cardSolid }, highlightStyle]} />
        ) : null}
      </View>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              frames.current.set(opt.id, { x, width });
              if (opt.id === value) moveTo(opt.id, false);
              if (frames.current.size >= options.length && !measured) setMeasured(true);
            }}
            onPress={() => {
              if (active) return;
              if (haptic) void HapticFeedback.selection();
              onChange(opt.id);
            }}
            style={[styles.tab, active && !measured && { backgroundColor: tokens.colors.background.cardSolid }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={accessibilityLabelFor ? accessibilityLabelFor(opt) : opt.label}
          >
            <Text
              style={[styles.label, { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    direction: 'ltr',
    flexDirection: IS_RTL_UI ? 'row-reverse' : 'row',
    borderRadius: 999,
    padding: 4,
    alignSelf: 'stretch',
  },
  highlightLayer: {
    ...StyleSheet.absoluteFill,
    direction: 'ltr',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'center',
  },
});
