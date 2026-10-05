import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useDesignTokens } from '../ui/DesignTokens';
import { GlassChip } from '../ui/GlassChip';
import type { ChatReactionGroup } from '../../types/chat.types';

/** רווח בין בועת ההודעה לשורת הריאקציה */
export const CHAT_REACTION_ROW_GAP = 4;

const MAX_EMOJI_TYPES = 3;

interface MessageReactionsProps {
  reactions: ChatReactionGroup[];
  onReactionDetails: () => void;
  isMe?: boolean;
}

function MessageReactions({ reactions, onReactionDetails, isMe = false }: MessageReactionsProps) {
  const tokens = useDesignTokens();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevSignature = useRef('');
  const isFirstRender = useRef(true);

  const countColor = isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.secondary;

  const signature = useMemo(
    () =>
      reactions
        .map((r) => `${r.emoji}:${r.count}:${r.reacted_by_me ? 1 : 0}`)
        .join('|'),
    [reactions],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevSignature.current = signature;
      return;
    }
    if (signature !== prevSignature.current) {
      prevSignature.current = signature;
      scaleAnim.setValue(0.92);
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 32,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [signature, scaleAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          marginTop: CHAT_REACTION_ROW_GAP,
          maxWidth: '100%',
        },
        rowMe: {
          alignSelf: 'flex-end',
        },
        rowOther: {
          alignSelf: 'flex-start',
        },
        pill: {
          minHeight: 22,
          borderRadius: 11,
        },
        pillContent: {
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 22,
          paddingHorizontal: 6,
          paddingVertical: 2,
          gap: 1,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 1,
        },
        emoji: {
          fontSize: 13,
          lineHeight: 16,
        },
        count: {
          fontSize: 11,
          fontWeight: '600',
          color: countColor,
          marginLeft: 1,
          minWidth: 8,
          textAlign: 'center',
        },
        more: {
          fontSize: 10,
          fontWeight: '600',
          color: countColor,
          marginLeft: 1,
          paddingHorizontal: 1,
        },
      }),
    [tokens, countColor, isMe],
  );

  if (!reactions?.length) return null;

  const displayReactions = reactions.slice(0, MAX_EMOJI_TYPES);
  const extraTypes = Math.max(0, reactions.length - MAX_EMOJI_TYPES);
  const hasMyReaction = reactions.some((r) => r.reacted_by_me);

  return (
    <TouchableOpacity
      onPress={onReactionDetails}
      activeOpacity={0.75}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <GlassChip
          selected={hasMyReaction}
          disableBlur
          style={styles.pill}
          contentContainerStyle={styles.pillContent}
        >
        {displayReactions.map((reaction) => (
          <View key={reaction.emoji} style={styles.chip}>
            <Text style={styles.emoji} allowFontScaling={false}>
              {reaction.emoji}
            </Text>
            {reaction.count > 1 ? (
              <Text style={styles.count} allowFontScaling={false}>
                {reaction.count}
              </Text>
            ) : null}
          </View>
        ))}
        {extraTypes > 0 ? (
          <Text style={styles.more} allowFontScaling={false}>
            +{extraTypes}
          </Text>
        ) : null}
        </GlassChip>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default React.memo(MessageReactions);

/**
 * פתיחה/סגירה חלקה של שורת הריאקציות — הגובה גדל מ-0 לגובה הטבעי, כך שהבועה
 * «דוחפת» את ההודעות מעליה בהדרגה (כמו כניסת הודעה) במקום קפיצה של ~26px בפריים אחד.
 * הודעה שכבר יש לה ריאקציות ב-mount — מוצגת מיד, בלי אנימציה.
 */
export function ReactionsReveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [render, setRender] = React.useState(visible);
  const prevVisible = useRef(visible);
  const pendingOpen = useRef(false);
  // -1 = גובה אוטומטי (ללא אילוץ)
  const height = useSharedValue(visible ? -1 : 0);
  const progress = useSharedValue(visible ? 1 : 0);

  if (visible !== prevVisible.current) {
    prevVisible.current = visible;
    if (visible) {
      pendingOpen.current = true;
      if (!render) setRender(true);
    }
  }

  useEffect(() => {
    if (visible) return;
    if (!render) return;
    progress.value = withTiming(0, { duration: 140 });
    height.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setRender)(false);
    });
  }, [visible, render, height, progress]);

  const onLayout = React.useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (pendingOpen.current) {
        pendingOpen.current = false;
        height.value = 0;
        height.value = withTiming(h, { duration: 220, easing: Easing.out(Easing.cubic) });
        progress.value = withTiming(1, { duration: 220 });
      } else if (height.value >= 0 && visible) {
        // שורה קיימת שגדלה (עוד סוג אימוג׳י) — גם היא בהדרגה
        height.value = withTiming(h, { duration: 180, easing: Easing.out(Easing.cubic) });
      }
    },
    [height, progress, visible],
  );

  const outerStyle = useAnimatedStyle(() =>
    height.value < 0 ? {} : { height: height.value, overflow: 'hidden' },
  );
  const innerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + 0.15 * progress.value }],
  }));

  if (!render) return null;
  return (
    <Reanimated.View style={[{ alignSelf: 'stretch' }, outerStyle]}>
      <Reanimated.View onLayout={onLayout} style={innerStyle}>
        {children}
      </Reanimated.View>
    </Reanimated.View>
  );
}
