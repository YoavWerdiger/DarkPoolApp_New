import React, { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { portraitPhotoCandidates } from '../utils/investorPlaceholder';

interface Props {
  name: string;
  imageUrl?: string | null;
  /** תמונה מהניווט — מוצגת מיד לפני שהפרופיל נטען */
  imageHint?: string | null;
  ticker?: string;
  kind: 'politician' | 'insider' | 'fund_manager';
  personId?: string;
  bioguideId?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function circle(n: number) {
  return { width: n, height: n, borderRadius: n / 2 };
}

/**
 * אווטאר גיבור לפרופיל — תמונה אמיתית, לוגו טיקר לבכירים, אייקון לקרנות.
 * לא משתמש ב-transback חתוך (נראה שבור באווטאר עגול).
 */
export function ProfileHeroAvatar({
  name,
  imageUrl,
  imageHint,
  ticker,
  kind,
  personId,
  bioguideId,
  size = 96,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const candidates = useMemo(
    () =>
      portraitPhotoCandidates({
        imageUrl,
        imageHint,
        kind,
        personId,
        bioguideId,
        name,
      }).filter((uri) => !failed.has(uri)),
    [imageUrl, imageHint, kind, personId, bioguideId, name, failed]
  );

  const activeUri = candidates[0] ?? null;

  const onPhotoError = useCallback((uri: string) => {
    setFailed((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const ringStyle = useMemo(
    () => [
      circle(size),
      styles.ring,
      {
        borderColor: tokens.colors.primary.main,
        borderWidth: 2,
      },
      style,
    ],
    [size, style, tokens.colors.primary.main]
  );

  if (activeUri) {
    return (
      <View style={ringStyle}>
        <Image
          source={{ uri: activeUri }}
          style={circle(size)}
          resizeMode="cover"
          onError={() => onPhotoError(activeUri)}
          accessibilityLabel={name}
        />
      </View>
    );
  }

  if (kind === 'insider' && ticker) {
    return (
      <View style={[ringStyle, styles.logoWrap]}>
        <TickerLogo
          symbol={ticker}
          size={Math.round(size * 0.72)}
          borderRadius={Math.round(size * 0.16)}
        />
      </View>
    );
  }

  const iconName =
    kind === 'fund_manager'
      ? 'briefcase'
      : kind === 'politician'
        ? 'person'
        : 'person-circle';

  return (
    <View style={ringStyle}>
      <LinearGradient
        colors={['#1a261a', '#0f160f', '#0a0e0a']}
        style={[circle(size), styles.iconBg]}
      >
        <Ionicons
          name={iconName}
          size={Math.round(size * 0.38)}
          color="rgba(255,255,255,0.55)"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: '#0f160f',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e0a',
  },
  iconBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
