/**
 * שורה ברשימת הצ׳אטים עם פעולות מהירות בהחלקה (כמו וואטסאפ): גוררים ימינה → נעיצה / השתקה.
 * מחווה פשוטה (Pan) ולא ReanimatedSwipeable — הספרייה הופכת צדדים לפי I18nManager.isRTL,
 * והעץ כאן LTR עם forceRTL, כך שהפעולות היו נוחתות בצד הלא נכון.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type ChatListSwipeAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  backgroundColor: string;
  color: string;
  onPress: () => void;
};

const ACTION_W = 78;
const SPRING = { damping: 22, stiffness: 260, mass: 0.8 };

/** רק שורה אחת פתוחה בכל רגע */
let closeOpenRow: (() => void) | null = null;

export function closeAnyOpenChatRow() {
  closeOpenRow?.();
}

type Props = {
  actions: ChatListSwipeAction[];
  enabled?: boolean;
  children: React.ReactNode;
};

export default function ChatListSwipeRow({ actions, enabled = true, children }: Props) {
  const openX = actions.length * ACTION_W;
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);
  const passedThreshold = useSharedValue(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  const close = useCallback(() => {
    tx.value = withTiming(0, { duration: 180 });
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
      tx.value = withSpring(shouldOpen ? openX : 0, SPRING);
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
      <View style={[styles.actions, { width: openX }]}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              void HapticFeedback.impactLight();
              close();
              a.onPress();
            }}
            style={[styles.action, { backgroundColor: a.backgroundColor }]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            {a.icon}
            <Text style={[styles.actionLabel, { color: a.color }]} numberOfLines={1}>
              {a.label}
            </Text>
          </Pressable>
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
    gap: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
