import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  useColorScheme,
  View,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import DesignTokens from './DesignTokens';

export type UIGlassVariant = 'frosted' | 'translucent' | 'dynamic';

export interface UIGlassContainerProps {
  children: React.ReactNode;
  /** פרופיל ויזואלי: קפוא (טישטוש חזק), שקוף יותר, או דינמי לפי ערכת המערכת */
  variant?: UIGlassVariant;
  /** עוצמת טישטוש (כאשר blur פעיל) */
  intensity?: number;
  /** גוון BlurView של expo-blur */
  tint?: 'light' | 'dark' | 'default';
  style?: ViewStyle;
  /** כבוי כברירת מחדל ב-web — BlurView שם לעיתים יקר או לא עקבי */
  useBlur?: boolean;
}

const defaultBlurByPlatform = Platform.OS !== 'web';

function resolveVariant(
  variant: UIGlassVariant,
  scheme: 'light' | 'dark' | null | undefined,
): {
  intensity: number;
  tint: 'light' | 'dark' | 'default';
  overlay: string;
  fallback: string;
} {
  const { glass } = DesignTokens;
  const isLightScheme = scheme === 'light';

  if (variant === 'frosted') {
    return {
      intensity: glass.blur.frosted,
      tint: 'dark',
      overlay: glass.overlay.frostedDark,
      fallback: glass.fallback.dark,
    };
  }
  if (variant === 'translucent') {
    return {
      intensity: glass.blur.translucent,
      tint: 'dark',
      overlay: glass.overlay.translucentDark,
      fallback: glass.fallback.dark,
    };
  }
  // dynamic — התאמה גסה לערכת מערכת (ללא חישוב בהירות תוכן אמיתי)
  return {
    intensity: isLightScheme ? glass.blur.translucent : glass.blur.frosted,
    tint: isLightScheme ? 'light' : 'dark',
    overlay: isLightScheme ? glass.overlay.translucentLight : glass.overlay.frostedDark,
    fallback: isLightScheme ? glass.fallback.light : glass.fallback.dark,
  };
}

const UIGlassContainer: React.FC<UIGlassContainerProps> = ({
  children,
  variant = 'frosted',
  intensity: intensityProp,
  tint: tintProp,
  style,
  useBlur = defaultBlurByPlatform,
}) => {
  const colorScheme = useColorScheme();
  const { glass, borderRadius: br } = DesignTokens;
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function') {
          const enabled = await AccessibilityInfo.isReduceTransparencyEnabled();
          if (mounted) setReduceTransparency(!!enabled);
        }
      } catch {
        if (mounted) setReduceTransparency(false);
      }
    })();

    const sub =
      typeof AccessibilityInfo.addEventListener === 'function'
        ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', (enabled: boolean) => {
            setReduceTransparency(!!enabled);
          })
        : undefined;

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const resolved = resolveVariant(variant, colorScheme);
  const intensity = intensityProp ?? resolved.intensity;
  const tint = tintProp ?? resolved.tint;
  const overlayColor = resolved.overlay;
  const fallbackBg = resolved.fallback;

  const shouldBlur = useBlur && !reduceTransparency;

  const baseStyle: ViewStyle = {
    borderRadius: br.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    overflow: 'hidden',
  };

  if (!shouldBlur) {
    return (
      <View style={[baseStyle, { backgroundColor: fallbackBg }, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[baseStyle, { backgroundColor: overlayColor }, style]}>
      {children}
    </BlurView>
  );
};

export default UIGlassContainer;
