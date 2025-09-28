import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import DesignTokens from './DesignTokens';

export interface UICardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: ViewStyle;
  pressable?: boolean;
}

const UICard: React.FC<UICardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  pressable = false,
}) => {
  const { colors, spacing, borderRadius, shadows } = DesignTokens;

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.elevated,
          ...shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: colors.surface,
          ...shadows.sm,
        };
    }
  };

  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'sm':
        return { padding: spacing.sm };
      case 'lg':
        return { padding: spacing['2xl'] };
      default:
        return { padding: spacing.lg };
    }
  };

  const baseStyle: ViewStyle = {
    borderRadius: borderRadius.lg,
    ...getVariantStyle(),
    ...getPaddingStyle(),
    ...style,
  };

  if (pressable || onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          baseStyle,
          pressed && {
            opacity: 0.9,
            transform: [{ scale: 0.98 }],
          },
        ]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
};

export default UICard;

