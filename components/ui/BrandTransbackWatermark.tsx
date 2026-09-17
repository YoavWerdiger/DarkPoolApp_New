import React, { memo } from 'react';
import { View, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { SUPABASE_URL } from '../../config/publicEnv';

const TRANSBACK_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;
/** screen לא משתנה עם המקלדת (window כן — וזה גרם לקפיצת watermark ב-adjustResize). */
const SCREEN = Dimensions.get('screen');

export type BrandTransbackLayout = 'fullscreen' | 'sheetBottom';

type Props = {
  /**
   * fullscreen — מרכז המסך (מסכים מלאים).
   * sheetBottom — בתוך השיט: מעוגן לתחתית החלק הנראה, הדמויות עולות כלפי מעלה.
   */
  layout?: BrandTransbackLayout;
  /** גובה בפיקסלים של החלק של השיט שנראה על המסך */
  sheetVisibleHeightPx?: number;
  /** מכפיל גודל ב־sheetBottom (1 = ברירת מחדל) */
  scale?: number;
  /**
   * מסגרת ל־fullscreen (למשל כרטיס שיתוף) — במקום Dimensions של החלון.
   * שומר על אותו יחס 1.6 ואותה שקיפות כמו בדפים.
   */
  frameWidth?: number;
  frameHeight?: number;
};

/**
 * שכבת «שור ודוב» (transback) — כמו ברשימת צ׳אטים / ChatSessionBackdrop.
 */
export const BrandTransbackWatermark = memo(function BrandTransbackWatermark({
  layout = 'fullscreen',
  sheetVisibleHeightPx,
  scale = 1,
  frameWidth,
  frameHeight,
}: Props) {
  const W = frameWidth ?? SCREEN.width;
  const H = frameHeight ?? SCREEN.height;

  if (layout === 'sheetBottom') {
    const visibleH = Math.min(Math.max(sheetVisibleHeightPx ?? H * 0.5, 180), H);
    const imgW = W * 2.1 * scale;
    const imgH = Math.max(visibleH * 1.35, W * 1.05) * scale;
    const opacity = Math.min(0.34, 0.26 + scale * 0.08);

    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 1 }]}
      >
        <View
          style={{
            position: 'absolute',
            left: (W - imgW) / 2,
            bottom: Math.max(visibleH * 0.06, 12),
            width: imgW,
            height: imgH,
            opacity,
          }}
        >
          <ImageBackground
            source={{ uri: TRANSBACK_URI }}
            style={{ width: imgW, height: imgH }}
            imageStyle={{ resizeMode: 'contain' }}
          />
        </View>
      </View>
    );
  }

  const imgW = W * 1.6;
  const imgH = H * 1.6;
  /** כרטיס שיתוף: parent קטן מהתמונה — flex לא ממורכז אמין. מסכים: flex כמו בצ׳אט המקורי. */
  const useFrameOffsets = frameWidth != null && frameHeight != null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        useFrameOffsets
          ? { overflow: 'hidden', opacity: 0.22 }
          : { justifyContent: 'center', alignItems: 'center', opacity: 0.22 },
      ]}
    >
      <ImageBackground
        source={{ uri: TRANSBACK_URI }}
        style={
          useFrameOffsets
            ? {
                position: 'absolute',
                left: (W - imgW) / 2,
                top: (H - imgH) / 2,
                width: imgW,
                height: imgH,
              }
            : { width: imgW, height: imgH }
        }
        imageStyle={{ resizeMode: 'contain' }}
      />
    </View>
  );
});
