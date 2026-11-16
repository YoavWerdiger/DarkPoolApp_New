import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useDesignTokens } from './DesignTokens';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';

type TickerLogoProps = {
  symbol: string;
  size: number;
  borderRadius?: number;
};

/** function export (לא memo) — יציב ל־Fast Refresh / Hermes */
export function TickerLogo({ symbol, size, borderRadius }: TickerLogoProps) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;
  const initials = symbol.trim().slice(0, 4).toUpperCase() || '—';
  const radius = borderRadius ?? size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* האותיות תמיד מתחת — בזמן טעינה / בלי לוגו רואים את הטיקר ולא עיגול ריק (QA 14.3) */}
      <Text
        style={{
          fontSize: Math.max(10, size * 0.28),
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        }}
        numberOfLines={1}
      >
        {initials}
      </Text>
      {uri ? (
        <ExpoImage
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={`${symbol}-icon-light`}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

/** טעינה מוקדמת של לוגואים לדיסק (למשל כל הטיקרים של שבוע הדיווחים) */
export function prefetchTickerLogos(symbols: readonly string[]): void {
  const uris = Array.from(new Set(symbols))
    .map((s) => brandfetchTickerLogoUri(s))
    .filter((u): u is string => !!u);
  if (uris.length === 0) return;
  void ExpoImage.prefetch(uris, { cachePolicy: 'memory-disk' }).catch(() => undefined);
}

export default TickerLogo;
