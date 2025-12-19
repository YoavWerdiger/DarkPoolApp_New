import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  Pressable, 
  ViewStyle, 
  TextStyle,
  TextInputProps 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';

export interface UIInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  variant?: 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

const UIInput: React.FC<UIInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  variant = 'outlined',
  size = 'md',
  containerStyle,
  inputStyle,
  ...textInputProps
}) => {
  const DesignTokens = useDesignTokens();
  const { colors, typography, spacing, borderRadius } = DesignTokens;
  const [isFocused, setIsFocused] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
          text: { fontSize: typography.fontSize.sm },
          icon: 16,
        };
      case 'lg':
        return {
          container: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
          text: { fontSize: typography.fontSize.lg },
          icon: 24,
        };
      default:
        return {
          container: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
          text: { fontSize: typography.fontSize.base },
          icon: 20,
        };
    }
  };

  const getVariantStyles = () => {
    const baseStyle = {
      borderRadius: borderRadius.md,
      borderWidth: 1,
    };

    if (variant === 'filled') {
      return {
        ...baseStyle,
        backgroundColor: colors.background.elevated,
        borderColor: isFocused ? colors.primary.main : 'transparent',
      };
    }

    return {
      ...baseStyle,
      backgroundColor: 'transparent',
      borderColor: error 
        ? colors.danger.main
        : isFocused 
          ? colors.primary.main 
          : colors.border.primary,
    };
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const containerStyles: ViewStyle = {
    ...variantStyles,
    ...sizeStyles.container,
    flexDirection: 'row',
    alignItems: 'center',
    ...containerStyle,
  };

  const inputStyles: ViewStyle = {
    flex: 1,
    color: colors.text.primary,
    fontSize: sizeStyles.text.fontSize,
    fontFamily: typography.fontFamily.system[0],
    paddingVertical: 0, // Remove default padding
    ...inputStyle,
  };

  const labelStyle: TextStyle = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  };

  const helperTextStyle: TextStyle = {
    fontSize: typography.fontSize.xs,
    color: error ? colors.danger.main : colors.text.tertiary,
    marginTop: spacing.xs,
  };

  const iconColor = error 
    ? colors.danger.main 
    : isFocused 
      ? colors.primary.main 
      : colors.text.secondary;

  return (
    <View>
      {/* Label */}
      {label && <Text style={labelStyle}>{label}</Text>}
      
      {/* Input Container */}
      <View style={containerStyles}>
        {/* Left Icon */}
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={sizeStyles.icon} 
            color={iconColor}
            style={{ marginRight: spacing.sm }}
          />
        )}

        {/* Text Input */}
        <TextInput
          style={inputStyles}
          placeholderTextColor={colors.text.tertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />

        {/* Right Icon */}
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            style={{ marginLeft: spacing.sm }}
          >
            <Ionicons 
              name={rightIcon} 
              size={sizeStyles.icon} 
              color={iconColor}
            />
          </Pressable>
        )}
      </View>

      {/* Helper Text / Error */}
      {(helperText || error) && (
        <Text style={helperTextStyle}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

export default UIInput;

