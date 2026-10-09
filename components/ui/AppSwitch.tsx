import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Switch, type SwitchProps } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const TRACK_W = 51;
const TRACK_H = 31;
const THUMB = 27;
const PAD = 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

/**
 * מתג אחיד: ב-iOS — ה-UISwitch של המערכת (כמו היום). באנדרואיד ה-Switch של RN הוא ה-Material
 * הישן (מסילה דקה + עיגול בולט) — כאן מתג בסגנון iOS: מסילה 51×31, אגודל עם צל, מעבר רך
 * בצבעי ה-trackColor/thumbColor שהמסך כבר מעביר. אותם props כמו Switch.
 */
export function AppSwitch(props: SwitchProps) {
  if (Platform.OS === 'ios') return <Switch {...props} />;
  return <AndroidSwitch {...props} />;
}

function AndroidSwitch({
  value = false,
  onValueChange,
  disabled,
  trackColor,
  thumbColor,
  ios_backgroundColor,
  style,
  testID,
  accessibilityLabel,
}: SwitchProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion, progress]);

  const offColor = (trackColor?.false as string | undefined) ?? (ios_backgroundColor as string | undefined) ?? '#78788029';
  const onColor = (trackColor?.true as string | undefined) ?? '#34C759';
  const thumb = (thumbColor as string | undefined) ?? '#FFFFFF';

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
  }), [offColor, onColor]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: TRAVEL * progress.value }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange?.(!value);
      }}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[style, disabled ? styles.disabled : null]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, { backgroundColor: thumb }, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    // פיזי — «פועל» תמיד בצד ימין, גם בעץ RTL
    direction: 'ltr',
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 2 },
  },
  disabled: {
    opacity: 0.5,
  },
});

export default AppSwitch;
