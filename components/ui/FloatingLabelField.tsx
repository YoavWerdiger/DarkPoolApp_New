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
  /** רב-שורתי: התווית קבועה למעלה, השדה גדל עם הטקסט (minHeight) */
  multiline?: boolean;
  minHeight?: number;
  /** אלמנט בצד הנגדי (למשל עין להצגת סיסמה) */
  trailing?: React.ReactNode;
  /** תיאור עזר בתוך הפוקוס של התווית — לנגישות / בדיקות */
  testID?: string;
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
  multiline,
  minHeight = 104,
  trailing,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const t = useDesignTokens();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const floated = focused || value.length > 0 || !!loading || !!multiline;
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
      <Animated.View
        style={[
          styles.shell,
          multiline && { height: undefined, minHeight, justifyContent: 'flex-start', paddingTop: 10, paddingBottom: 12 },
          trailing ? { paddingLeft: 52 } : null,
          shellStyle,
          error && { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
        ]}
      >
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.label, multiline && styles.labelMultiline, appPhysicalRightText, labelStyle]}
        >
          {label}
        </Animated.Text>
        <Animated.View style={[styles.inputWrap, multiline && styles.inputWrapMultiline, inputStyle]}>
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
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            style={[
              styles.input,
              multiline && { minHeight: minHeight - 44 },
              { color: readOnly ? t.colors.text.secondary : t.colors.text.primary },
              ltr ? styles.ltr : appPhysicalRightText,
            ]}
            {...rest}
          />
          )}
        </Animated.View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
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
  // רב-שורתי: התווית קבועה למעלה (בלי מרכוז אנכי), הטקסט מתחתיה
  labelMultiline: { top: 10 - RISE + 4 },
  inputWrapMultiline: { marginTop: 18 },
  // צד נגדי (שמאל בעברית) — כפתור/אייקון
  trailing: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  input: {
    ...APP_TYPE.body,
    lineHeight: 22,
    padding: 0,
  },
  // ערך LTR (אימייל / טלפון) — נכתב משמאל לימין אבל מיושר מתחת לתווית (ימין)
  ltr: { ...appPhysicalRightText, writingDirection: 'ltr' },
  // מיושר לטקסט שבתוך השדה (PAD_H)
  helper: { ...APP_TYPE.caption, marginTop: 6, paddingHorizontal: PAD_H },
  groupLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2, marginBottom: 8, paddingHorizontal: PAD_H },
});

/**
 * תווית מעל קבוצת כפתורים / בחירה (לא שדה טקסט) — למשל «מגדר» מעל זכר/נקבה.
 * סגנון F: 13 · 600 · אפור, מיושרת לטקסט שבתוך השדות (PAD_H) — תואמת לשדות עם התווית הצפה.
 */
export function FieldGroupLabel({ children }: { children: React.ReactNode }) {
  const t = useDesignTokens();
  return (
    <Text style={[styles.groupLabel, appPhysicalRightText, { color: t.colors.text.secondary }]} numberOfLines={1}>
      {children}
    </Text>
  );
}
