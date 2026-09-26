import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  CARD_GLASS_ANDROID_BLUR_METHOD,
  CARD_GLASS_ANDROID_BLUR_REDUCTION,
} from '../cardGlass';
import {
  canLatchSheetGlass,
  SHEET_GLASS_BASE,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  SHEET_GLASS_TINT,
} from './sheetGlass';

type SheetGlassBackgroundProps = {
  /**
   * מאפשר mount ראשון של BlurView (אחרי layout / onShow).
   * אחרי שהזכוכית נדלקה — נשארת עד unmount. אין כיבוי ב-drag/סגירה.
   */
  active?: boolean;
  intensity?: number;
  overlayColor?: string;
  /**
   * השהיית BlurView (ms) אחרי layout — 0 = מיד.
   * BottomSheet מעביר SHEET_BLUR_DEFER_MS כדי שהעלייה לא תצייר blur.
   */
  deferMs?: number;
};

/**
 * רקע זכוכית כהה (frosted) לשיט — כמו UICard chrome:
 * BlurView + overlay לבן דק בשתי הפלטפורמות. לפני mount: רצפה שקופה־למחצה.
 * אטימות המשטח קבועה כל עוד השיט על המסך — backdrop הוא זה שזז עם progress.
 */
export function SheetGlassBackground({
  active = true,
  intensity = SHEET_GLASS_INTENSITY,
  overlayColor = SHEET_GLASS_OVERLAY,
  deferMs = 0,
}: SheetGlassBackgroundProps) {
  const [hasLayout, setHasLayout] = useState(false);
  const [blurLatched, setBlurLatched] = useState(false);
  const [deferDone, setDeferDone] = useState(deferMs <= 0);

  useEffect(() => {
    if (deferMs <= 0) {
      setDeferDone(true);
      return;
    }
    setDeferDone(false);
    const t = setTimeout(() => setDeferDone(true), deferMs);
    return () => clearTimeout(t);
  }, [deferMs]);

  useEffect(() => {
    setBlurLatched((prev) => canLatchSheetGlass(prev, active, hasLayout, deferDone));
  }, [active, hasLayout, deferDone]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1) {
      setHasLayout(true);
    }
  }, []);

  const blurMounted = blurLatched;
  const androidBlurProps =
    Platform.OS === 'android'
      ? {
          blurMethod: CARD_GLASS_ANDROID_BLUR_METHOD,
          blurReductionFactor: CARD_GLASS_ANDROID_BLUR_REDUCTION,
        }
      : undefined;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
    >
      {!blurMounted ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: SHEET_GLASS_BASE },
          ]}
        />
      ) : null}

      {blurMounted ? (
        <BlurView
          intensity={intensity}
          tint={SHEET_GLASS_TINT}
          {...androidBlurProps}
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
