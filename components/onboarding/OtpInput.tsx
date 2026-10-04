import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useFocusAfterTransition } from '../../hooks/useFocusAfterTransition';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const LENGTH = 6;
const BOX_H = 60;

interface OtpInputProps {
  /** Current OTP value (up to 6 digits) */
  value: string;
  /** Called with the cleaned value on every change */
  onChangeText: (text: string) => void;
  /** Focus after the screen transition */
  autoFocus?: boolean;
  /** Error state — red boxes + shake */
  error?: boolean;
}

/**
 * OTP — שדה טקסט אחד (שקוף) שמקבל את כל ההקלדה/הדבקה/השלמת SMS,
 * ושש תיבות תצוגה מעליו. בלי קפיצת focus בין שדות — תגובה מיידית להקלדה.
 * ספרות תמיד LTR (משמאל לימין), גם באפליקציה בעברית.
 */
const OtpInput: React.FC<OtpInputProps> = ({ value, onChangeText, autoFocus = false, error = false }) => {
  const tokens = useDesignTokens();
  const inputRef = useFocusAfterTransition(autoFocus);
  const [focused, setFocused] = useState(false);
  const digits = (value || '').replace(/\D/g, '').slice(0, LENGTH);
  const activeIndex = Math.min(digits.length, LENGTH - 1);

  // רעידה בשגיאה
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!error) return;
    void HapticFeedback.error?.();
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, LENGTH);
    if (cleaned.length > digits.length) void HapticFeedback.selection();
    onChangeText(cleaned);
    if (cleaned.length === LENGTH) inputRef.current?.blur();
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <Animated.View style={[styles.row, shakeStyle]}>
        {Array.from({ length: LENGTH }).map((_, i) => (
          <OtpBox
            key={i}
            digit={digits[i] ?? ''}
            active={focused && i === activeIndex && digits.length < LENGTH}
            filled={i < digits.length}
            error={error}
            colors={{
              bg: tokens.colors.background.cardSolid,
              bgActive: tokens.colors.background.tertiary,
              text: tokens.colors.text.primary,
              border: tokens.colors.text.primary,
              danger: tokens.colors.danger.main,
            }}
          />
        ))}
      </Animated.View>

      {/* השדה האמיתי — שקוף ומכסה את התיבות (גם לחיצה עליו פותחת מקלדת) */}
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={LENGTH}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="קוד אימות בן 6 ספרות"
      />
    </Pressable>
  );
};

function OtpBox({
  digit,
  active,
  filled,
  error,
  colors,
}: {
  digit: string;
  active: boolean;
  filled: boolean;
  error: boolean;
  colors: { bg: string; bgActive: string; text: string; border: string; danger: string };
}) {
  // קפיצה קטנה כשנכנסת ספרה
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!digit) return;
    pop.value = withSequence(withTiming(1.02, { duration: 70 }), withTiming(1, { duration: 120 }));
  }, [digit, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // סמן מהבהב בתיבה הפעילה
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = active
      ? withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1)
      : 1;
  }, [active, blink]);
  const caretStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <Animated.View
      style={[
        styles.box,
        {
          backgroundColor: error ? `${colors.danger}1A` : active ? colors.bgActive : colors.bg,
          // עובי מסגרת קבוע — שינוי עובי הזיז את הספרה בפיקסל-שניים בכל הקלדה
          borderColor: error ? colors.danger : active ? colors.border : filled ? `${colors.border}55` : 'transparent',
        },
        popStyle,
      ]}
    >
      {digit ? (
        <Text style={[styles.digit, { color: error ? colors.danger : colors.text }]}>{digit}</Text>
      ) : active ? (
        <Animated.View style={[styles.caret, { backgroundColor: colors.text }, caretStyle]} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    // קודים תמיד LTR
    direction: 'ltr',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    flex: 1,
    maxWidth: 52,
    height: BOX_H,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: APP_TYPE.cardMetricValueSecondary.fontSize + 4,
    fontWeight: APP_TYPE.cardMetricValueSecondary.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  caret: {
    width: 2,
    height: 26,
    borderRadius: 1,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.011,
    color: 'transparent',
    fontSize: 1,
  },
});

export default OtpInput;
