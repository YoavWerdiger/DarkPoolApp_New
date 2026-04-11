import React, { useRef } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../ui/DesignTokens';

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = loading || disabled;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  if (variant === 'primary') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <LinearGradient
          colors={isDisabled ? ['#2A2A2A', '#2A2A2A'] : ['#00C805', '#00A004', '#008F03']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 30,
            shadowColor: isDisabled ? 'transparent' : DesignTokens.colors.primary.main,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDisabled ? 0 : 0.45,
            shadowRadius: 14,
            elevation: isDisabled ? 0 : 8,
          }}
        >
          <TouchableOpacity
            onPress={onPress}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={isDisabled}
            activeOpacity={1}
            style={{
              paddingVertical: 17,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text
                style={{
                  color: isDisabled ? 'rgba(255,255,255,0.3)' : '#000',
                  fontSize: 16,
                  fontWeight: '700',
                  letterSpacing: 0.3,
                }}
              >
                {title}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  // Secondary — ghost
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={{
          borderRadius: 30,
          paddingVertical: 17,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.4 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={DesignTokens.colors.text.secondary} size="small" />
        ) : (
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16,
              fontWeight: '500',
            }}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default OnboardingButton;
