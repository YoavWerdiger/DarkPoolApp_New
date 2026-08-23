import React, { useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  icon,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = loading || disabled;

  const runPress = () => {
    if (isDisabled) return;
    void HapticFeedback.impactLight();
    onPress();
  };

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 140,
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
            borderRadius: DesignTokens.borderRadius.full,
            overflow: 'hidden',
            shadowColor: isDisabled ? 'transparent' : DesignTokens.colors.primary.main,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDisabled ? 0 : 0.28,
            shadowRadius: 12,
            elevation: isDisabled ? 0 : 6,
          }}
        >
          <TouchableOpacity
            onPress={runPress}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={isDisabled}
            activeOpacity={1}
            style={{
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isDisabled ? 0.55 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                {icon}
                <Text
                  style={{
                    color: isDisabled ? 'rgba(255,255,255,0.3)' : '#000',
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={runPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={{
          borderRadius: DesignTokens.borderRadius.full,
          paddingVertical: 15,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.4 : 1,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      >
        {loading ? (
          <ActivityIndicator color={DesignTokens.colors.text.secondary} size="small" />
        ) : (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            {icon}
            <Text
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 15,
                fontWeight: '600',
              }}
            >
              {title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default OnboardingButton;
