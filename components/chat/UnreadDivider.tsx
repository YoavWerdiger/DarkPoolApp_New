import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface UnreadDividerProps {
  unreadCount: number;
  onPress?: () => void;
}

const UnreadDivider: React.FC<UnreadDividerProps> = ({ 
  unreadCount, 
  onPress 
}) => {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
  console.log('🟢 UnreadDivider: Rendering with count:', unreadCount);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Fade out אוטומטי אחרי 60 שניות
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }, 60000);
    
    return () => clearTimeout(timer);
  }, [fadeAnim]);
  
  if (unreadCount <= 0) {
    console.log('🔴 UnreadDivider: Not rendering - count is', unreadCount);
    return null;
  }

  // טקסט דינמי
  const text = unreadCount === 1 ? 'הודעה חדשה' : `${unreadCount} הודעות חדשות`;

  return (
    <Animated.View key={`unread-divider-${unreadCount}`} style={[styles.container, { opacity: fadeAnim }]}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <View key={`unread-content-${unreadCount}`} style={styles.content}>
          {/* קו שמאל */}
          <View key={`unread-line-left-${unreadCount}`} style={styles.line} />
          
          {/* טקסט במרכז */}
          <View key={`unread-badge-${unreadCount}`} style={styles.badge}>
            <Text key={`unread-text-${unreadCount}`} style={styles.text}>{text}</Text>
          </View>
          
          {/* קו ימין */}
          <View key={`unread-line-right-${unreadCount}`} style={styles.line} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: tokens.colors.primary.main,
    opacity: 0.6,
  },
  badge: {
    backgroundColor: tokens.colors.primary.main,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default UnreadDivider;
