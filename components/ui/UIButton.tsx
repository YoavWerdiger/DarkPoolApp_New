import React from 'react';
import { Pressable, Text, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DesignTokens from './DesignTokens';

export type UIButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type UIButtonSize = 'sm' | 'md' | 'lg';

export interface UIButtonProps {
  title?: string;
  variant?: UIButtonVariant;
  size?: UIButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

const UIButton: React.FC<UIButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  style,
  textStyle,
  children,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = DesignTokens;

  // Variant Styles
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: colors.primary,
            ...shadows.md,
          },
          text: {
            color: '#000000',
            fontWeight: typography.fontWeight.semibold,
          },
        };
      
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
          },
          text: {
            color: colors.textPrimary,
            fontWeight: typography.fontWeight.medium,
          },
        };
      
      case 'danger':
        return {
          container: {
            backgroundColor: colors.danger,
            ...shadows.md,
          },
          text: {
            color: colors.textPrimary,
            fontWeight: typography.fontWeight.semibold,
          },
        };
      
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: colors.primary,
            fontWeight: typography.fontWeight.medium,
          },
        };
      
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.primary,
          },
          text: {
            color: colors.primary,
            fontWeight: typography.fontWeight.medium,
          },
        };
      
      default:
        return {
          container: {
            backgroundColor: colors.primary,
            ...shadows.md,
          },
          text: {
            color: '#000000',
            fontWeight: typography.fontWeight.semibold,
          },
        };
    }
  };

  // Size Styles
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; icon: number } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            minHeight: 36,
          },
          text: {
            fontSize: typography.fontSize.sm,
          },
          icon: 16,
        };
      
      case 'lg':
        return {
          container: {
            paddingHorizontal: spacing['2xl'],
            paddingVertical: spacing.lg,
            borderRadius: borderRadius.xl,
            minHeight: 56,
          },
          text: {
            fontSize: typography.fontSize.lg,
          },
          icon: 24,
        };
      
      default: // md
        return {
          container: {
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            minHeight: 48,
          },
          text: {
            fontSize: typography.fontSize.base,
          },
          icon: 20,
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
    ...(disabled && {
      opacity: 0.5,
    }),
    ...style,
  };

  const textStyleCombined: TextStyle = {
    ...sizeStyles.text,
    ...variantStyles.text,
    fontFamily: typography.fontFamily.system[0],
    ...textStyle,
  };

  const iconColor = variantStyles.text.color;

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          color={iconColor} 
          size={size === 'lg' ? 'large' : 'small'} 
        />
      );
    }

    const textElement = (title || children) && (
      <Text style={textStyleCombined}>
        {children || title}
      </Text>
    );

    const iconElement = icon && (
      <Ionicons 
        name={icon} 
        size={sizeStyles.icon} 
        color={iconColor}
        style={{
          marginRight: iconPosition === 'left' && (title || children) ? spacing.sm : 0,
          marginLeft: iconPosition === 'right' && (title || children) ? spacing.sm : 0,
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

  return (
    <Pressable
      style={({ pressed }) => [
        containerStyle,
        pressed && {
          opacity: 0.8,
          transform: [{ scale: 0.98 }],
        },
      ]}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
    >
      {renderContent()}
    </Pressable>
  );
};

export default UIButton;

