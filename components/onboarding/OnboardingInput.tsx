import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TextInputProps, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

interface OnboardingInputProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  multiline?: boolean;
}

const OnboardingInput: React.FC<OnboardingInputProps> = ({
  label,
  icon,
  error,
  multiline = false,
  ...textInputProps
}) => {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const borderColor = error
    ? '#F85149'
    : borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.1)', DesignTokens.colors.primary.main],
      });

  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.05)', 'rgba(0,230,84,0.06)'],
  });

  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          color: focused ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)',
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 8,
          textAlign: 'right',
          letterSpacing: 0.1,
        }}
      >
        {label}
      </Text>

      <Animated.View
        style={{
          backgroundColor: bgColor,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 12 : 0,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={19}
            color={focused ? DesignTokens.colors.primary.main : 'rgba(255,255,255,0.28)'}
            style={{ marginTop: multiline ? 4 : 0 }}
          />
        )}
        <TextInput
          style={{
            flex: 1,
            color: '#fff',
            paddingHorizontal: icon ? 12 : 0,
            paddingVertical: multiline ? 4 : 16,
            fontSize: 16,
            fontWeight: '400',
            textAlign: 'right',
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
          placeholderTextColor="rgba(255,255,255,0.2)"
          multiline={multiline}
          onFocus={onFocus}
          onBlur={onBlur}
          {...textInputProps}
        />
      </Animated.View>

      {error && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 6,
            paddingHorizontal: 4,
          }}
        >
          <Ionicons name="alert-circle" size={14} color="#F85149" style={{ marginLeft: 6 }} />
          <Text
            style={{
              color: '#F85149',
              fontSize: 13,
              fontWeight: '500',
              textAlign: 'right',
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

export default OnboardingInput;
