import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useDesignTokens } from '../ui/DesignTokens';
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

  const bubbleBg = isMe ? tokens.colors.bubbleMe : tokens.colors.bubbleOther;
  const countColor = isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.secondary;
  const borderColor = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)';

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
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 22,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 11,
          borderWidth: StyleSheet.hairlineWidth,
          gap: 1,
        },
        pillMine: {
          borderWidth: 1,
          borderColor: isMe ? 'rgba(255,255,255,0.28)' : tokens.colors.primary.main + '55',
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
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: bubbleBg,
            borderColor,
            transform: [{ scale: scaleAnim }],
          },
          hasMyReaction && styles.pillMine,
        ]}
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
      </Animated.View>
    </TouchableOpacity>
  );
}

export default React.memo(MessageReactions);
