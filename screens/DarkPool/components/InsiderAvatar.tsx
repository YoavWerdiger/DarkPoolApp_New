import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { INVESTOR_PORTRAIT_PLACEHOLDER_URI } from '../utils/investorPlaceholder';

interface Props {
  name: string | null | undefined;
  logoUrl?: string | null;
  size?: number;
}

export function InsiderAvatar({ name, logoUrl, size = 40 }: Props) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const radius = size / 2;
  const label = name?.trim() || 'משקיע';
  const uri = logoUrl && !failed ? logoUrl : INVESTOR_PORTRAIT_PLACEHOLDER_URI;

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
        style={{ width: size, height: size, borderRadius: radius, opacity: logoUrl && !failed ? 1 : 0.72 }}
        onError={() => setFailed(true)}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: '#0f160f',
    borderWidth: 1,
  },
});
