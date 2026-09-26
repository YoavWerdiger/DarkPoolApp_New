import React, { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  INVESTOR_PORTRAIT_PLACEHOLDER_URI,
  looksLikePersonPhoto,
  portraitDisplayUrl,
} from '../utils/investorPlaceholder';

interface Props {
  name: string | null | undefined;
  logoUrl?: string | null;
  size?: number;
}

export const InsiderAvatar = memo(function InsiderAvatar({
  name,
  logoUrl,
  size = 40,
}: Props) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const radius = size / 2;
  const label = name?.trim() || 'משקיע';
  const face = logoUrl && looksLikePersonPhoto(logoUrl) ? logoUrl : null;
  const raw = face && !failed ? face : INVESTOR_PORTRAIT_PLACEHOLDER_URI;
  const uri = portraitDisplayUrl(raw, Math.max(96, size * 3)) ?? raw;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: tokens.colors.border.subtle,
        },
      ]}
    >
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          opacity: face && !failed ? 1 : 0.72,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={face || name || 'insider-avatar'}
        transition={0}
        onError={() => setFailed(true)}
        accessibilityLabel={label}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: '#0f160f',
    borderWidth: 1,
  },
});
