import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, ViewStyle } from 'react-native';
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
  style
}) => {
  const isDisabled = loading || disabled;

  if (variant === 'primary') {
    return (
      <LinearGradient
        colors={['#00E654', '#00B84A', '#008F3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{
          borderRadius: 14,
          shadowColor: DesignTokens.colors.primary.main,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
          opacity: isDisabled ? 0.7 : 1
        }, style]}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          activeOpacity={0.8}
          style={{
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {loading ? (
            <ActivityIndicator color={DesignTokens.colors.background.primary} size="small" />
          ) : (
            <Text style={{ 
              color: DesignTokens.colors.background.primary, 
              fontSize: 16, 
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              {title}
            </Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Secondary variant
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[{
        backgroundColor: '#181818',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        opacity: isDisabled ? 0.5 : 1
      }, style]}
    >
      {loading ? (
        <ActivityIndicator color={DesignTokens.colors.text.secondary} size="small" />
      ) : (
        <Text style={{ 
          color: DesignTokens.colors.text.secondary, 
          fontSize: 16, 
          fontWeight: '600',
          letterSpacing: 0.3
        }}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default OnboardingButton;
