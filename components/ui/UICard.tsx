import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet, Platform, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens, DesignTokens as StaticDesignTokens } from './DesignTokens';
import { LIGHT_CANVAS } from './designTokensStatic';
import {
  CARD_GLASS_ANDROID_BLUR_METHOD,
  CARD_GLASS_ANDROID_BLUR_REDUCTION,
  cardGlassBlurTint,
  darkCardSurface,
  resolveUiCardBlur,
  outerStyleBlocksGlassBorder,
  stripConflictingOuterStyleForGlassBorder,
  uiCardOuterOverflow,
  type UiCardVariant,
} from './cardGlass';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { UI_CARD_RADIUS } from './appLayout';

/** מילוי אטום על מעטפת זכוכית חוסם את ה-Blur ואת האורורה מאחור. */
function isOpaqueFill(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent') return false;
  if (c.startsWith('#')) {
    if (c.length === 4 || c.length === 7) return true;
    if (c.length === 5) return c[4] === 'f';
    if (c.length === 9) return c.slice(7) === 'ff';
    return true;
  }
  if (/^rgb\(/i.test(c)) return true;
  const m = c.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i);
  if (m) return Number(m[1]) >= 0.88;
  return false;
}

export interface UICardProps {
  children: React.ReactNode;
  variant?: UiCardVariant;
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
  /**
   * מדלג על BlurView — חובה בשורות רשימה (פיד, גילוי, יומן) וב־view-shot.
   * בלי blur נשארים translucent + tint + highlight (אותו מראה iOS/Android).
   */
  disableBlur?: boolean;
  /**
   * BlurView מלא (כרום / כרטיס בודד / שיט).
   * ברירת מחדל: דולק ל־elevated / blur / surface / inputGlass; כבוי ל־glass.
   */
  enableBlur?: boolean;
}

