import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet, Platform, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens, DesignTokens as StaticDesignTokens } from './DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { HapticFeedback } from '../../utils/hapticFeedback';

export interface UICardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'accent' | 'glass' | 'blur' | 'inputGlass' | 'surface';
  glassIntensity?: 'subtle' | 'light' | 'medium' | 'strong';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  pressable?: boolean;
  accessibilityLabel?: string;
  /** השבתת מסגרת הזכוכית הפנימית כשיש מסגרת accent חיצונית */
  showGlassBorder?: boolean;
  /** השבתת רטט בלחיצה (ברירת מחדל: רטט קל פעיל אם יש onPress) */
  haptic?: boolean;
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
  accessibilityLabel,
  showGlassBorder = true,
  haptic = true,
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
          backgroundColor: 'transparent',
          borderWidth: StaticDesignTokens.onboardingInputSurface.borderWidth,
          borderColor: StaticDesignTokens.onboardingInputSurface.borderColor,
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
  const isInputGlass = variant === 'inputGlass';
  const inputSurface = StaticDesignTokens.onboardingInputSurface;
  /** ל־inputGlass: רקע עובר לשכבת overlay כדי ש־BlurView יעבוד מאחוריו */
  const inputOverlayColor =
    (isInputGlass ? (flatOuterStyle?.backgroundColor as string | undefined) : undefined) ??
    inputSurface.backgroundColor;
  const outerStyleForBase =
    isInputGlass && flatOuterStyle
      ? (() => {
          const { backgroundColor: _bg, ...rest } = flatOuterStyle;
          return rest;
        })()
      : flatOuterStyle;

  const baseStyle: ViewStyle = {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...getVariantStyle(),
    ...getPaddingStyle(),
    ...outerStyleForBase,
  };

  /** רדיוס לשכבות blur/מילוי — חייב להתאים ל־outer כדי שהעיגול ייראה מלא (לא "ריבוע עם blur"). */
  const clipCornerRadius = flatOuterStyle?.borderRadius ?? borderRadius.lg;

  const themeMode = isDarkMode ? 'dark' : 'light';
  const glassOverlay = isInputGlass
    ? inputOverlayColor
    : glassmorphism.cardBackground[themeMode][glassIntensity];
  const glassBorder = glassmorphism.border[themeMode][glassIntensity];
  const glassTopHighlight = glassmorphism.topHighlight[themeMode][glassIntensity];
  const blurIntensityValue = isInputGlass
    ? inputSurface.blurIntensity
    : glassmorphism.blurIntensity[glassIntensity];
  const blurTint =
    Platform.OS === 'ios'
      ? isDarkMode
        ? ('systemThinMaterialDark' as const)
        : ('systemThinMaterialLight' as const)
      : isDarkMode
        ? ('dark' as const)
        : ('light' as const);

  const usesGlassLayers = variant === 'glass' || variant === 'blur' || isInputGlass;

  const flatContentStyle = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
  const contentFillsParent =
    flatContentStyle?.flex === 1 ||
    flatContentStyle?.flexGrow === 1 ||
    flatContentStyle?.height === '100%';

  const cardContent = (
    <>
      {usesGlassLayers ? (
        <>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={blurIntensityValue}
              tint={blurTint}
              style={[StyleSheet.absoluteFill, { borderRadius: clipCornerRadius, overflow: 'hidden' }]}
            />
          ) : (
            // Android: solid/dark backdrop (no BlurView) so overlay still reads as frosted glass.
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: clipCornerRadius,
                  overflow: 'hidden',
                  backgroundColor: isInputGlass
                    ? inputSurface.androidFallback
                    : isDarkMode
                      ? colors.background.cardSolid
                      : colors.background.secondary,
                },
              ]}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: clipCornerRadius,
                overflow: 'hidden',
                backgroundColor: glassOverlay,
              },
            ]}
          />
          {showGlassBorder && !isInputGlass ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: glassBorder,
                  borderTopColor: glassTopHighlight,
                  borderRadius: clipCornerRadius,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}
      <View
        style={[
          { position: 'relative', zIndex: 1 },
          // רשימות בגובה מלא בתוך glass — למנוע קריסה ל-0
          contentFillsParent
            ? { alignSelf: 'stretch', minHeight: 0, height: '100%' }
            : null,
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
    </>
  );

  if (pressable || onPress) {
    const handlePress = onPress
      ? () => {
          if (haptic) void HapticFeedback.impactLight();
          onPress();
        }
      : undefined;
    return (
      <Pressable
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
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
