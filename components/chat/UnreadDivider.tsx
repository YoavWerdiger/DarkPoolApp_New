import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';

interface UnreadDividerProps {
  unreadCount: number;
  onPress?: () => void;
}

const UnreadDivider: React.FC<UnreadDividerProps> = ({ 
  unreadCount, 
  onPress 
}) => {
  console.log('🟢 UnreadDivider: Rendering with count:', unreadCount);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Fade out אוטומטי אחרי 45 שניות
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }, 45000);
    
    return () => clearTimeout(timer);
  }, [fadeAnim]);
  
  if (unreadCount <= 0) {
    console.log('🔴 UnreadDivider: Not rendering - count is', unreadCount);
    return null;
  }

  return (
    <Animated.View style={{ opacity: fadeAnim, marginVertical: 16, marginHorizontal: 16 }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {/* קו שמאל */}
          <View style={{ flex: 1, height: 2, backgroundColor: '#00D84A' }} />
          
          {/* טקסט במרכז */}
          <View style={{ 
            backgroundColor: '#181818',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 16,
            marginHorizontal: 12,
            borderWidth: 1.5,
            borderColor: '#00D84A'
          }}>
            <Text style={{ 
              color: '#00D84A',
              fontSize: 13,
              fontWeight: '700',
              textAlign: 'center'
            }}>
              {unreadCount} הודעות חדשות
            </Text>
          </View>
          
          {/* קו ימין */}
          <View style={{ flex: 1, height: 2, backgroundColor: '#00D84A' }} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default UnreadDivider;
