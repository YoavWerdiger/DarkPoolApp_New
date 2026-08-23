import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  INVESTOR_PORTRAIT_PLACEHOLDER_URI,
  portraitPhotoCandidates,
} from '../utils/investorPlaceholder';

/** פולבק בלי תמונה — מונוגרם ראשי־תיבות בלבד (לא לוגו מניה). */

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function monogramColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const palette = ['#1B4332', '#2D6A4F', '#1D3557', '#457B9D', '#3D348B', '#5C4D7A'];
  return palette[Math.abs(hash) % palette.length];
}

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
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const candidates = useMemo(
    () =>
      portraitPhotoCandidates({
        imageUrl,
        kind,
        personId,
        name,
      }).filter((u) => !failed.has(u) && !u.includes('transback.png')),
    [imageUrl, kind, personId, name, failed]
  );

  const uri = candidates[0] ?? null;
  const initials = initialsFromName(name);
  const monoBg = monogramColor(personId || name || ticker || 'x');

  if (layout === 'circle') {
    if (!uri) {
      return (
        <View
          style={[
            circleStyle(size),
            styles.ring,
            styles.mono,
            { borderColor: tokens.colors.border.subtle, backgroundColor: monoBg },
            style,
          ]}
          accessibilityLabel={name}
        >
          <Text style={[styles.monoText, { fontSize: Math.round(size * 0.34) }]}>
            {initials}
          </Text>
        </View>
      );
    }
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
          onError={() =>
            setFailed((prev) => {
              const next = new Set(prev);
              next.add(uri);
              return next;
            })
          }
          accessibilityLabel={name}
        />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[styles.cardBg, style]}>
        <LinearGradient
          colors={[monoBg, '#0a0e0a']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.cardMonoCenter}>
          <View
            style={[
              styles.cardMonoCircle,
              { backgroundColor: `${tokens.colors.primary.main}33` },
            ]}
          >
            <Text style={styles.cardMonoText}>{initials}</Text>
          </View>
        </View>
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri }}
      style={[styles.cardBg, style]}
      imageStyle={[styles.cardImage, imageStyle]}
      onError={() =>
        setFailed((prev) => {
          const next = new Set(prev);
          next.add(uri);
          return next;
        })
      }
      accessibilityLabel={name}
    >
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
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const candidates = useMemo(
    () =>
      portraitPhotoCandidates({
        imageUrl,
        kind,
        personId,
        name,
      }).filter((u) => !failed.has(u) && !u.includes('transback.png')),
    [imageUrl, kind, personId, name, failed]
  );

  const uri = candidates[0] ?? null;

  if (uri) {
    if (layout === 'circle') {
      return (
        <View style={[circleStyle(size), styles.ring, style]}>
          <Image
            source={{ uri }}
            style={[circleStyle(size), imageStyle]}
            onError={() =>
              setFailed((prev) => {
                const next = new Set(prev);
                next.add(uri);
                return next;
              })
            }
            accessibilityLabel={name}
          />
        </View>
      );
    }
    return (
      <ImageBackground
        source={{ uri }}
        style={[styles.cardBg, style]}
        imageStyle={[styles.cardImageFull, imageStyle]}
        onError={() =>
          setFailed((prev) => {
            const next = new Set(prev);
            next.add(uri);
            return next;
          })
        }
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
  cardImageFull: {
    resizeMode: 'cover',
  },
  ring: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#0f160f',
  },
  mono: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: {
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardMonoCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  cardMonoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMonoText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export { INVESTOR_PORTRAIT_PLACEHOLDER_URI };
