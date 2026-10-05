import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  type AnimatedStyle,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const ICON = '#FFFFFF';
/** תמונה בהירה בולעת אייקונים לבנים — הדעיכה והעיגול נותנים ניגוד בלי פס אטום. */
const SCRIM_TOP = ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'] as const;
const SCRIM_BOTTOM = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'] as const;
const BTN_FILL = 'rgba(0,0,0,0.38)';
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

type Props = {
  paddingTop: number;
  paddingBottom: number;
  title?: string;
  timeLabel?: string;
  caption?: string;
  counter?: string;
  onClose: () => void;
  onShare?: () => void;
  onForward?: () => void;
  /** סוגר את הצופה ומפעיל תגובה בצ'אט, בלי תיבת טקסט כאן. */
  onReply?: () => void;
  videoSlot?: React.ReactNode;
  chromeStyle?: AnimatedStyle<ViewStyle>;
  pointerEvents?: 'box-none' | 'none';
};

function IconButton({
  name,
  label,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={24} color={ICON} />
    </Pressable>
  );
}

/** רקע: אותה תמונה במסך מלא, מטושטשת וחשוכה מאוד. */
export function MediaBlurBackdrop({
  uri,
  style,
}: {
  uri?: string | null;
  style?: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={[StyleSheet.absoluteFill, styles.blurFallback]} />
      {uri ? (
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={80}
          transition={0}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.blurDim]} />
    </Animated.View>
  );
}

/** החשכה על התמונה כשהמקלדת פתוחה. התמונה עצמה לא זזה. */
export function MediaKeyboardDim() {
  const keyboard = useAnimatedKeyboard();
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    () => keyboard.height.value > 12,
    (open, prev) => {
      if (open === prev) return;
      opacity.value = withTiming(open ? 1 : 0, {
        duration: open ? 460 : 320,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
    }
  );

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.keyboardDim, style]} />
  );
}

/** כרום פתיחת מדיה: כפתורים צפים. «השב» מפעיל תגובה בצ'אט. */
export function MediaViewerChrome({
  paddingTop,
  paddingBottom,
  title,
  timeLabel,
  caption,
  counter,
  onClose,
  onShare,
  onForward,
  onReply,
  videoSlot,
  chromeStyle,
  pointerEvents = 'box-none',
}: Props) {
  const captionText = caption?.trim();

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.chromeLayer, chromeStyle]} pointerEvents={pointerEvents}>
      <LinearGradient
        pointerEvents="none"
        colors={SCRIM_TOP}
        style={[styles.scrimTop, { height: paddingTop + 96 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={SCRIM_BOTTOM}
        style={[styles.scrimBottom, { height: paddingBottom + 160 }]}
      />
      <View style={[styles.topRow, { paddingTop }]} pointerEvents="box-none">
        <View style={styles.actions}>
          {onShare ? <IconButton name="share-outline" label="שיתוף" onPress={onShare} /> : null}
          {onForward ? <IconButton name="arrow-redo-outline" label="העברה" onPress={onForward} /> : null}
        </View>
        <View style={styles.titleCol}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {timeLabel || counter ? (
            <Text style={styles.time} numberOfLines={1}>
              {counter || timeLabel}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <Ionicons name="chevron-forward" size={26} color={ICON} />
        </Pressable>
      </View>

      <View style={[styles.bottomAnchor, { paddingBottom }]} pointerEvents="box-none">
        {videoSlot}
        {captionText ? (
          <Text style={styles.caption} numberOfLines={6}>
            {captionText}
          </Text>
        ) : null}
        {onReply ? (
          <Pressable
            onPress={onReply}
            style={styles.replyBtn}
            accessibilityRole="button"
            accessibilityLabel="השב"
          >
            <Ionicons name="chatbubble-outline" size={18} color={ICON} />
            <Text style={styles.replyBtnText}>השב</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chromeLayer: {
    zIndex: 20,
    elevation: 20,
  },
  blurFallback: {
    backgroundColor: '#000',
  },
  blurDim: {
    // הטשטוש צריך להיראות — רק החשכה קלה לקריאות הכפתורים
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  keyboardDim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BTN_FILL,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    marginRight: 2,
  },
  title: {
    color: ICON,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
    ...TEXT_SHADOW,
  },
  time: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 1,
    ...TEXT_SHADOW,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BTN_FILL,
  },
  bottomAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    direction: 'ltr',
  },
  caption: {
    color: ICON,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
    ...TEXT_SHADOW,
  },
  replyBtn: {
    flexDirection: 'row',
    direction: 'ltr',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: BTN_FILL,
  },
  replyBtnText: {
    color: ICON,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
