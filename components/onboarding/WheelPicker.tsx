import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { UI_CARD_RADIUS } from '../ui/appLayout';
import { HapticFeedback } from '../../utils/hapticFeedback';

const ITEM_H = 64;
const VISIBLE = 5;
const HALF = Math.floor(VISIBLE / 2);
/** כמה פריטים לרנדר סביב המרכז — מספיק לגלילה מהירה בלי לרנדר את כל הטווח */
const WINDOW = 7;

type Props = {
  values: number[];
  value: number;
  onChange: (v: number) => void;
};

/**
 * גלגל בחירה (סגנון iOS / Cal AI) על מחוות Pan של Gesture Handler:
 * אינרציה + נעילה לערך, רטט «טיק» בכל מעבר ערך בזמן הגלילה.
 * לא ScrollView (שם הגלילה נחסמה בתוך מעטפת הרישום) ולא Picker נייטיבי
 * (אין בו אירוע לכל שורה — אי אפשר לרטוט בכל מעבר).
 */
export function WheelPicker({ values, value, onChange }: Props) {
  const tokens = useDesignTokens();
  const initialIndex = useMemo(() => Math.max(0, values.indexOf(value)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const maxOffset = (values.length - 1) * ITEM_H;

  /** offset = index * ITEM_H של הפריט שבמרכז */
  const offset = useSharedValue(initialIndex * ITEM_H);
  const start = useSharedValue(0);
  const [center, setCenter] = useState(initialIndex);

  const tick = useCallback((idx: number) => {
    setCenter(idx);
    void HapticFeedback.selection();
  }, []);

  const commit = useCallback(
    (idx: number) => {
      onChange(values[idx]);
    },
    [onChange, values],
  );

  useEffect(() => {
    onChange(values[initialIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // רטט בכל מעבר ערך בזמן הגלילה (לא בנחיתה)
  useAnimatedReaction(
    () => Math.min(values.length - 1, Math.max(0, Math.round(offset.value / ITEM_H))),
    (idx, prev) => {
      if (prev !== null && idx !== prev) {
        runOnJS(tick)(idx);
      }
    },
  );

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onBegin(() => {
      start.value = offset.value;
    })
    .onUpdate((e) => {
      // גרירה למטה = ערכים קטנים יותר (כמו גלגל iOS); מעט «מתיחה» בקצוות
      const next = start.value - e.translationY;
      offset.value = Math.min(maxOffset + ITEM_H * 0.6, Math.max(-ITEM_H * 0.6, next));
    })
    .onEnd((e) => {
      offset.value = withDecay(
        { velocity: -e.velocityY, deceleration: 0.996, clamp: [0, maxOffset] },
        (finished) => {
          if (!finished) return;
          const idx = Math.min(values.length - 1, Math.max(0, Math.round(offset.value / ITEM_H)));
          offset.value = withSpring(idx * ITEM_H, { damping: 22, stiffness: 220, mass: 0.6 });
          runOnJS(commit)(idx);
        },
      );
    });

  const from = Math.max(0, center - WINDOW);
  const to = Math.min(values.length - 1, center + WINDOW);
  const items: number[] = [];
  for (let i = from; i <= to; i++) items.push(i);

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap} collapsable={false}>
        <View
          pointerEvents="none"
          style={[styles.band, { backgroundColor: tokens.colors.background.cardSolid }]}
        />
        {items.map((i) => (
          <WheelItem
            key={values[i]}
            label={String(values[i])}
            index={i}
            offset={offset}
            color={tokens.colors.text.primary}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

function WheelItem({
  label,
  index,
  offset,
  color,
}: {
  label: string;
  index: number;
  offset: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const d = index - offset.value / ITEM_H; // מרחק מהמרכז ביחידות שורה
    const abs = Math.abs(d);
    return {
      opacity: interpolate(abs, [0, 1, 2, 3], [1, 0.38, 0.14, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: (HALF + d) * ITEM_H },
        { scale: interpolate(abs, [0, 1, 2], [1, 0.68, 0.52], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.Text style={[styles.item, { color }, style]} numberOfLines={1}>
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: HALF * ITEM_H,
    height: ITEM_H,
    borderRadius: UI_CARD_RADIUS,
  },
  item: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ITEM_H,
    lineHeight: ITEM_H,
    textAlign: 'center',
    // הערך הנבחר בולט — 48 (השכנים מוקטנים ב-scale)
    fontSize: 48,
    fontWeight: APP_TYPE.cardMetricValue.fontWeight,
    fontVariant: ['tabular-nums'],
  },
});
