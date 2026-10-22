/**
 * שורה ברשימת הצ׳אטים עם פעולות מהירות בהחלקה (כמו וואטסאפ): גוררים ימינה → נעיצה / השתקה.
 * מחווה פשוטה (Pan) ולא ReanimatedSwipeable — הספרייה הופכת צדדים לפי I18nManager.isRTL,
 * והעץ כאן LTR עם forceRTL, כך שהפעולות היו נוחתות בצד הלא נכון.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type ChatListSwipeAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** רקע העיגול */
  backgroundColor: string;
  /** צבע התווית מתחת לעיגול */
  color: string;
  onPress: () => void;
};

const ACTION_W = 76;
const CIRCLE = 44;
// קפיצה עדינה בפתיחה (מעט overshoot), סגירה חלקה
const SPRING_OPEN = { damping: 16, stiffness: 220, mass: 0.7 };
const SPRING_CLOSE = { damping: 24, stiffness: 300, mass: 0.7 };

/** כל כפתור נחשף בנפרד: גדל ומופיע לפי כמה מהשורה זזה, עם השהיה קלה בין הכפתורים */
function SwipeActionButton({
  action,
  index,
  offset,
  tx,
  onPress,
}: {
  action: ChatListSwipeAction;
  index: number;
  offset: number;
  tx: SharedValue<number>;
  onPress: () => void;
}) {
  const start = offset + index * ACTION_W * 0.55;
  const end = start + ACTION_W;
  const anim = useAnimatedStyle(() => {
    const p = interpolate(tx.value, [start, end], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [
        { scale: interpolate(p, [0, 1], [0.55, 1]) },
        { translateX: interpolate(p, [0, 1], [-10, 0]) },
      ],
    };
  });
  return (
    <Pressable
      onPress={onPress}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      hitSlop={4}
    >
      <Animated.View style={[styles.actionInner, anim]}>
        <View style={[styles.circle, { backgroundColor: action.backgroundColor }]}>{action.icon}</View>
        <Text style={[styles.actionLabel, { color: action.color }]} numberOfLines={1}>
          {action.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** רק שורה אחת פתוחה בכל רגע */
let closeOpenRow: (() => void) | null = null;

export function closeAnyOpenChatRow() {
  closeOpenRow?.();
}

type Props = {
  actions: ChatListSwipeAction[];
  /** רקע האזור שנחשף מאחורי השורה (צבע כרטיס) */
  revealBackgroundColor?: string;
  /** הזחה מהקצה — כמו הדיבידרים (padding אופקי של המסך): הרקע מתחיל איפה שהדיבידר מתחיל */
  revealInset?: number;
  enabled?: boolean;
  children: React.ReactNode;
};

export default function ChatListSwipeRow({ actions, revealBackgroundColor, revealInset = 0, enabled = true, children }: Props) {
  const openX = revealInset + actions.length * ACTION_W;
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);
  const passedThreshold = useSharedValue(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  const close = useCallback(() => {
    tx.value = withSpring(0, SPRING_CLOSE);
    setOpen(false);
  }, [tx]);
  closeRef.current = close;

  const onOpened = useCallback(() => {
    if (closeOpenRow && closeOpenRow !== closeRef.current) closeOpenRow();
    closeOpenRow = closeRef.current;
    setOpen(true);
  }, []);

  const onClosed = useCallback(() => {
    if (closeOpenRow === closeRef.current) closeOpenRow = null;
    setOpen(false);
  }, []);

  const haptic = useCallback(() => {
    void HapticFeedback.selection();
  }, []);

  useEffect(
    () => () => {
      if (closeOpenRow === closeRef.current) closeOpenRow = null;
    },
    [],
  );

  const pan = Gesture.Pan()
    .enabled(enabled && actions.length > 0)
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      startX.value = tx.value;
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(startX.value + e.translationX, 0), openX * 1.2);
      tx.value = next;
      const past = next > openX * 0.5;
      if (past !== passedThreshold.value) {
        passedThreshold.value = past;
        if (past) runOnJS(haptic)();
      }
    })
    .onEnd((e) => {
      const shouldOpen = tx.value > openX * 0.5 || (e.velocityX > 600 && tx.value > 12);
      tx.value = withSpring(shouldOpen ? openX : 0, shouldOpen ? SPRING_OPEN : SPRING_CLOSE);
      passedThreshold.value = false;
      runOnJS(shouldOpen ? onOpened : onClosed)();
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  // רקע השורה שקוף (מעל הרקע של המסך) — הפעולות נחשפות רק ברוחב שהשורה זזה, אחרת היו נראות דרכה
  const actionsClipStyle = useAnimatedStyle(() => ({ width: Math.max(0, tx.value) }));

  if (!enabled || actions.length === 0) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      {/* הפעולות מאחורי השורה, בצד שמאל — נחשפות כשהשורה זזה ימינה */}
      <Animated.View style={[styles.actionsClip, actionsClipStyle]}>
      {revealBackgroundColor ? (
        <View style={[styles.revealBg, { left: revealInset, backgroundColor: revealBackgroundColor }]} />
      ) : null}
      <View style={[styles.actions, { left: revealInset, width: openX - revealInset }]}>
        {actions.map((a, i) => (
          <SwipeActionButton
            key={a.key}
            action={a}
            index={i}
            offset={revealInset}
            tx={tx}
            onPress={() => {
              void HapticFeedback.impactLight();
              close();
              a.onPress();
            }}
          />
        ))}
      </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          {children}
          {/* פתוחה — לחיצה על השורה סוגרת במקום לפתוח את הצ׳אט */}
          {open ? <Pressable style={StyleSheet.absoluteFill} onPress={close} /> : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  actionsClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  revealBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // רחב מספיק לכל הפתיחה (נחתך ב-actionsClip)
    width: 1000,
  },
  actions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  action: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInner: {
    alignItems: 'center',
    gap: 5,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
