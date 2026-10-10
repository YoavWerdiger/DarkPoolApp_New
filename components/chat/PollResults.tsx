import React, { useEffect, useMemo } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { APP_TYPE } from '../ui/appType';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PollOption } from '../../services/pollService';
import { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette, chatRtlRow, chatRtlText } from './chatDesignTokens';

interface PollResultsProps {
  options: PollOption[];
  userVotes: string[];
  totalVotes: number;
  multipleChoice: boolean;
  isLocked: boolean;
  isMe?: boolean;
  embeddedInBubble?: boolean;
  /** When set, options are tappable (used for changing vote). */
  onOptionPress?: (optionId: string) => void;
  allowChangeVote?: boolean;
}

export default function PollResults({
  options,
  userVotes,
  totalVotes,
  multipleChoice: _multipleChoice,
  isMe = false,
  embeddedInBubble = false,
  onOptionPress,
  allowChangeVote = false,
}: PollResultsProps) {
  const tokens = useDesignTokens();
  const lightOnBubble = embeddedInBubble && isMe;
  const styles = useMemo(
    () => createStyles(tokens, lightOnBubble),
    [tokens, lightOnBubble],
  );

  const getVotePercentage = (votesCount: number): number => {
    if (totalVotes === 0) return 0;
    return Math.round((votesCount / totalVotes) * 100);
  };

  const interactive = !!allowChangeVote && !!onOptionPress;

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const percentage = getVotePercentage(option.votes_count);
        const isVoted = userVotes.includes(option.id);
        // לפי הטופו: מילוי מצבע הטקסט של הבועה — הבחירה שלי חזקה יותר
        const fillColor = withAlpha(styles.optionText.color as string, isVoted ? 0.24 : 0.12);

        const content = (
          <>
            <ResultBar percentage={percentage} color={fillColor} style={styles.barFill} />
            <View style={styles.rowContent}>
              <View style={styles.labelRow}>
                {isVoted && (
                  <Ionicons name="checkmark-circle" size={16} color={styles.optionText.color as string} />
                )}
                <Text style={[styles.optionText, isVoted && styles.optionTextVoted]} numberOfLines={1}>
                  {option.text}
                </Text>
              </View>
              <Text style={styles.percent}>{percentage}%</Text>
            </View>
          </>
        );

        if (interactive) {
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onOptionPress?.(option.id)}
              activeOpacity={0.75}
              style={styles.row}
            >
              {content}
            </TouchableOpacity>
          );
        }

        return (
          <View key={option.id} style={styles.row}>
            {content}
          </View>
        );
      })}

      <Text style={styles.footer}>
        {totalVotes} {totalVotes === 1 ? 'הצבעה' : 'הצבעות'}
        {interactive ? ' · לחץ לשינוי בחירה' : ''}
      </Text>
    </View>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  lightOnBubble: boolean,
) => {
  // צבעים מטוקני הבועה (לא לבן קבוע — בבהיר הבועה שלי בהירה)
  const text = lightOnBubble ? tokens.colors.bubbleMeText : tokens.colors.text.primary;
  const muted = lightOnBubble ? tokens.colors.bubbleMeMetaText : tokens.colors.text.tertiary;
  const trackBg = withAlpha(text, 0.06);

  return StyleSheet.create({
    container: {
      gap: 8,
      direction: 'rtl',
    },
    row: {
      position: 'relative',
      borderRadius: tokens.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: trackBg,
      minHeight: 40,
      justifyContent: 'center',
    },
    barFill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      start: 0,
      borderRadius: tokens.borderRadius.lg,
    },
    rowContent: {
      ...chatRtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 14,
      gap: 8,
    },
    labelRow: {
      ...chatRtlRow,
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    optionText: {
      color: text,
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      ...chatRtlText,
    },
    optionTextVoted: {
      fontWeight: APP_TYPE.cardTitle.fontWeight,
    },
    percent: {
      color: text,
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      fontVariant: ['tabular-nums'],
      minWidth: 34,
      flexShrink: 0,
      textAlign: 'left',
    },
    footer: {
      marginTop: 4,
      color: muted,
      fontSize: APP_TYPE.caption.fontSize,
      lineHeight: APP_TYPE.caption.lineHeight,
      ...chatRtlText,
    },
  });
};

/** פס תוצאה שגדל מ-0 לאחוז (ובשינוי — מתעדכן בהנפשה) */
function ResultBar({ percentage, color, style }: { percentage: number; color: string; style: object }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(percentage, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [percentage, w]);
  const animated = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[style, { backgroundColor: color }, animated]} />;
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
