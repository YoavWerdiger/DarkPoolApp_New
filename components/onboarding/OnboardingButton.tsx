import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type OnboardingButtonVariant = 'primary' | 'secondary' | 'ghost';
export type OnboardingButtonSize = 'md' | 'lg';

export interface OnboardingButtonProps {
  title: string;
  variant?: OnboardingButtonVariant;
  size?: OnboardingButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

/**
 * OnboardingButton - כפתור בסגנון DarkPool
 *
 * עיצוב עם:
 * - Primary: גלולת זכוכית (UICard glass + blur), גם במצב disabled — מעומעם
 * - Secondary: מילוי שקוף עם מסגרת
 * - Ghost: שקוף עם טקסט ירוק
 * - Border radius pill מלא
 */
const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  title,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = true,
  onPress,
  style,
  textStyle,
  haptic = true,
}) => {
  const tokens = useDesignTokens();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: 'transparent',
            borderRadius: tokens.borderRadius.button,
          },
          text: {
            color: disabled
              ? tokens.colors.text.tertiary
              : tokens.colors.text.primary,
            fontWeight: tokens.typography.button.weight,
            fontSize: tokens.typography.button.size,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: disabled
              ? tokens.colors.background.tertiary
              : tokens.colors.background.navChrome,
            borderWidth: 0,
            borderRadius: tokens.borderRadius.button,
          },
          text: {
            color: disabled
              ? tokens.colors.text.disabled
              : tokens.colors.text.primary,
            fontWeight: tokens.typography.button.weight,
            fontSize: tokens.typography.button.size,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: disabled
              ? tokens.colors.text.disabled
              : tokens.colors.primary.main,
            fontWeight: '600',
            fontSize: tokens.typography.body.size,
          },
        };
      default:
        return {
          container: {
            backgroundColor: tokens.colors.primary.main,
            borderRadius: tokens.borderRadius.button,
          },
          text: {
            color: tokens.colors.text.inverse,
            fontWeight: tokens.typography.button.weight,
            fontSize: tokens.typography.button.size,
          },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; icon: number } => {
    switch (size) {
      case 'md':
        return {
          container: {
            paddingHorizontal: tokens.spacing.xl,
            minHeight: 48,
            paddingVertical: 0,
          },
          icon: 20,
        };
      case 'lg':
      default:
        return {
          container: {
            paddingHorizontal: tokens.spacing.xl,
            minHeight: 56,
            paddingVertical: 0,
          },
          icon: 22,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...sizeStyles.container,
    ...variantStyles.container,
    ...(fullWidth && { width: '100%' }),
    ...style,
  };

  const textStyleCombined: TextStyle = {
    ...variantStyles.text,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    textAlign: 'center',
    ...textStyle,
  };

  const iconColor = variantStyles.text.color;

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      void HapticFeedback.impactLight();
    }
    onPress?.();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={iconColor}
          size={size === 'lg' ? 'large' : 'small'}
        />
      );
    }

    const textElement = <Text style={textStyleCombined}>{title}</Text>;

    const iconElement = icon && (
      <Ionicons
        name={icon}
        size={sizeStyles.icon}
        color={iconColor}
        style={{
          marginRight: iconPosition === 'left' ? tokens.spacing.sm : 0,
          marginLeft: iconPosition === 'right' ? tokens.spacing.sm : 0,
        }}
      />
    );

    if (iconPosition === 'right') {
      return (
        <>
          {textElement}
          {iconElement}
        </>
      );
    }

    return (
      <>
        {iconElement}
        {textElement}
      </>
    );
  };

  if (variant === 'primary') {
    const minHeight = size === 'lg' ? 56 : 48;
    return (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          {
            borderRadius: tokens.borderRadius.button,
            ...(fullWidth ? { width: '100%' as const } : null),
            opacity: disabled && !loading ? 0.88 : pressed && !loading ? 0.9 : 1,
            transform:
              pressed && !disabled && !loading ? [{ scale: 0.98 }] : undefined,
          },
          style,
        ]}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <UICard
          variant="glass"
          enableBlur
          glassIntensity={disabled ? 'subtle' : 'light'}
          padding="none"
          haptic={false}
          style={{
            borderRadius: tokens.borderRadius.button,
            width: fullWidth ? '100%' : undefined,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          }}
          contentContainerStyle={{
            minHeight,
            paddingHorizontal: tokens.spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderContent()}
        </UICard>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        containerStyle,
        pressed && !disabled && !loading && {
          opacity: 0.88,
          transform: [{ scale: 0.98 }],
        },
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {renderContent()}
    </Pressable>
  );
};

export default OnboardingButton;