const UICard: React.FC<UICardProps> = ({
  children,
  variant = 'soft',
  glassIntensity = 'light',
  padding = 'md',
  onPress,
  style,
  contentContainerStyle,
  pressable = false,
  accessibilityLabel,
  showGlassBorder = false,
  haptic = true,
  disableBlur = false,
  enableBlur,
}) => {
  const tokens = useDesignTokens();
  const { colors, spacing, shadows, glassmorphism, layout } = tokens;
  const isDarkMode = colors.background.primary !== LIGHT_CANVAS;
  const themeMode = isDarkMode ? 'dark' : 'light';
  /** glass/blur/default → soft כמו כרטיסי אקדמיה (אטום, בלי stroke). */
  const resolvedVariant: UiCardVariant =
    variant === 'glass' || variant === 'default' || variant === 'blur' ? 'soft' : variant;
  const useNativeBlur = resolveUiCardBlur({
    variant: resolvedVariant,
    enableBlur,
    disableBlur,
  });

  const getVariantStyle = (): ViewStyle => {
    switch (resolvedVariant) {
      case 'soft':
        return {
          backgroundColor: colors.background.cardSolid,
          borderWidth: 0,
          ...shadows.none,
        };
      case 'elevated':
        return {
          backgroundColor: colors.background.elevated2,
          borderWidth: 0,
          ...shadows.none,
        };
      case 'surface':
        return {
          backgroundColor: colors.background.secondary,
          borderWidth: 0,
          ...shadows.none,
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
      case 'inputGlass':
        return {
          backgroundColor: 'transparent',
          borderWidth: StaticDesignTokens.onboardingInputSurface.borderWidth,
          borderColor: StaticDesignTokens.onboardingInputSurface.borderColor,
          ...shadows.none,
        };
      case 'glass':
      case 'blur':
      case 'default':
        if (isDarkMode && !useNativeBlur) {
          return {
            backgroundColor: darkCardSurface(glassIntensity),
            borderWidth: 0,
            ...shadows.none,
          };
        }
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          ...shadows.none,
        };
      default:
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          ...shadows.none,
        };
    }
  };

  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'sm':
        return { padding: spacing.md };
      case 'lg':
        return { padding: layout?.cardPadding ?? spacing.xl };
      default:
        return { padding: layout?.cardPadding ?? 20 };
    }
  };

  const flatOuterStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const isInputGlass = resolvedVariant === 'inputGlass';
  const legacyGlassVariant =
    resolvedVariant === 'glass' ||
    resolvedVariant === 'blur' ||
    resolvedVariant === 'default';
  const usesGlassLayers =
    isInputGlass || (!isDarkMode && legacyGlassVariant) || (isDarkMode && useNativeBlur);
  const inputSurface = StaticDesignTokens.onboardingInputSurface;
  /** ל־inputGlass: רקע עובר לשכבת overlay כדי ש־BlurView יעבוד מאחוריו */
  const inputOverlayColor =
    (isInputGlass ? (flatOuterStyle?.backgroundColor as string | undefined) : undefined) ??
    inputSurface.backgroundColor;
  const outerStyleForBase =
    usesGlassLayers && flatOuterStyle && (isInputGlass || isOpaqueFill(flatOuterStyle.backgroundColor))
      ? (() => {
          const { backgroundColor: _bg, ...rest } = flatOuterStyle;
          return rest;
        })()
      : flatOuterStyle;

  const applyGlassBorder =
    usesGlassLayers &&
    showGlassBorder &&
    !isInputGlass &&
    !outerStyleBlocksGlassBorder(flatOuterStyle ?? {});

  const glassBorderStyle: ViewStyle = applyGlassBorder
    ? {
        borderWidth: 1,
        borderColor: glassmorphism.border[themeMode][glassIntensity],
        borderTopColor: glassmorphism.topHighlight[themeMode][glassIntensity],
      }
    : {};

  const clippedOuterStyle = stripConflictingOuterStyleForGlassBorder(
    outerStyleForBase,
    applyGlassBorder
  );

  const baseStyle: ViewStyle = {
    borderRadius: UI_CARD_RADIUS,
    ...getVariantStyle(),
    ...glassBorderStyle,
    ...getPaddingStyle(),
    ...clippedOuterStyle,
    overflow: uiCardOuterOverflow(applyGlassBorder),
  };

  /** רדיוס לשכבות blur/מילוי — חייב להתאים ל־outer כדי שהעיגול ייראה מלא (לא "ריבוע עם blur"). */
  const clipCornerRadius = flatOuterStyle?.borderRadius ?? UI_CARD_RADIUS;

  const glassOverlay = isInputGlass
    ? inputOverlayColor
    : isDarkMode
      ? darkCardSurface(glassIntensity)
      : glassmorphism.cardBackground[themeMode][glassIntensity];
  const blurIntensityValue = isInputGlass
    ? inputSurface.blurIntensity
    : glassmorphism.blurIntensity[glassIntensity];
  const blurTint = cardGlassBlurTint(isDarkMode);
  const skipGlassOverlay = isDarkMode && !isInputGlass;
  const androidBlurProps =
    Platform.OS === 'android'
      ? {
          blurMethod: CARD_GLASS_ANDROID_BLUR_METHOD,
          blurReductionFactor: CARD_GLASS_ANDROID_BLUR_REDUCTION,
        }
      : undefined;

  const flatContentStyle = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
  const contentFillsParent =
    flatContentStyle?.flex === 1 ||
    flatContentStyle?.flexGrow === 1 ||
    flatContentStyle?.height === '100%';

  const cardContent = (
    <>
      {usesGlassLayers ? (
        <>
          {useNativeBlur ? (
            <BlurView
              intensity={blurIntensityValue}
              tint={blurTint}
              {...androidBlurProps}
              style={[StyleSheet.absoluteFill, { borderRadius: clipCornerRadius, overflow: 'hidden' }]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: clipCornerRadius,
                  overflow: 'hidden',
                  backgroundColor: isInputGlass
                    ? inputSurface.androidFallback
                    : isDarkMode
                      ? darkCardSurface(glassIntensity)
                      : glassmorphism.baseFill[themeMode],
                },
              ]}
            />
          )}
          {!skipGlassOverlay ? (
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
          ) : null}
        </>
      ) : null}
      <View
        style={[
          usesGlassLayers
            ? {
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
                borderRadius: clipCornerRadius,
              }
            : { position: 'relative', zIndex: 1 },
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

export { UICard, resolveUiCardBlur };
export default UICard;
