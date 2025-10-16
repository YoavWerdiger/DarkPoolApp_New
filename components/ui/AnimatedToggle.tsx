import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity, View, Text, ViewStyle } from 'react-native';

interface ToggleOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface AnimatedToggleProps {
  options: ToggleOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  style?: ViewStyle;
}

export default function AnimatedToggle({ 
  options, 
  selectedValue, 
  onValueChange, 
  style 
}: AnimatedToggleProps) {
  const animatedValues = useRef(
    options.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    options.forEach((option, index) => {
      Animated.timing(animatedValues[index], {
        toValue: option.value === selectedValue ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  }, [selectedValue]);

  return (
    <View style={[{
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 4,
      flexDirection: 'row',
    }, style]}>
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onValueChange(option.value)}
            style={{ flex: 1 }}
          >
            <Animated.View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: animatedValues[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: ['transparent', '#05d157'],
                }),
                alignItems: 'center',
                transform: [{
                  scale: animatedValues[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                }],
              }}
            >
              <Animated.Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: animatedValues[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255, 255, 255, 0.6)', '#ffffff'],
                  }),
                }}
              >
                {option.label}
              </Animated.Text>
              {option.subtitle && (
                <Animated.Text
                  style={{
                    fontSize: 10,
                    color: animatedValues[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.8)'],
                    }),
                    marginTop: 2,
                  }}
                >
                  {option.subtitle}
                </Animated.Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
