import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet, Platform, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens, DesignTokens as StaticDesignTokens } from './DesignTokens';
import { useTheme } from '../../context/ThemeContext';

export interface UICardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'accent' | 'glass' | 'blur' | 'inputGlass' | 'surface';
  glassIntensity?: 'subtle' | 'light' | 'medium' | 'strong';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  pressable?: boolean;
}

const UICard: React.FC<UICardProps> = ({
  children,
  variant = 'elevated',
  glassIntensity = 'light',
  padding = 'md',
  onPress,
  style,
  contentContainerStyle,
  pressable = false,
}) => {
  const tokens = useDesignTokens();
  const { colors, spacing, borderRadius, shadows, glassmorphism, layout } = tokens;
  let isDarkMode = true;
  try {
    const theme = useTheme();
    isDarkMode = theme.isDarkMode;
  } catch {}

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.cardSolid,
          ...shadows.card,
        };
      case 'surface':
        return {
          backgroundColor: colors.background.secondary,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'accent':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary.main,
        };
      case 'glass':
      case 'blur':
        return {
          backgroundColor: 'transparent',
          ...shadows.sm,
        };
      case 'inputGlass':
        return {
          ...StaticDesignTokens.onboardingInputSurface,
          ...shadows.none,
        };
      default:
        return {
          backgroundColor: colors.background.secondary,
          ...shadows.xs,
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
        return { padding: layout?.cardPadding ?? spacing.xl };
      default:
        return { padding: layout?.cardPadding ?? spacing.lg };
    }
  };

  const flatOuterStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const baseStyle: ViewStyle = {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...getVariantStyle(),
    ...getPaddingStyle(),
    ...flatOuterStyle,
  };

  const themeMode = isDarkMode ? 'dark' : 'light';
  const glassOverlay = glassmorphism.cardBackground[themeMode][glassIntensity];
  const glassBorder = glassmorphism.border[themeMode][glassIntensity];
  const glassTopHighlight = glassmorphism.topHighlight[themeMode][glassIntensity];
  const blurTint =
    Platform.OS === 'ios'
      ? isDarkMode
        ? ('systemThinMaterialDark' as const)
        : ('systemThinMaterialLight' as const)
      : isDarkMode
        ? ('dark' as const)
        : ('light' as const);

  const cardContent = (
    <>
      {(variant === 'glass' || variant === 'blur') ? (
        <>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={glassmorphism.blurIntensity[glassIntensity]}
              tint={blurTint}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode
                    ? 'rgba(22, 32, 24, 0.72)'
                    : 'rgba(245, 245, 247, 0.88)',
                },
              ]}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: glassOverlay },
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: glassBorder,
                borderTopColor: glassTopHighlight,
                borderRadius: flatOuterStyle?.borderRadius ?? borderRadius.lg,
              },
            ]}
          />
        </>
      ) : null}
      <View style={[{ position: 'relative', zIndex: 1 }, StyleSheet.flatten(contentContainerStyle)]}>
        {children}
      </View>
    </>
  );

  if (pressable || onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
        onPress={onPress}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={baseStyle}>
      {cardContent}
    </View>
  );
};

export default UICard;
