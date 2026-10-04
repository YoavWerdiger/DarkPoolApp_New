import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { UI_CARD_RADIUS } from '../ui/appLayout';
import { HapticFeedback } from '../../utils/hapticFeedback';

const ITEM_H = 64;
const VISIBLE = 5;
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

type Props = {
  values: number[];
  value: number;
  onChange: (v: number) => void;
};

/**
 * גלגל בחירה אנכי (סגנון iOS / Cal AI): הערך במרכז גדול ובולט,
 * השכנים קטנים ודהויים, רטט קל בכל מעבר ערך.
 * Animated של RN + ScrollView רגיל — גלילה יציבה גם בתוך OnboardingLayout.
 */
export function WheelPicker({ values, value, onChange }: Props) {
  const tokens = useDesignTokens();
  const initialIndex = useMemo(() => Math.max(0, values.indexOf(value)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_H)).current;
  const scrollRef = useRef<Animated.LegacyRef<typeof Animated.ScrollView> | null>(null);
  const tickIndex = useRef(initialIndex);

  // מיקום התחלתי — אחרי layout (contentOffset לבד לא תמיד נתפס ב-Android)
  useEffect(() => {
    const t = setTimeout(() => {
      (scrollRef.current as unknown as { scrollTo?: (o: { y: number; animated: boolean }) => void })?.scrollTo?.({
        y: initialIndex * ITEM_H,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [initialIndex]);

  const indexFromEvent = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const idx = indexFromEvent(e);
          if (idx !== tickIndex.current) {
            tickIndex.current = idx;
            void HapticFeedback.selection();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollY, values.length],
  );

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onChange(values[indexFromEvent(e)]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, values],
  );

  return (
    <View style={styles.wrap}>
      {/* פס הבחירה במרכז */}
      <View
        pointerEvents="none"
        style={[styles.band, { backgroundColor: tokens.colors.background.cardSolid }]}
      />
      <Animated.ScrollView
        ref={scrollRef as never}
        style={styles.scroll}
        contentContainerStyle={{ paddingVertical: PAD }}
        contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // גרירה איטית בלי מומנטום — onMomentumScrollEnd לא נורה
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) settle(e);
        }}
        nestedScrollEnabled
      >
        {values.map((v, i) => {
          const inputRange = [(i - 2) * ITEM_H, (i - 1) * ITEM_H, i * ITEM_H, (i + 1) * ITEM_H, (i + 2) * ITEM_H];
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.5, 0.66, 1, 0.66, 0.5],
            extrapolate: 'clamp',
          });
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.12, 0.35, 1, 0.35, 0.12],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={v} style={[styles.item, { opacity, transform: [{ scale }] }]}>
              <Text style={[styles.itemText, { color: tokens.colors.text.primary }]}>{v}</Text>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_H * VISIBLE,
    justifyContent: 'center',
  },
  scroll: {
    height: ITEM_H * VISIBLE,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_H,
    borderRadius: UI_CARD_RADIUS,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    // הערך הנבחר בולט — 48 (scale של השכנים מקטין אותם)
    fontSize: 48,
    lineHeight: 56,
    fontWeight: APP_TYPE.cardMetricValue.fontWeight,
    fontVariant: ['tabular-nums'],
  },
});
