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
  inputStyle?: TextStyle;
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
  const tokens = useDesignTokens();
  const { colors, typography, spacing, borderRadius } = tokens;
  const [isFocused, setIsFocused] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingHorizontal: spacing.md, minHeight: 40 },
          text: { fontSize: typography.bodySmall.size },
          icon: 18,
        };
      case 'lg':
        return {
          container: { paddingHorizontal: spacing.xl, minHeight: 56 },
          text: { fontSize: typography.body.size },
          icon: 22,
        };
      default:
        return {
          container: { paddingHorizontal: spacing.lg, minHeight: 48 },
          text: { fontSize: typography.body.size },
          icon: 20,
        };
    }
  };

  const getBorderColor = () => {
    if (error) return colors.danger.main;
    if (isFocused) return colors.border.accent;
    return colors.border.default;
  };

  const sizeStyles = getSizeStyles();

  const fieldStyle: ViewStyle = {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: getBorderColor(),
    backgroundColor: colors.background.input,
    ...sizeStyles.container,
    flexDirection: 'row',
    alignItems: 'center',
    ...containerStyle,
  };

  const inputStyles: TextStyle = {
    flex: 1,
    color: colors.text.primary,
    fontSize: sizeStyles.text.fontSize,
    fontFamily: typography.fontFamily.system[0],
    paddingVertical: 0,
    ...inputStyle,
  };

  const labelStyle: TextStyle = {
    fontSize: typography.caption.size,
    fontWeight: typography.label.weight,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  };

  const helperStyle: TextStyle = {
    fontSize: typography.captionSmall.size,
    fontWeight: typography.caption.weight,
    color: error ? colors.danger.main : colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  };

  const iconColor = error 
    ? colors.danger.main 
    : isFocused 
      ? colors.primary.main 
      : colors.text.tertiary;

  return (
    <View>
      {label && <Text style={labelStyle}>{label}</Text>}
      <View style={fieldStyle}>
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={sizeStyles.icon} 
            color={iconColor}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <TextInput
          style={inputStyles}
          placeholderTextColor={colors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />
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
      {(helperText || error) && (
        <Text style={helperStyle}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

export default UIInput;
