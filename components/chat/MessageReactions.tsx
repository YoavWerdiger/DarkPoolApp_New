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
 * פתיחה/סגירה חלקה של שורת הריאקציות — maxHeight נפתח מ-0, כך שהבועה «דוחפת» את
 * ההודעות מעליה בהדרגה (כמו כניסת הודעה) במקום קפיצה בפריים אחד.
 * בלי מדידה (onLayout) — תקרה קבועה גבוהה מהשורה, ובסוף האנימציה המגבלה מוסרת.
 * הודעה שכבר יש לה ריאקציות ב-mount — מוצגת מיד, בלי אנימציה.
 */
const REVEAL_MAX_H = 40;
/** זהה לכניסת הודעה ב-ChatMessage (fadeAnim / slideAnim) */
const ENTER_MS = 180;
const ENTER_SLIDE_PX = 8;

export function ReactionsReveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [render, setRender] = React.useState(visible);
  const prevVisible = useRef(visible);
  // בסגירה הריאקציות כבר ריקות — מציגים את התוכן האחרון עד סוף האנימציה (אחרת נעלם בבת אחת)
  const lastChildren = useRef<React.ReactNode>(children);
  if (visible) lastChildren.current = children;
  // -1 = ללא מגבלה
  const maxH = useSharedValue(-1);
  const progress = useSharedValue(visible ? 1 : 0);

  const clearLimit = React.useCallback(() => {
    maxH.value = -1;
  }, [maxH]);

  // layout effect — לפני הציור, כדי שלא יהיה פריים בגובה מלא לפני שהאנימציה מתחילה
  React.useLayoutEffect(() => {
    if (visible === prevVisible.current) return;
    prevVisible.current = visible;
    if (visible) {
      setRender(true);
      maxH.value = 0;
      progress.value = 0;
      // אותה כניסה כמו הודעה חדשה (ChatMessage): 180ms, ease-out cubic, fade + עלייה של 8px
      maxH.value = withTiming(REVEAL_MAX_H, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearLimit)();
      });
      progress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    } else {
      if (maxH.value < 0) maxH.value = REVEAL_MAX_H;
      progress.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
      maxH.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setRender)(false);
      });
    }
  }, [visible, maxH, progress, clearLimit]);

  const outerStyle = useAnimatedStyle(() =>
    // בלי overflow:hidden — רק המקום גדל בהדרגה; התוכן לא נחתך ועושה בדיוק את
    // כניסת ההודעה (fade + עלייה של 8px), במקום «וילון» שנפתח
    maxH.value < 0 ? { maxHeight: 1000 } : { maxHeight: maxH.value },
  );
  const innerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * ENTER_SLIDE_PX }],
  }));

  if (!render && !visible) return null;
  return (
    <Reanimated.View style={outerStyle}>
      <Reanimated.View style={innerStyle}>{visible ? children : lastChildren.current}</Reanimated.View>
    </Reanimated.View>
  );
}
