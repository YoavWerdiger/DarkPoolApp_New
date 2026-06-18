import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import {
  INVESTOR_PORTRAIT_PLACEHOLDER_URI,
  resolveInvestorPortraitUri,
} from '../utils/investorPlaceholder';

interface Props {
  name: string;
  imageUrl?: string | null;
  ticker?: string;
  kind?: 'politician' | 'insider' | 'fund_manager';
  personId?: string;
  /** card = רקע מלא לכרטיס גילוי; circle = אווטאר עגול */
  layout: 'card' | 'circle';
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
}

function circleStyle(n: number) {
  return { width: n, height: n, borderRadius: n / 2 };
}

export function InvestorPortraitFallback({
  name,
  imageUrl,
  ticker,
  kind,
  personId,
  layout,
  size = 52,
  style,
  imageStyle,
  children,
}: Props) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const uri = useMemo(
    () =>
      resolveInvestorPortraitUri({
        imageUrl: failed ? null : imageUrl,
        kind,
        personId,
        name,
      }),
    [failed, imageUrl, kind, personId, name]
  );

  const showTickerHero =
    kind === 'insider' && !!ticker && (!imageUrl?.trim() || failed);

  if (showTickerHero && ticker) {
    return (
      <View
        style={[
          layout === 'circle' ? circleStyle(size) : styles.cardBg,
          layout === 'circle' ? styles.ring : null,
          layout === 'circle' ? { borderColor: tokens.colors.border.subtle } : null,
          styles.logoWrap,
          style,
        ]}
      >
        {layout === 'card' ? (
          <LinearGradient
            colors={['#0f160f', '#1a261a', '#0a0e0a']}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <TickerLogo
          symbol={ticker}
          size={layout === 'card' ? 72 : Math.round(size * 0.72)}
          borderRadius={layout === 'card' ? 14 : Math.round(size * 0.16)}
        />
        {children}
      </View>
    );
  }

  if (layout === 'circle') {
    return (
      <View
        style={[
          circleStyle(size),
          styles.ring,
          { borderColor: tokens.colors.border.subtle },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={[circleStyle(size), imageStyle]}
          onError={() => setFailed(true)}
          accessibilityLabel={name}
        />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri }}
      style={[styles.cardBg, style]}
      imageStyle={[styles.cardImage, imageStyle]}
      onError={() => setFailed(true)}
      accessibilityLabel={name}
    >
      <LinearGradient
        colors={['rgba(10,14,10,0.15)', 'rgba(10,14,10,0.55)', 'rgba(0,0,0,0.88)']}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </ImageBackground>
  );
}

export function InvestorPortrait({
  name,
  imageUrl,
  ticker,
  kind,
  personId,
  layout,
  size = 52,
  style,
  imageStyle,
  children,
}: Props) {
  const [failed, setFailed] = useState(false);
  const hasPhoto = !!imageUrl?.trim() && !failed;

  if (hasPhoto) {
    if (layout === 'circle') {
      return (
        <View style={[circleStyle(size), styles.ring, style]}>
          <Image
            source={{ uri: imageUrl! }}
            style={[circleStyle(size), imageStyle]}
            onError={() => setFailed(true)}
            accessibilityLabel={name}
          />
        </View>
      );
    }
    return (
      <ImageBackground
        source={{ uri: imageUrl! }}
        style={[styles.cardBg, style]}
        imageStyle={[styles.cardImage, imageStyle]}
        onError={() => setFailed(true)}
        accessibilityLabel={name}
      >
        {children}
      </ImageBackground>
    );
  }

  return (
    <InvestorPortraitFallback
      name={name}
      imageUrl={imageUrl}
      ticker={ticker}
      kind={kind}
      personId={personId}
      layout={layout}
      size={size}
      style={style}
      imageStyle={imageStyle}
    >
      {children}
    </InvestorPortraitFallback>
  );
}

const styles = StyleSheet.create({
  cardBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0f160f',
  },
  cardImage: {
    resizeMode: 'cover',
    opacity: 0.55,
  },
  ring: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#0f160f',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e0a',
  },
});

export { INVESTOR_PORTRAIT_PLACEHOLDER_URI };
