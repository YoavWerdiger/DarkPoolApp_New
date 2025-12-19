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
      bottom: -14,
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
    // בועה אחת לכל האימוג'ים
    singleBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.background.secondary,
      minHeight: 28,
      gap: 2,
    },
    emoji: {
      fontSize: 14,
    },
    count: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 11,
      fontWeight: '500' as any,
      marginLeft: 1,
      marginRight: 4,
    },
    moreText: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 11,
      fontWeight: '600' as any,
      marginLeft: 2,
    },
  }), [DesignTokens]);

  if (!reactions || reactions.length === 0) return null;

  // עד 3 אימוג'ים שונים
  const displayReactions = reactions.slice(0, 3);
  
  // אם יש יותר מ-3 סוגי אימוג'ים, נחשב כמה ריאקציות נוספות יש
  const additionalReactionsCount = reactions.length > 3 
    ? reactions.slice(3).reduce((sum, r) => sum + r.count, 0)
    : 0;

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
      {/* בועה אחת עם כל האימוג'ים */}
      <View style={styles.singleBubble}>
        {/* האימוג'ים - עם מספר אם יש יותר מ-1 */}
        {displayReactions.map((reaction, index) => (
          <View key={`${reaction.emoji}-${index}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.emoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={styles.count}>{reaction.count}</Text>
            )}
          </View>
        ))}
        
        {/* +X אם יש יותר מ-3 סוגי אימוג'ים */}
        {additionalReactionsCount > 0 && (
          <Text style={styles.moreText}>+{additionalReactionsCount}</Text>
        )}
      </View>
    </Pressable>
  );
}
