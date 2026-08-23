import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { brandfetchTickerLogoUri } from '../../../utils/brandfetch';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

interface Props {
  symbol: string;
  size?: number;
  borderRadius?: number;
}

/**
 * לוגו טיקר דרך Brandfetch CDN.
 * ממלא את העיגול במלואו (cover + overflow hidden).
 */
export function TickerLogo({ symbol, size = 36, borderRadius }: Props) {
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
        backgroundColor: '#FFFFFF',
      }}
    >
      <Image
        source={{ uri }}
        onError={() => setErrored(true)}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
