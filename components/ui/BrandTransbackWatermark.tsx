import React from 'react';
import { View, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { SUPABASE_URL } from '../../config/publicEnv';

const { width: W, height: H } = Dimensions.get('window');

/**
 * שכבת «שור ודוב» (transback) — כמו ברשימת צ׳אטים / ChatSessionBackdrop.
 * מונח מעל גרדיאנט המסך, מתחת לתוכן.
 */
export function BrandTransbackWatermark() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', opacity: 0.22 }]}
    >
      <ImageBackground
        source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
        style={{ width: W * 1.6, height: H * 1.6 }}
        imageStyle={{ resizeMode: 'contain' }}
      />
    </View>
  );
}
