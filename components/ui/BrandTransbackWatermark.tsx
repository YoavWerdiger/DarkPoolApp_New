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
    // גדול יותר מהחלון הנראה — נחתך ב-overflow כדי לשמור על נוכחות ברקע גם בשיטים קטנים
    const imgW = W * 2.85;
    const imgH = Math.max(visibleH * 1.85, W * 1.38);
    const top = visibleH - imgH * 0.62;

    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}
      >
        <View
          style={{
            position: 'absolute',
            left: (W - imgW) / 2,
            top,
            width: imgW,
            height: imgH,
            opacity: 0.28,
            alignItems: 'center',
            justifyContent: 'center',
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
