import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

export default function PollResults({
  options,
  userVotes,
  totalVotes,
  multipleChoice: _multipleChoice,
  isMe = false,
  embeddedInBubble = false,
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

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const percentage = getVotePercentage(option.votes_count);
        const isVoted = userVotes.includes(option.id);
        const fillColor = lightOnBubble
          ? isVoted
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(255,255,255,0.12)'
          : isVoted
            ? 'rgba(0, 200, 5, 0.28)'
            : 'rgba(255,255,255,0.08)';

        return (
          <View key={option.id} style={styles.row}>
            <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: fillColor }]} />
            <View style={styles.rowContent}>
              <View style={styles.labelRow}>
                {isVoted && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={lightOnBubble ? '#FFFFFF' : chatPalette.primary}
                  />
                )}
                <Text style={styles.optionText} numberOfLines={1}>
                  {option.text}
                </Text>
              </View>
              <Text style={styles.percent}>{percentage}%</Text>
            </View>
          </View>
        );
      })}

      <Text style={styles.footer}>
        {totalVotes} {totalVotes === 1 ? 'הצבעה' : 'הצבעות'}
      </Text>
    </View>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  lightOnBubble: boolean,
) => {
  const text = lightOnBubble ? '#FFFFFF' : tokens.colors.text.primary;
  const muted = lightOnBubble ? 'rgba(255,255,255,0.5)' : tokens.colors.text.tertiary;
  const trackBg = lightOnBubble ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.04)';

  return StyleSheet.create({
    container: {
      gap: 8,
      direction: 'rtl',
    },
    row: {
      position: 'relative',
      borderRadius: 10,
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
      borderRadius: 10,
    },
    rowContent: {
      ...chatRtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
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
      fontSize: 15,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      ...chatRtlText,
    },
    percent: {
      color: muted,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.semibold,
      minWidth: 34,
      flexShrink: 0,
      textAlign: 'left',
    },
    footer: {
      marginTop: 4,
      color: muted,
      fontSize: tokens.typography.fontSize.xs,
      ...chatRtlText,
    },
  });
};
