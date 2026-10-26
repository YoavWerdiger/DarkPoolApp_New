import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, FadeIn, FadeInDown, useAnimatedProps, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Confetti } from '../onboarding/Confetti';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const RING = 168;
const STROKE = 8;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const FILL_MS = 900;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/**
 * מסך סיום קורס — כמו סיום יצירת החשבון (RegistrationSummaryScreen):
 * טבעת שמתמלאת, וי, קונפטי וכפתור CTA.
 * שכבה על המסך (לא Modal — בלי בעיות מודאלים ב-iOS).
 */
export function CourseCompletionOverlay({
  courseTitle,
  lessonsCount,
  onClose,
}: {
  courseTitle?: string | null;
  lessonsCount: number;
  onClose: () => void;
}) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [done, setDone] = React.useState(false);

  useEffect(() => {
    progress.value = withTiming(100, { duration: FILL_MS, easing: Easing.bezier(0.45, 0.05, 0.35, 1) });
    const t = setTimeout(() => {
      setDone(true);
      void HapticFeedback.success();
    }, FILL_MS + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value / 100),
  }));

  return (
    <Reanimated.View
      entering={FadeIn.duration(220)}
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        {
          backgroundColor: tokens.colors.background.primary,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.centered}>
        <View style={styles.ring}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={tokens.colors.border.divider} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={tokens.colors.text.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          {done ? (
            <Reanimated.View entering={ZoomIn.duration(260)} style={styles.ringInner}>
              <View style={[styles.check, { backgroundColor: tokens.colors.text.primary }]}>
                <Ionicons name="checkmark" size={64} color={tokens.colors.text.inverse} />
              </View>
            </Reanimated.View>
          ) : null}
        </View>

        {done ? (
          <Reanimated.View entering={FadeInDown.delay(150).duration(380)} style={styles.textBlock}>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>סיימת את הקורס!</Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              {courseTitle
                ? `השלמת את כל ${lessonsCount} השיעורים בקורס ${courseTitle}. כל הכבוד.`
                : `השלמת את כל ${lessonsCount} השיעורים. כל הכבוד.`}
            </Text>
          </Reanimated.View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <UIButton
          title="חזרה לקורס"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!done}
          onPress={() => {
            void HapticFeedback.impactLight();
            onClose();
          }}
        />
      </View>

      <Confetti
        fire={done}
        colors={[tokens.colors.primary.main, tokens.colors.text.primary, '#FFC531', '#8E8E93', '#00E63D']}
      />
    </Reanimated.View>
  );
}

const CHECK = RING - STROKE * 2 - 12;

const styles = StyleSheet.create({
  root: {
    zIndex: 3000,
    elevation: 30,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_LAYOUT.sectionGap,
  },
  ringInner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  title: {
    fontSize: APP_TYPE.flowTitle.fontSize,
    lineHeight: APP_TYPE.flowTitle.lineHeight,
    fontWeight: APP_TYPE.flowTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  footer: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
});
