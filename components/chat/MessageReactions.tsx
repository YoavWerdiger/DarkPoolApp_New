import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ReactionSummary } from '../../services/supabase';

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  onReactionDetails: () => void;
  isMe?: boolean;
  currentUserId?: string;
}

function MessageReactions({ reactions, onReactionDetails, isMe = false, currentUserId }: MessageReactionsProps) {
  const DesignTokens = useDesignTokens();
  
  // אנימציות - מתחילים מ-1 כדי שריאקציות קיימות יופיעו מיד
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevReactionsCount = useRef(reactions?.length || 0);
  const isFirstRender = useRef(true);
  
  // אנימציה כשיש ריאקציות חדשות
  useEffect(() => {
    const currentCount = reactions?.length || 0;
    
    // דלג על render ראשון - לא צריך אנימציה
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevReactionsCount.current = currentCount;
      return;
    }
    
    // אם השתנה מספר הריאקציות - הפעל אנימציה קלה
    if (currentCount > 0 && currentCount !== prevReactionsCount.current) {
      // אנימציית "pop" קלה
      scaleAnim.setValue(0.8);
      
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 150,
        useNativeDriver: true,
      }).start();
    }
    
    prevReactionsCount.current = currentCount;
  }, [reactions]);
  
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
      paddingHorizontal: DesignTokens.spacing.sm,
      paddingVertical: DesignTokens.spacing.xs,
      borderRadius: DesignTokens.borderRadius.lg,
      backgroundColor: DesignTokens.colors.background.secondary,
      minHeight: 28,
      gap: 2,
    },
    emoji: {
      fontSize: DesignTokens.typography.bodySmall.size,
    },
    count: {
      color: DesignTokens.colors.text.secondary,
      fontSize: DesignTokens.typography.fontSize.xs,
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
  
  // אם יש יותר מ-3 סוגי אימוג'ים, מציגים "+N" סוגים נוספים
  const additionalReactionsCount = Math.max(0, reactions.length - 3);

  const handlePress = () => {
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
      {/* בועה אחת עם כל האימוג'ים - עם אנימציה */}
      <Animated.View 
        style={[
          styles.singleBubble,
          {
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        {/* האימוג'ים - עם מספר אם יש יותר מ-1 */}
        {displayReactions.map((reaction, index) => {
          const reactedByMe = currentUserId
            ? reaction.user_ids?.includes(currentUserId)
            : false;
          return (
            <View
              key={`${reaction.emoji}-${index}`}
              style={[
                { flexDirection: 'row', alignItems: 'center', borderRadius: DesignTokens.borderRadius.sm, paddingHorizontal: DesignTokens.spacing.micro },
                reactedByMe && { backgroundColor: DesignTokens.colors.primary.dim },
              ]}
            >
              <Text style={styles.emoji}>{reaction.emoji}</Text>
              {reaction.count > 1 && (
                <Text style={[styles.count, reactedByMe && { color: DesignTokens.colors.primary.main }]}>{reaction.count}</Text>
              )}
            </View>
          );
        })}
        
        {/* +X אם יש יותר מ-3 סוגי אימוג'ים */}
        {additionalReactionsCount > 0 && (
          <Text style={styles.moreText}>+{additionalReactionsCount}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(MessageReactions);
