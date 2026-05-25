import React from 'react';
import { View, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { SUPABASE_URL } from '../../config/publicEnv';

const TRANSBACK_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;

export type BrandTransbackLayout = 'fullscreen' | 'sheetBottom';

type Props = {
  /**
   * fullscreen — מרכז המסך (מסכים מלאים).
   * sheetBottom — בתוך השיט: ממורכז בגובה **החלק הנראה** (לא תחתית הקונטיינר המלא).
   */
  layout?: BrandTransbackLayout;
  /**
   * גובה בפיקסלים של החלק של השיט שנראה על המסך (כשהשיט פתוח ב־snap הראשי).
   * חובה ל־sheetBottom כדי שלא יישבו מתחת לקיפול המסך.
   */
  sheetVisibleHeightPx?: number;
};

/**
 * שכבת «שור ודוב» (transback) — כמו ברשימת צ׳אטים / ChatSessionBackdrop.
 * מונח מעל גרדיאנט המסך, מתחת לתוכן.
 */
export function BrandTransbackWatermark({
  layout = 'fullscreen',
  sheetVisibleHeightPx,
}: Props) {
  const { width: W, height: H } = Dimensions.get('window');

  if (layout === 'sheetBottom') {
    const visibleH = Math.min(Math.max(sheetVisibleHeightPx ?? H * 0.5, 180), H);
    const imgW = W * 2.1;
    const imgH = Math.max(visibleH * 1.35, W * 1.05);

    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', zIndex: 1 }]}
      >
        <View
          style={{
            position: 'absolute',
            left: (W - imgW) / 2,
            bottom: Math.max(visibleH * 0.06, 12),
            width: imgW,
            height: imgH,
            opacity: 0.32,
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

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { justifyContent: 'center', alignItems: 'center', opacity: 0.22 },
      ]}
    >
      <ImageBackground
        source={{ uri: TRANSBACK_URI }}
        style={{ width: W * 1.6, height: H * 1.6 }}
        imageStyle={{ resizeMode: 'contain' }}
      />
    </View>
  );
}
