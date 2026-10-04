import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { UI_CARD_RADIUS } from '../ui/appLayout';
import { HapticFeedback } from '../../utils/hapticFeedback';

const ITEM_H = 56;
const VISIBLE = 5;

type Props = {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  /** סיומת קטנה ליד הערך הנבחר (למשל «שנים») */
  suffix?: string;
};

/**
 * גלגל בחירה אנכי (סגנון iOS / Cal AI): הערך במרכז גדול ובולט,
 * השכנים קטנים ודהויים, רטט קל בכל מעבר ערך.
 */
export function WheelPicker({ values, value, onChange, suffix }: Props) {
  const tokens = useDesignTokens();
  const scrollY = useSharedValue(0);
  const lastIndex = useRef(Math.max(0, values.indexOf(value)));
  const listRef = useRef<Animated.FlatList<number>>(null);
  const initialIndex = useMemo(() => Math.max(0, values.indexOf(value)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollY.value = initialIndex * ITEM_H;
  }, [initialIndex, scrollY]);

  const tick = useCallback(() => {
    void HapticFeedback.selection();
  }, []);
  const tickIndex = useSharedValue(initialIndex);

  // רטט בכל מעבר ערך בזמן גלילה — רק כשהאינדקס במרכז משתנה
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const idx = Math.round(e.contentOffset.y / ITEM_H);
    if (idx !== tickIndex.value && idx >= 0 && idx < values.length) {
      tickIndex.value = idx;
      runOnJS(tick)();
    }
  });

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
      lastIndex.current = idx;
      onChange(values[idx]);
    },
    [onChange, values],
  );

  return (
    <View style={styles.wrap}>
      {/* פס הבחירה במרכז */}
      <View
        pointerEvents="none"
        style={[styles.band, { backgroundColor: tokens.colors.background.cardSolid }]}
      />
      <Animated.FlatList
        ref={listRef}
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // בלי מומנטום (גרירה איטית) — onMomentumScrollEnd לא נורה
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) settle(e);
        }}
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item, index }) => (
          <WheelItem
            label={String(item)}
            index={index}
            scrollY={scrollY}
            selected={item === value}
            suffix={suffix}
            color={tokens.colors.text.primary}
          />
        )}
        style={{ height: ITEM_H * VISIBLE }}
      />
    </View>
  );
}

function WheelItem({
  label,
  index,
  scrollY,
  selected,
  suffix,
  color,
}: {
  label: string;
  index: number;
  scrollY: SharedValue<number>;
  selected: boolean;
  suffix?: string;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const d = scrollY.value / ITEM_H - index;
    return {
      opacity: interpolate(Math.abs(d), [0, 1, 2], [1, 0.4, 0.15], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(Math.abs(d), [0, 1, 2], [1, 0.78, 0.66], Extrapolation.CLAMP) },
        { rotateX: `${interpolate(d, [-2, 0, 2], [40, 0, -40], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <Text style={[styles.itemText, { color }]}>{label}</Text>
      {suffix && selected ? <Text style={[styles.suffix, { color }]}>{suffix}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_H * VISIBLE,
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    borderRadius: UI_CARD_RADIUS,
  },
  item: {
    height: ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  itemText: {
    fontSize: APP_TYPE.cardMetricValue.fontSize,
    lineHeight: APP_TYPE.cardMetricValue.lineHeight,
    fontWeight: APP_TYPE.cardMetricValue.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardBody.fontWeight,
    opacity: 0.6,
  },
});
