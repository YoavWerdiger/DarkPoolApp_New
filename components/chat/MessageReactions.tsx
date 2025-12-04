import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ReactionSummary } from '../../services/supabase';

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  onReactionDetails: () => void;
  isMe?: boolean; // האם זו הודעה של המשתמש
}

export default function MessageReactions({ reactions, onReactionDetails, isMe = false }: MessageReactionsProps) {
  const DesignTokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: -14, // מיקום נמוך יותר כדי לא לעלות על הבועה הבאה
      flexDirection: 'row-reverse',
      alignItems: 'center',
      zIndex: 10,
    },
    containerMe: {
      left: 8,
    },
    containerOther: {
      right: 8,
    },
    reactionsRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
    },
    reactionBubble: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: DesignTokens.spacing.xs,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.background.secondary,
      minWidth: 32,
      minHeight: 28,
      marginLeft: -6, // חיבור הבועות
    },
    emoji: {
      fontSize: 14,
    },
    count: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 12,
      fontWeight: '500' as any,
      marginRight: 2,
    },
    moreBubble: {
      paddingHorizontal: DesignTokens.spacing.xs,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.background.secondary,
      minWidth: 32,
      minHeight: 28,
      marginLeft: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 12,
      fontWeight: '500' as any,
    },
  }), [DesignTokens]);

  if (!reactions || reactions.length === 0) return null;

  const displayReactions = reactions.slice(0, 3); // רק 3 הראשונות
  const remainingCount = reactions.length > 3 ? reactions.length - 3 : 0;

  const handlePress = () => {
    console.log('🎯 MessageReactions: Pressed, calling onReactionDetails');
    onReactionDetails();
  };

  return (
    <Pressable 
      onPress={handlePress}
      style={[
        styles.container,
        isMe ? styles.containerMe : styles.containerOther
      ]}
    >
      {/* בועות הריאקציה */}
      <View style={styles.reactionsRow}>
        {displayReactions.map((reaction, index) => (
          <View
            key={`${reaction.emoji}-${index}`}
            style={[
              styles.reactionBubble,
              { zIndex: displayReactions.length - index }
            ]}
          >
            <Text style={styles.emoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={styles.count}>{reaction.count}</Text>
            )}
          </View>
        ))}
      </View>

      {/* +X אם יש יותר מ-3 */}
      {remainingCount > 0 && (
        <View style={styles.moreBubble}>
          <Text style={styles.moreText}>+{remainingCount}</Text>
        </View>
      )}
    </Pressable>
  );
}
