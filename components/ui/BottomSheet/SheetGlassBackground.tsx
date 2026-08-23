import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  SHEET_GLASS_FLOOR,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  SHEET_GLASS_TINT,
} from './sheetGlass';

type SheetGlassBackgroundProps = {
  /** true אחרי שה-Modal באמת מוצג (onShow) / אחרי frame ראשון בלי Modal */
  active: boolean;
  intensity?: number;
  overlayColor?: string;
};

/**
 * רקע זכוכית כהה (frosted) לשיט — כמו UICard glass:
 * BlurView (iOS) + overlay לבן עדין. Android: רצפה כהה + אותו overlay.
 */
export function SheetGlassBackground({
  active,
  intensity = SHEET_GLASS_INTENSITY,
  overlayColor = SHEET_GLASS_OVERLAY,
}: SheetGlassBackgroundProps) {
  const [hasLayout, setHasLayout] = useState(false);

  useEffect(() => {
    if (active) return;
    setHasLayout(false);
  }, [active]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1) {
      setHasLayout(true);
    }
  }, []);

  const useNativeBlur = Platform.OS === 'ios';
  const blurMounted = useNativeBlur && active && hasLayout;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
    >
      {!useNativeBlur || !blurMounted ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: SHEET_GLASS_FLOOR },
          ]}
        />
      ) : null}

      {blurMounted ? (
        <BlurView
          intensity={intensity}
          tint={SHEET_GLASS_TINT}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: overlayColor },
        ]}
      />
    </View>
  );
}
