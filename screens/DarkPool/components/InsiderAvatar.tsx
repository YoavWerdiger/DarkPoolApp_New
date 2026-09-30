import React, { memo, useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
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
  /** כשאין פנים — תמונה מקומית במקום הפלייסהולדר השקוף. */
  fallbackSource?: ImageSourcePropType;
}

export const InsiderAvatar = memo(function InsiderAvatar({
  name,
  logoUrl,
  size = 40,
  fallbackSource,
}: Props) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const radius = size / 2;
  const label = name?.trim() || 'משקיע';
  const face = logoUrl && looksLikePersonPhoto(logoUrl) ? logoUrl : null;
  const showFace = Boolean(face && !failed);
  const raw = showFace ? face! : INVESTOR_PORTRAIT_PLACEHOLDER_URI;
  const uri = portraitDisplayUrl(raw, Math.max(96, size * 3)) ?? raw;
  const source = showFace || !fallbackSource ? { uri } : fallbackSource;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: tokens.colors.border.divider,
          backgroundColor: tokens.colors.background.cardSolid,
        },
      ]}
    >
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          opacity: showFace || fallbackSource ? 1 : 0.72,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={showFace ? face! : fallbackSource ? `${name ?? ''}-fallback` : name || 'insider-avatar'}
        transition={0}
        onError={() => {
          if (showFace) setFailed(true);
        }}
        accessibilityLabel={label}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
});
