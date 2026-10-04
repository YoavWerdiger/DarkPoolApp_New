import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const KNOB = 30;
const TRACK_H = 6;
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

export type StopOption = {
  label: string;
  value: string;
  description?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  options: StopOption[];
  value: string;
  onChange: (v: string) => void;
  /** ויזואל גדול מעל — 'level' = מד עמודות, 'icon' = אייקון, 'money' = מונה כסף מתגלגל */
  hero: 'level' | 'icon' | 'money';
};

/**
 * בחירה בסליידר עם עצירות (במקום רשימה): ויזואל גדול משתנה מעל,
 * גרירה או הקשה על עצירה, רטט בכל מעבר עצירה. RTL — האופציה הראשונה מימין.
 */
export function StopSlider({ options, value, onChange, hero }: Props) {
  const tokens = useDesignTokens();
  const count = options.length;
  const initial = Math.max(0, options.findIndex((o) => o.value === value));
  const [index, setIndex] = useState(initial < 0 ? 0 : initial);
  const [trackW, setTrackW] = useState(0);
  /** מיקום הידית בפיקסלים מימין (RTL) */
  const pos = useSharedValue(0);
  const start = useSharedValue(0);
  const step = count > 1 ? trackW / (count - 1) : 0;

  useEffect(() => {
    if (trackW > 0) pos.value = index * step;
    // מיקום התחלתי בלבד כשהרוחב נמדד
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW]);

  useEffect(() => {
    // בחירה ראשונית — שהכפתור «המשך» יהיה פעיל
    if (!value && options[index]) onChange(options[index].value);
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
    .activeOffsetX([-3, 3])
    .onBegin(() => {
      start.value = pos.value;
    })
    .onUpdate((e) => {
      // RTL: גרירה שמאלה = התקדמות
      pos.value = Math.min(trackW, Math.max(0, start.value - e.translationX));
    })
    .onEnd(() => {
      const i = step > 0 ? Math.round(pos.value / step) : 0;
      pos.value = withSpring(i * step, SPRING);
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pos.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: pos.value + KNOB / 2 }));

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width - KNOB);

  const current = options[index];

  return (
    <View style={styles.wrap}>
      {/* ויזואל גדול */}
      <View style={[styles.hero, { backgroundColor: tokens.colors.background.cardSolid }]}>
        {hero === 'money' ? (
          <MoneyCounter
            index={index}
            total={count}
            color={tokens.colors.text.primary}
            accent={tokens.colors.primary.main}
          />
        ) : hero === 'level' ? (
          <BigLevel level={index + 1} total={count} color={tokens.colors.text.primary} accent={tokens.colors.primary.main} />
        ) : current?.icon ? (
          <Animated.View key={current.value} entering={ZoomIn.duration(240)}>
            <Ionicons name={current.icon} size={56} color={tokens.colors.text.primary} />
          </Animated.View>
        ) : null}
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
            entering={FadeIn.duration(220)}
            style={[styles.heroDesc, { color: tokens.colors.text.secondary }]}
          >
            {current.description}
          </Animated.Text>
        ) : null}
      </View>

      {/* סליידר */}
      <GestureDetector gesture={pan}>
        <View style={styles.trackArea} onLayout={onTrackLayout} collapsable={false}>
          <View style={[styles.track, { backgroundColor: tokens.colors.border.divider }]} />
          <Animated.View style={[styles.trackFill, { backgroundColor: tokens.colors.text.primary }, fillStyle]} />
          {options.map((o, i) => (
            <Pressable
              key={o.value}
              hitSlop={14}
              onPress={() => {
                pos.value = withSpring(i * step, SPRING);
                if (i !== index) select(i);
              }}
              style={[
                styles.stop,
                {
                  right: i * step + KNOB / 2 - 5,
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

      <View style={styles.endLabels}>
        <Text style={[styles.endText, { color: tokens.colors.text.tertiary }]}>{options[0]?.label}</Text>
        <Text style={[styles.endText, { color: tokens.colors.text.tertiary }]}>
          {options[count - 1]?.label}
        </Text>
      </View>
    </View>
  );
}

/** יעד הסכום לכל טווח גודל תיק (המונה סופר אליו) */
const MONEY_TARGETS = [10_000, 50_000, 100_000, 250_000];

/**
 * מונה כסף מתגלגל — הסכום סופר בין יעדים בזמן הגרירה (ease-out),
 * והטווח העליון מקבל «+» והבהוב ירוק.
 */
function MoneyCounter({ index, total, color, accent }: { index: number; total: number; color: string; accent: string }) {
  const target = MONEY_TARGETS[Math.min(index, MONEY_TARGETS.length - 1)];
  const isTop = index === total - 1;
  const [shown, setShown] = useState(target);
  const fromRef = React.useRef(target);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return undefined;
    const startT = Date.now();
    const DUR = 520;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - startT) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * eased);
      setShown(v);
      fromRef.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => {
    if (isTop) {
      pulse.value = 0;
      pulse.value = withSpring(1, { damping: 18, stiffness: 140, mass: 0.6 });
    } else {
      pulse.value = withSpring(0, SPRING);
    }
  }, [isTop, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.02 }],
  }));

  return (
    <Animated.View style={[styles.moneyRow, style]}>
      <Text
        style={[styles.money, { color: isTop ? accent : color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        ${shown.toLocaleString('en-US')}
        {isTop ? '+' : ''}
      </Text>
    </Animated.View>
  );
}

/** מד רמה גדול — עמודות עולות שמתמלאות עד הרמה */
function BigLevel({ level, total, color, accent }: { level: number; total: number; color: string; accent: string }) {
  return (
    <View style={styles.bigBars}>
      {Array.from({ length: total }).map((_, i) => (
        <Bar key={i} on={i < level} height={22 + i * 16} color={i < level ? (level === total ? accent : color) : color} />
      ))}
    </View>
  );
}

function Bar({ on, height, color }: { on: boolean; height: number; color: string }) {
  const h = useSharedValue(on ? height : 10);
  useEffect(() => {
    h.value = withSpring(on ? height : 10, SPRING);
  }, [on, height, h]);
  const style = useAnimatedStyle(() => ({ height: h.value, opacity: on ? 1 : 0.18 }));
  return <Animated.View style={[styles.bigBar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    gap: APP_LAYOUT.sectionGap / 2 + 4,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    paddingVertical: APP_LAYOUT.sectionGap / 2 + 4,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    borderRadius: UI_CARD_RADIUS,
    gap: APP_LAYOUT.stackGapTight,
  },
  heroLabel: {
    minHeight: APP_TYPE.sectionTitle.lineHeight,
    fontSize: APP_TYPE.sectionTitle.fontSize,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroDesc: {
    minHeight: APP_TYPE.cardBody.lineHeight * 2,
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  moneyRow: {
    direction: 'ltr',
    alignSelf: 'stretch',
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
  },
  money: {
    fontSize: APP_TYPE.cardMetricValue.fontSize + 8,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  bigBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 74,
  },
  bigBar: {
    width: 14,
    borderRadius: 7,
  },
  trackArea: {
    height: KNOB + 16,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: KNOB / 2,
    right: KNOB / 2,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  trackFill: {
    position: 'absolute',
    right: 0,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  stop: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  knob: {
    position: 'absolute',
    right: 0,
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
  endLabels: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: -APP_LAYOUT.componentGap,
  },
  endText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    writingDirection: 'rtl',
  },
});
