import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
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
import { APP_TYPE } from '../ui/appType';

const ICON = '#FFFFFF';

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
  /** שליחת תגובה מהמקלדת, בלי כפתור אימוג'י. */
  onSubmitReply?: (text: string) => void;
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

/** כרום פתיחת מדיה: כפתורים צפים בלי פס, ושדה תגובה שקוף מעל המקלדת. */
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
  onSubmitReply,
  videoSlot,
  chromeStyle,
  pointerEvents = 'box-none',
}: Props) {
  const [draft, setDraft] = useState('');
  const captionText = caption?.trim();
  const canSend = draft.trim().length > 0;
  const keyboard = useAnimatedKeyboard();

  const liftStyle = useAnimatedStyle(() => {
    const open = keyboard.height.value > 8;
    return {
      paddingBottom: open ? 8 : paddingBottom,
      transform: [{ translateY: -keyboard.height.value }],
    };
  });

  const submit = () => {
    const text = draft.trim();
    if (!text || !onSubmitReply) return;
    setDraft('');
    onSubmitReply(text);
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, chromeStyle]} pointerEvents={pointerEvents}>
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
          <Ionicons name="chevron-forward" size={30} color={ICON} />
        </Pressable>
      </View>

      <Animated.View style={[styles.bottomAnchor, liftStyle]} pointerEvents="box-none">
        {videoSlot}
        {captionText ? (
          <Text style={styles.caption} numberOfLines={6}>
            {captionText}
          </Text>
        ) : null}
        {onSubmitReply ? (
          <View style={styles.replyRow}>
            {canSend ? (
              <Pressable
                onPress={submit}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="שליחה"
              >
                <Ionicons name="send" size={22} color={ICON} style={styles.sendIcon} />
              </Pressable>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="השב"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.replyInput}
              keyboardAppearance="dark"
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={submit}
              selectionColor={ICON}
            />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blurFallback: {
    backgroundColor: '#000',
  },
  blurDim: {
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  keyboardDim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  },
  time: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bottomAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  caption: {
    color: ICON,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  replyRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    color: ICON,
    backgroundColor: 'transparent',
    textAlign: 'right',
    writingDirection: 'rtl',
    ...APP_TYPE.body,
  },
  sendIcon: {
    transform: [{ scaleX: -1 }],
  },
});
