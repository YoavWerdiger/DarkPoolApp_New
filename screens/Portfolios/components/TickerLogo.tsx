import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { brandfetchTickerLogoUri } from '../../../utils/brandfetch';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

interface Props {
  symbol: string;
  size?: number;
  borderRadius?: number;
  /** מילוי מאחורי תמונת הלוגו (ברירת מחדל לבן). */
  backgroundColor?: string;
}

/**
 * לוגו טיקר דרך Brandfetch CDN.
 * ExpoImage + memory-disk — חשוב לגלילת פיד Dark Pool.
 *
 * ייצוא כ־function (לא memo object) — Fast Refresh / Hermes
 * נופלים על "Component is not a function (it is Object)" כשמשנים function↔memo ב־HMR.
 */
export function TickerLogo({
  symbol,
  size = 36,
  borderRadius,
  backgroundColor = '#FFFFFF',
}: Props) {
  const tokens = useDesignTokens();
  const [errored, setErrored] = useState(false);
  const uri = useMemo(() => brandfetchTickerLogoUri(symbol), [symbol]);
  const radius = borderRadius ?? size / 2;

  const fallbackColor = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = (hash << 5) - hash + symbol.charCodeAt(i);
      hash |= 0;
    }
    const palette = [
      '#3B82F6',
      '#A855F7',
      '#EC4899',
      '#F59E0B',
      '#10B981',
      '#06B6D4',
      '#EF4444',
      '#6366F1',
    ];
    return palette[Math.abs(hash) % palette.length];
  }, [symbol]);

  const initials = useMemo(() => symbol.slice(0, 2).toUpperCase(), [symbol]);

  if (!uri || errored) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: fallbackColor,
          },
        ]}
      >
        <Text
          style={[
            styles.fallbackText,
            {
              fontSize: Math.max(10, size * 0.36),
              color: tokens.colors.text.inverse,
            },
          ]}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor,
      }}
    >
      <ExpoImage
        source={{ uri }}
        onError={() => setErrored(true)}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`${symbol.toUpperCase()}-icon-light`}
        transition={80}
      />
    </View>
  );
}

export default TickerLogo;

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
