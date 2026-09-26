import React, { useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from './DesignTokens';
import {
  navGlassAndroidBlurProps,
  navGlassBaseFill,
  navGlassBlurIntensity,
  navGlassBlurTint,
  navGlassBorderStyle,
  navGlassOverlay,
  type NavGlassIntensity,
} from './navGlass';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type NavGlassSurfaceProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  glassIntensity?: NavGlassIntensity;
  /** מסגרת highlight — ברירת מחדל דלוק לכרום ניווט */
  showBorder?: boolean;
  accessibilityLabel?: string;
  haptic?: boolean;
};

/**
 * משטח זכוכית לכפתורי ניווט / pill תחתון — Blur + tint + stroke.
 * לא עובר דרך UICard soft; עובד גם באנדרואיד (SDK31+ blur + fallback).
 */
export function NavGlassSurface({
  children,
  onPress,
  disabled = false,
  style,
  contentContainerStyle,
  glassIntensity = 'light',
  showBorder = true,
  accessibilityLabel,
  haptic = true,
}: NavGlassSurfaceProps) {
  const tokens = useDesignTokens();
  const isDarkMode = tokens.colors.background.primary !== '#F5F5F7';
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius = (flat?.borderRadius as number | undefined) ?? tokens.borderRadius.full;

  const shellStyle = useMemo(
    () => [
      styles.shell,
      { borderRadius: radius, overflow: 'hidden' as const },
      showBorder ? navGlassBorderStyle(isDarkMode, glassIntensity) : { borderWidth: 0 },
      disabled && styles.disabled,
      style,
    ],
    [disabled, glassIntensity, isDarkMode, radius, showBorder, style],
  );

  const layers = (
    <>
      <BlurView
        intensity={navGlassBlurIntensity(glassIntensity)}
        tint={navGlassBlurTint(isDarkMode)}
        {...navGlassAndroidBlurProps}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {Platform.OS === 'android' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, backgroundColor: navGlassBaseFill(isDarkMode) },
          ]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: navGlassOverlay(isDarkMode, glassIntensity) },
        ]}
      />
      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        style={({ pressed }) => [shellStyle, pressed && styles.pressed]}
        onPress={() => {
          if (haptic) void HapticFeedback.impactLight();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {layers}
      </Pressable>
    );
  }

  return (
    <View style={shellStyle} pointerEvents={disabled ? 'none' : 'auto'} accessibilityLabel={accessibilityLabel}>
      {layers}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
