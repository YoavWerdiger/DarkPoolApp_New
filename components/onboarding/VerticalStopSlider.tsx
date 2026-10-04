import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const TRACK_H = 280;
const KNOB = 30;
const TRACK_W = 6;
const RANGE = TRACK_H - KNOB;
const SPRING = { damping: 20, stiffness: 220, mass: 0.6, overshootClamping: true };

type Option = { label: string; value: string; description?: string; shortLabel?: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
};

/**
 * סליידר אנכי — גוררים למעלה כדי לעלות ברמה (התחתית = הראשונה).
 * מימין המסלול עם תוויות העצירות, משמאל מד עמודות + שם והסבר הרמה.
 */
export function VerticalStopSlider({ options, value, onChange }: Props) {
  const tokens = useDesignTokens();
  const count = options.length;
  const initial = Math.max(0, options.findIndex((o) => o.value === value));
  const [index, setIndex] = useState(initial);
  const step = count > 1 ? RANGE / (count - 1) : 0;

  /** מרחק הידית מהתחתית בפיקסלים */
  const pos = useSharedValue(initial * step);
  const start = useSharedValue(0);

  useEffect(() => {
    if (!value && options[0]) onChange(options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (i: number) => {
      setIndex(i);
      void HapticFeedback.selection();
      onChange(options[i].value);
    },
    [onChange, options],
  );

  // רטט + עדכון בכל מעבר עצירה בזמן הגרירה
  useAnimatedReaction(
    () => (step > 0 ? Math.round(pos.value / step) : 0),
    (i, prev) => {
      if (prev !== null && i !== prev && i >= 0 && i < count) runOnJS(select)(i);
    },
    [step, count],
  );

  const pan = Gesture.Pan()
    .activeOffsetY([-3, 3])
    .onBegin(() => {
      start.value = pos.value;
    })
    .onUpdate((e) => {
      // גרירה למעלה (translationY שלילי) = עלייה ברמה
      pos.value = Math.min(RANGE, Math.max(0, start.value - e.translationY));
    })
    .onEnd(() => {
      const i = step > 0 ? Math.round(pos.value / step) : 0;
      pos.value = withSpring(i * step, SPRING);
    });

  const knobStyle = useAnimatedStyle(() => ({ bottom: pos.value }));
  const fillStyle = useAnimatedStyle(() => ({ height: pos.value + KNOB / 2 }));

  const current = options[index];

  return (
    <View style={styles.row}>
      {/* מסלול + תוויות (ימין) */}
      <View style={styles.trackCol}>
        <GestureDetector gesture={pan}>
          <View style={styles.trackArea} collapsable={false}>
            <View style={[styles.track, { backgroundColor: tokens.colors.border.divider }]} />
            <Animated.View style={[styles.trackFill, { backgroundColor: tokens.colors.text.primary }, fillStyle]} />
            {options.map((o, i) => (
              <Pressable
                key={o.value}
                hitSlop={16}
                onPress={() => {
                  pos.value = withSpring(i * step, SPRING);
                  if (i !== index) select(i);
                }}
                style={[
                  styles.stop,
                  {
                    bottom: i * step + KNOB / 2 - 5,
                    backgroundColor: i <= index ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                  },
                ]}
              />
            ))}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.knob,
                { backgroundColor: tokens.colors.text.primary, borderColor: tokens.colors.background.primary },
                knobStyle,
              ]}
            />
          </View>
        </GestureDetector>
        <View style={styles.labelsCol}>
          {options.map((o, i) => (
            <Text
              key={o.value}
              onPress={() => {
                pos.value = withSpring(i * step, SPRING);
                if (i !== index) select(i);
              }}
              style={[
                styles.stopLabel,
                {
                  bottom: i * step + KNOB / 2 - 10,
                  color: i === index ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                  fontWeight: i === index ? APP_TYPE.cardTitle.fontWeight : APP_TYPE.cardBody.fontWeight,
                },
              ]}
              numberOfLines={1}
            >
              {o.shortLabel ?? o.label}
            </Text>
          ))}
        </View>
      </View>

      {/* ויזואל (שמאל) */}
      <View style={[styles.hero, { backgroundColor: tokens.colors.background.cardSolid }]}>
        <View style={styles.bars}>
          {Array.from({ length: count }).map((_, i) => (
            <Bar
              key={i}
              on={i <= index}
              height={20 + i * 18}
              color={tokens.colors.text.primary}
            />
          ))}
        </View>
        <Animated.Text
          key={`l-${current?.value}`}
          entering={FadeIn.duration(200)}
          style={[styles.heroLabel, { color: tokens.colors.text.primary }]}
        >
          {current?.label}
        </Animated.Text>
        {current?.description ? (
          <Animated.Text
            key={`d-${current.value}`}
            entering={FadeIn.duration(200)}
            style={[styles.heroDesc, { color: tokens.colors.text.secondary }]}
          >
            {current.description}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

function Bar({ on, height, color }: { on: boolean; height: number; color: string }) {
  const h = useSharedValue(on ? height : 10);
  useEffect(() => {
    h.value = withSpring(on ? height : 10, SPRING);
  }, [on, height, h]);
  const style = useAnimatedStyle(() => ({ height: h.value, opacity: on ? 1 : 0.18 }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: {
    // row-reverse: המסלול בצד ימין
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: APP_LAYOUT.componentGap,
    height: TRACK_H + 20,
  },
  trackCol: {
    flexDirection: 'row-reverse',
    width: 150,
    paddingVertical: 10,
  },
  trackArea: {
    width: KNOB + 8,
    height: TRACK_H,
    alignItems: 'center',
  },
  track: {
    position: 'absolute',
    top: KNOB / 2,
    bottom: KNOB / 2,
    width: TRACK_W,
    borderRadius: TRACK_W / 2,
  },
  trackFill: {
    position: 'absolute',
    bottom: 0,
    width: TRACK_W,
    borderRadius: TRACK_W / 2,
  },
  stop: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  labelsCol: {
    flex: 1,
    height: TRACK_H,
    marginRight: APP_LAYOUT.stackGapSmall,
  },
  stopLabel: {
    position: 'absolute',
    right: 0,
    left: 0,
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hero: {
    flex: 1,
    borderRadius: UI_CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_LAYOUT.cardPadding,
    gap: APP_LAYOUT.stackGapTight,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: 80,
  },
  bar: {
    width: 13,
    borderRadius: 7,
  },
  heroLabel: {
    minHeight: APP_TYPE.cardTitle.lineHeight * 2,
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroDesc: {
    minHeight: APP_TYPE.cardSubtitle.lineHeight * 3,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
