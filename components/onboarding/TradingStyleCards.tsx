import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHART_W = 104;
const CHART_H = 44;
/** אורך מספיק לכל אחד מהמסלולים — dash = אורך מלא, offset יורד ל-0 = ציור */
const PATH_LEN = 360;

/** כל סגנון — מסלול שמדגים את הקצב שלו */
const STYLE_PATHS: Record<string, string> = {
  // זיגזג צפוף — תנודות תוך-יומיות
  day_trading:
    'M2 30 L10 18 L16 26 L22 12 L28 24 L34 16 L40 30 L46 14 L52 22 L58 10 L64 26 L70 18 L76 28 L82 12 L88 20 L94 8 L102 16',
  // גלים רחבים — ימים עד שבועות
  swing: 'M2 32 C16 32 18 12 32 12 C46 12 46 30 60 30 C74 30 76 8 90 8 C96 8 99 12 102 14',
  // עלייה מתונה ויציבה — חודשים עד שנים
  long_term: 'M2 40 C20 38 30 34 44 28 C58 22 66 22 76 16 C86 10 94 8 102 4',
};

const STYLE_META: Record<string, { horizon: string }> = {
  day_trading: { horizon: 'דקות עד שעות' },
  swing: { horizon: 'ימים עד שבועות' },
  long_term: { horizon: 'חודשים עד שנים' },
};

type Option = { label: string; value: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
};

/**
 * בחירת סגנון מסחר — כרטיס לכל סגנון עם גרף קטן שמצייר את עצמו
 * ומדגים את הקצב (יומי = זיגזג, סווינג = גלים, ארוך = עלייה מתונה).
 */
export function TradingStyleCards({ options, value, onChange }: Props) {
  return (
    <View style={{ gap: APP_LAYOUT.stackGapTight }}>
      {options.map((opt, i) => (
        <StyleCard
          key={opt.value}
          option={opt}
          index={i}
          selected={opt.value === value}
          onPress={() => {
            if (opt.value === value) return;
            void HapticFeedback.selection();
            onChange(opt.value);
          }}
        />
      ))}
    </View>
  );
}

function StyleCard({
  option,
  index,
  selected,
  onPress,
}: {
  option: Option;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const tokens = useDesignTokens();
  const draw = useRef(new Animated.Value(PATH_LEN)).current;
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // ציור ראשוני אחרי הכניסה המדורגת
  useEffect(() => {
    Animated.timing(draw, {
      toValue: 0,
      duration: 900,
      delay: 380 + index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [draw, index]);

  // בבחירה — מילוי הפוך, קפיצה קלה וציור מחדש של הגרף
  useEffect(() => {
    Animated.timing(fill, {
      toValue: selected ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    if (selected) {
      draw.setValue(PATH_LEN);
      Animated.parallel([
        Animated.timing(draw, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.spring(scale, { toValue: 1.02, useNativeDriver: false, speed: 40, bounciness: 8 }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 6 }),
        ]),
      ]).start();
    }
  }, [selected, draw, fill, scale]);

  const meta = STYLE_META[option.value];
  const pathD = STYLE_PATHS[option.value];
  const fg = selected ? tokens.colors.text.inverse : tokens.colors.text.primary;
  const sub = selected ? tokens.colors.text.inverse : tokens.colors.text.secondary;
  const stroke = selected ? tokens.colors.text.inverse : tokens.colors.primary.main;

  return (
    <Reanimated.View entering={FadeInDown.delay(300 + index * 70).duration(380)}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: false, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40 }).start()}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${option.label}, ${meta?.horizon ?? ''}`}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: fill.interpolate({
                inputRange: [0, 1],
                outputRange: [tokens.colors.background.cardSolid, tokens.colors.text.primary],
              }),
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.textCol}>
            <Text style={[styles.label, { color: fg }]}>{option.label}</Text>
            {meta ? (
              <View style={styles.horizonRow}>
                <Ionicons name="time-outline" size={14} color={sub} />
                <Text style={[styles.horizon, { color: sub }]}>{meta.horizon}</Text>
              </View>
            ) : null}
          </View>

          {pathD ? (
            <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <AnimatedPath
                d={pathD}
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={`${PATH_LEN} ${PATH_LEN}`}
                strokeDashoffset={draw}
              />
            </Svg>
          ) : null}
        </Animated.View>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: APP_LAYOUT.componentGap,
    minHeight: 96,
    paddingHorizontal: APP_LAYOUT.cardPadding + 4,
    paddingVertical: APP_LAYOUT.cardPadding,
    borderRadius: UI_CARD_RADIUS,
  },
  textCol: {
    flex: 1,
    gap: 6,
  },
  label: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.sectionTitle.fontSize - 2,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
  },
  horizonRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  horizon: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardSubtitle.fontWeight,
    writingDirection: 'rtl',
  },
});
