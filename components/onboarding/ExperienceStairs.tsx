import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const AREA_H = 316;
/** גובה המדרגה הנמוכה — מספיק למספר + שם בשתי שורות */
const STEP_H = 74;
const MARKER = 40;
/** מרווח בין ראש המדרגה לדגל */
const FLAG_GAP = 10;
const SPRING = { damping: 14, stiffness: 160, mass: 0.7 };

type Option = { label: string; value: string; description?: string };

/** שם קצר על המדרגה עצמה (התווית המלאה מופיעה מתחת) */
const SHORT_LABELS: Record<string, string> = {
  first_steps: 'צעדים ראשונים',
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
};

/** מדרגה לחיצה — מתכווצת במגע, ו«פועמת» פעם אחת בכניסה כרמז שאפשר ללחוץ */
function Step({
  index,
  reached,
  selected,
  shortLabel,
  label,
  onPress,
  hintDelay,
}: {
  index: number;
  reached: boolean;
  selected: boolean;
  shortLabel: string;
  label: string;
  onPress: () => void;
  hintDelay: number | null;
}) {
  const tokens = useDesignTokens();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (hintDelay == null) return;
    scale.value = withDelay(
      hintDelay,
      withSequence(withTiming(1.06, { duration: 160 }), withSpring(1, { damping: 10, stiffness: 260 })),
    );
  }, [hintDelay, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fg = reached ? tokens.colors.text.inverse : tokens.colors.text.primary;

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.94, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        style={[
          styles.step,
          {
            backgroundColor: reached ? tokens.colors.text.primary : tokens.colors.background.cardSolid,
            borderColor: reached ? 'transparent' : tokens.colors.border.divider,
          },
        ]}
      >
        <Text style={[styles.stepNum, { color: fg }]}>{index + 1}</Text>
        <Text style={[styles.stepLabel, { color: fg }]} numberOfLines={2}>
          {shortLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
};

/**
 * רמת ניסיון כ«מדרגות טיפוס»: מדרגות עולות באלכסון (RTL — מימין-למטה לשמאל-למעלה),
 * לחיצה על מדרגה מקפיצה אליה דגל בקשת, והמדרגות שמתחת מתמלאות.
 */
export function ExperienceStairs({ options, value, onChange }: Props) {
  const tokens = useDesignTokens();
  const count = options.length;
  const initial = Math.max(0, options.findIndex((o) => o.value === value));
  const [index, setIndex] = useState(initial);
  const [areaW, setAreaW] = useState(0);

  const stepW = areaW > 0 ? areaW / count : 0;
  const rise = (AREA_H - STEP_H - MARKER - FLAG_GAP) / Math.max(1, count - 1);
  /** מיקום מדרגה i: right מהקצה הימני, bottom מהתחתית */
  const stepPos = (i: number) => ({ right: i * stepW, bottom: i * rise });

  const mx = useSharedValue(0);
  const my = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    if (!value && options[0]) onChange(options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stepW) return;
    const p = stepPos(index);
    mx.value = withSpring(p.right + stepW / 2 - MARKER / 2, SPRING);
    my.value = withSpring(p.bottom + STEP_H + FLAG_GAP, SPRING);
    // קשת קפיצה בזמן המעבר
    hop.value = withSequence(withTiming(-26, { duration: 170 }), withSpring(0, SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stepW]);

  const markerStyle = useAnimatedStyle(() => ({
    right: mx.value,
    bottom: my.value,
    transform: [{ translateY: hop.value }],
  }));

  const pick = (i: number) => {
    if (i === index) return;
    void HapticFeedback.selection();
    setIndex(i);
    onChange(options[i].value);
  };

  const current = options[index];

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.hintRow}>
        <Ionicons name="hand-left-outline" size={16} color={tokens.colors.text.secondary} />
        <Text style={[styles.hint, { color: tokens.colors.text.secondary }]}>לחץ על המדרגה שמתאימה לך</Text>
      </Animated.View>
      <View
        style={styles.area}
        onLayout={(e: LayoutChangeEvent) => setAreaW(e.nativeEvent.layout.width)}
      >
        {stepW > 0
          ? options.map((o, i) => {
              const p = stepPos(i);
              const reached = i <= index;
              return (
                <Animated.View
                  key={o.value}
                  entering={FadeInUp.delay(250 + i * 90).duration(360)}
                  style={[styles.stepWrap, { right: p.right, bottom: 0, width: stepW - 6, height: p.bottom + STEP_H }]}
                >
                  <Step
                    index={i}
                    reached={reached}
                    selected={i === index}
                    shortLabel={SHORT_LABELS[o.value] ?? o.label}
                    label={o.label}
                    onPress={() => pick(i)}
                    hintDelay={i > index ? 750 + (i - index) * 160 : null}
                  />
                </Animated.View>
              );
            })
          : null}

        {stepW > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.marker, markerStyle]}>
            <View style={[styles.markerDot, { backgroundColor: tokens.colors.primary.main }]}>
              <Ionicons name="flag" size={20} color="#FFFFFF" />
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.textBlock}>
        <Animated.Text
          key={`l-${current?.value}`}
          entering={FadeIn.duration(200)}
          style={[styles.label, { color: tokens.colors.text.primary }]}
        >
          {current?.label}
        </Animated.Text>
        {current?.description ? (
          <Animated.Text
            key={`d-${current.value}`}
            entering={FadeIn.duration(200)}
            style={[styles.desc, { color: tokens.colors.text.secondary }]}
          >
            {current.description}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: APP_LAYOUT.componentGap + 4,
  },
  area: {
    height: AREA_H,
  },
  stepWrap: {
    position: 'absolute',
    justifyContent: 'flex-start',
  },
  step: {
    // מדרגה = עמוד מלא מהקרקע עד גובה המדרגה
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 6,
    gap: 4,
  },
  stepLabel: {
    alignSelf: 'stretch',
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: APP_TYPE.caption.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  hintRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: -APP_LAYOUT.stackGapSmall,
  },
  hint: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    writingDirection: 'rtl',
  },
  stepNum: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'center',
  },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
  },
  markerDot: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
    minHeight: 76,
  },
  label: {
    fontSize: APP_TYPE.sectionTitle.fontSize,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  desc: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
