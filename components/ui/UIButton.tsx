import React from 'react';
import { Pressable, Text, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type UIButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'hairline';
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
  /** השבתת רטט בלחיצה (ברירת מחדל: רטט קל פעיל) */
  haptic?: boolean;
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
  haptic = true,
}) => {
  const DesignTokens = useDesignTokens();
  const { colors, typography, spacing, borderRadius, shadows } = DesignTokens;

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: colors.primary.lightCta,
            borderRadius: borderRadius.full,
            ...shadows.green,
          },
          text: {
            color: colors.text.inverse,
            fontWeight: typography.fontWeight.semibold,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.background.navChrome,
            borderWidth: 0,
            borderRadius: borderRadius.md,
          },
          text: {
            color: colors.text.primary,
            fontWeight: typography.button.weight,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: colors.danger.main,
            borderRadius: borderRadius.md,
            ...shadows.md,
          },
          text: {
            color: '#FFFFFF',
            fontWeight: typography.fontWeight.bold,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: colors.primary.main,
            fontWeight: typography.fontWeight.semibold,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary.main,
            borderRadius: borderRadius.md,
          },
          text: {
            color: colors.primary.main,
            fontWeight: typography.fontWeight.semibold,
          },
        };
      case 'hairline':
        return {
          container: {
            backgroundColor: colors.background.navChrome,
            borderWidth: 0,
            borderRadius: borderRadius.md,
          },
          text: {
            color: colors.text.primary,
            fontWeight: typography.fontWeight.medium,
          },
        };
      default:
        return {
          container: {
            backgroundColor: colors.primary.main,
            borderRadius: borderRadius.md,
            ...shadows.md,
          },
          text: {
            color: colors.text.inverse,
            fontWeight: typography.fontWeight.bold,
          },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; icon: number } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: spacing.lg,
            minHeight: 40,
            paddingVertical: 0,
          },
          text: { fontSize: typography.caption.size },
          icon: 16,
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: spacing['2xl'],
            minHeight: 56,
            paddingVertical: 0,
          },
          text: { fontSize: typography.button.size, fontWeight: typography.button.weight },
          icon: 24,
        };
      default:
        return {
          container: {
            paddingHorizontal: spacing.xl,
            minHeight: 52,
            paddingVertical: 0,
          },
          text: { fontSize: typography.button.size },
          icon: 20,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const faceStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...sizeStyles.container,
    ...variantStyles.container,
    ...(fullWidth && { width: '100%', alignSelf: 'stretch' as const }),
    ...(disabled && { opacity: 0.5 }),
    ...style,
    ...(variant === 'primary' ? { borderRadius: borderRadius.full } : null),
  };

  const pressableStyle: ViewStyle = fullWidth
    ? { width: '100%', alignSelf: 'stretch' as const }
    : {};

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

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      if (variant === 'danger') {
        void HapticFeedback.medium();
      } else {
        void HapticFeedback.impactLight();
      }
    }
    onPress?.();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        pressableStyle,
        pressed &&
          !disabled &&
          !loading && {
            opacity: 0.92,
            transform: [{ scale: 0.985 }],
          },
      ]}
      onPress={disabled || loading ? undefined : handlePress}
      disabled={disabled || loading}
    >
      <View style={faceStyle}>{renderContent()}</View>
    </Pressable>
  );
};

export default UIButton;

