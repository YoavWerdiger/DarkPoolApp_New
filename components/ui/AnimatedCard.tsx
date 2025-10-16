import React, { useRef } from 'react';
import { Animated, TouchableOpacity, ViewStyle, GestureResponderEvent } from 'react-native';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  disabled?: boolean;
  scaleValue?: number;
  duration?: number;
}

export default function AnimatedCard({ 
  children, 
  onPress, 
  style, 
  disabled = false,
  scaleValue = 0.95,
  duration = 150
}: AnimatedCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(scaleAnim, {
      toValue: scaleValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  } as ViewStyle;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        style={{ flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
