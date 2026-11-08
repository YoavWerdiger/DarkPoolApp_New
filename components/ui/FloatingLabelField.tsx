/**
 * שדה עם תווית צפה (בתוך השדה):
 * ריק ולא בפוקוס — התווית בגודל מלא באמצע השדה (משמשת כהינט);
 * בפוקוס / יש ערך — התווית עולה בחלקות לראש השדה וקטנה, והערך מתחתיה.
 * hint (אופציונלי) — דוגמה שמופיעה רק כשהשדה ריק ובפוקוס.
 * עדיין לא בשימוש באפליקציה — בהשוואה במסך DevLabelLab.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SkeletonLine } from './SkeletonLoader';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDesignTokens } from './DesignTokens';
import { APP_TYPE, appPhysicalRightText } from './appType';
import { formFieldPlaceholderColor } from './formControl';

const HEIGHT = 60;
const PAD_H = 18;
/** גודל התווית: באמצע = גוף (16), למעלה = 12 */
const LABEL_FULL = APP_TYPE.body.fontSize;
const LABEL_SMALL = 12;
const SCALE = LABEL_SMALL / LABEL_FULL;
/** כמה התווית עולה מהמרכז לראש השדה */
const RISE = 11;

type Props = Omit<TextInputProps, 'placeholder' | 'style'> & {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: boolean;
  ltr?: boolean;
  /** רקע השדה במנוחה (ברירת מחדל background.input); בפוקוס — tertiary */
  surface?: string;
  /** קריאה בלבד — הערך מוצג, בלי מקלדת (למשל אימייל) */
  readOnly?: boolean;
  /** הערה מתחת לשדה */
  helper?: string;
  /** טעינה: שלד במקום הערך (התווית כבר למעלה) */
  loading?: boolean;
};

export function FloatingLabelField({
  label,
  hint,
  value,
  onChangeText,
  error,
  ltr,
  surface,
  readOnly,
  helper,
  loading,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const t = useDesignTokens();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const floated = focused || value.length > 0 || !!loading;
  const p = useSharedValue(floated ? 1 : 0);
  const f = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const cfg = { duration: 180, easing: Easing.out(Easing.cubic) };
    p.value = reduceMotion ? (floated ? 1 : 0) : withTiming(floated ? 1 : 0, cfg);
    f.value = reduceMotion ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, cfg);
  }, [floated, focused, reduceMotion, p, f]);

  const restColor = String(formFieldPlaceholderColor(t));
  const upColor = String(error ? t.colors.danger.main : t.colors.text.secondary);
  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p.value, [0, 1], [0, -RISE]) },
      { scale: interpolate(p.value, [0, 1], [1, SCALE]) },
    ],
    color: interpolateColor(p.value, [0, 1], [restColor, upColor]),
  }));
  const inputStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [4, 0]) }],
  }));
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      f.value,
      [0, 1],
      [String(surface ?? t.colors.background.input), String(t.colors.background.tertiary)],
    ),
  }));

  return (
    <View>
    <Pressable onPress={() => !readOnly && inputRef.current?.focus()} accessible={false} disabled={readOnly}>
      <Animated.View style={[styles.shell, shellStyle, error && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.label, appPhysicalRightText, labelStyle]}
        >
          {label}
        </Animated.Text>
        <Animated.View style={[styles.inputWrap, inputStyle]}>
          {loading ? (
            <SkeletonLine lineHeight={22} width="46%" box={14} align="flex-end" />
          ) : (
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            placeholder={focused && !value ? hint : undefined}
            placeholderTextColor={formFieldPlaceholderColor(t)}
            accessibilityLabel={label}
            editable={!readOnly}
            style={[
              styles.input,
              { color: readOnly ? t.colors.text.secondary : t.colors.text.primary },
              ltr ? styles.ltr : appPhysicalRightText,
            ]}
            {...rest}
          />
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
    {helper ? (
      <Text style={[styles.helper, appPhysicalRightText, { color: t.colors.text.muted }]}>{helper}</Text>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: HEIGHT,
    // כמו כרטיסי ההגדרות (26)
    borderRadius: 26,
    paddingHorizontal: PAD_H,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // ממורכזת אנכית; ה-scale מקטין לכיוון הקצה הימני (תחילת השורה)
  label: {
    position: 'absolute',
    left: PAD_H,
    right: PAD_H,
    fontSize: LABEL_FULL,
    lineHeight: 22,
    fontWeight: '500',
    transformOrigin: 'right center',
  },
  inputWrap: { marginTop: 14 },
  input: {
    ...APP_TYPE.body,
    lineHeight: 22,
    padding: 0,
  },
  // ערך LTR (אימייל / טלפון) — נכתב משמאל לימין אבל מיושר מתחת לתווית (ימין)
  ltr: { ...appPhysicalRightText, writingDirection: 'ltr' },
  // מיושר לטקסט שבתוך השדה (PAD_H)
  helper: { ...APP_TYPE.caption, marginTop: 6, paddingHorizontal: PAD_H },
});
