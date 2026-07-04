import React, { memo, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useDesignTokens } from './DesignTokens';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';

type TickerLogoProps = {
  symbol: string;
  size: number;
  borderRadius?: number;
};

export const TickerLogo = memo(function TickerLogo({
  symbol,
  size,
  borderRadius,
}: TickerLogoProps) {
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
        backgroundColor: tokens.colors.background.elevated,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={symbol}
          onError={() => setFailed(true)}
        />
      ) : (
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
      )}
    </View>
  );
});

export default TickerLogo;
