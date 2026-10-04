import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';

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
 * כפתור רישום/אונבורדינג — UIButton של הטופולוגיה (CTA ראשי lightCta, משני navChrome),
 * תמיד pill. נשמר כ-wrapper כדי שכל מסכי הרישום יתעדכנו בלי לגעת בהם.
 */
const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  title,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  style,
  textStyle,
  ...rest
}) => {
  const tokens = useDesignTokens();
  return (
    <UIButton
      {...rest}
      title={title}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      style={{ borderRadius: tokens.borderRadius.full, ...style }}
      textStyle={variant === 'ghost' ? { color: tokens.colors.text.primary, ...textStyle } : textStyle}
    />
  );
};

export default OnboardingButton;
