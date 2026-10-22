import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/* ── Flying reaction emoji (one instance per tap, self-removes) ── */
export interface FlyingEmoji {
  id: number;
  emoji: string;
  startX: number; // px, relative to bar center
}

export function FlyingEmojiItem({
  emoji,
  startX,
  onDone,
}: {
  emoji: string;
  startX: number;
  onDone: () => void;
}) {
  const tx = useSharedValue(startX);
  const ty = useSharedValue(0);
  const sc = useSharedValue(0.4);
  const op = useSharedValue(1);

  // Slight horizontal drift so bursts don't look robotic
  const drift = useMemo(() => (Math.random() - 0.5) * 60, []);
  const rise = useMemo(() => -260 - Math.random() * 60, []);

  useEffect(() => {
    sc.value = withSpring(1.5, { damping: 8, stiffness: 140 });
    ty.value = withTiming(rise, { duration: 1300, easing: Easing.out(Easing.quad) });
    tx.value = withTiming(startX + drift, {
      duration: 1300,
      easing: Easing.inOut(Easing.quad),
    });
    op.value = withTiming(0, { duration: 1300 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onDone)();
    });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ],
    opacity: op.value,
  }));

  return (
    <Reanimated.View style={[reactStyles.flying, style]} pointerEvents="none">
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </Reanimated.View>
  );
}

/* ── Single reaction button with subtle press animation ── */
export function ReactionButton({
  emoji,
  isSelected,
  onPress,
}: {
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  // Initialize scale to final value so there's NO entrance animation when
  // the bar first mounts (or when story changes). Only tap interactions
  // (press-in / press-out) animate afterwards.
  const scale = useSharedValue(isSelected ? 1.15 : 1);
  const didMountRef = useRef(false);

  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 12, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 10, stiffness: 220 });
  };

  useEffect(() => {
    // Skip the mount pass so the button doesn't "pop in" on story entrance
    // — only animate real subsequent selection changes (e.g. user taps).
    if (!didMountRef.current) {
      didMountRef.current = true;
      scale.value = isSelected ? 1.15 : 1;
      return;
    }
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 10, stiffness: 220 });
  }, [isSelected]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={reactStyles.btn}
      pointerEvents="auto"
    >
      <Reanimated.View style={[reactStyles.btnInner, isSelected && reactStyles.btnInnerSelected, style]}>
        <Text style={reactStyles.emoji}>{emoji}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

/* ── Progress bar item (separate component so useAnimatedStyle works per bar) ── */
export function ProgressBarFill({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const val = Math.max(0, Math.min(1, progress.value - index));
    return { transform: [{ scaleX: val }] };
  });

  return (
    <View style={[barStyles.track, { flex: 1, marginHorizontal: 1.5 }]}>
      <Reanimated.View style={[barStyles.fill, animStyle]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 3.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
    transformOrigin: 'right center',
  },
});

export const reactStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 11,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // צבע הרקע מגיע מה-tokens (inline) — pill מלא, בלי זכוכית/קו
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  btnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnInnerSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  emoji: {
    fontSize: 24,
  },
  flyLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    height: 0,
  },
  flying: {
    position: 'absolute',
    bottom: 0,
  },
});
