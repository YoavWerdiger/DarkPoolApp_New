import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import {
  portraitDisplayUrl,
  portraitPhotoCandidates,
} from '../utils/investorPlaceholder';

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

/**
 * אווטאר גיבור לפרופיל — עיגול אמיתי (גודל קבוע + borderRadius=size/2).
 * שכבה חיצונית = טבעת ירוקה; שכבה פנימית = clip לתמונה (overflow + borderRadius על Image).
 */
function ProfileHeroAvatarInner({
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

  const rawUri = candidates[0] ?? null;
  const activeUri = rawUri
    ? portraitDisplayUrl(rawUri, Math.max(256, size * 3)) ?? rawUri
    : null;

  const onPhotoError = useCallback((uri: string) => {
    setFailed((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  /** טבעת דקה — הגודל החיצוני קבוע; הפנים נחתכים בעיגול נפרד */
  const RING = 1.5;
  const OUTER = size;
  const INNER = Math.max(1, OUTER - RING * 2);
  const outerR = OUTER / 2;
  const innerR = INNER / 2;

  const ringStyle = useMemo(
    () => [
      {
        width: OUTER,
        height: OUTER,
        borderRadius: outerR,
        borderWidth: RING,
        borderColor: tokens.colors.border.divider,
        backgroundColor: tokens.colors.background.cardSolid,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      style,
    ],
    [OUTER, outerR, style, tokens.colors.background.cardSolid, tokens.colors.border.divider]
  );

  const clipStyle = useMemo(
    () => ({
      width: INNER,
      height: INNER,
      borderRadius: innerR,
      overflow: 'hidden' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: tokens.colors.background.navChrome,
    }),
    [INNER, innerR, tokens.colors.background.navChrome]
  );

  const imageStyle = useMemo(
    () => ({
      width: INNER,
      height: INNER,
      borderRadius: innerR,
    }),
    [INNER, innerR]
  );

  if (activeUri) {
    return (
      <View style={ringStyle}>
        <View style={clipStyle} collapsable={false}>
          <Image
            source={{ uri: activeUri }}
            style={imageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={personId || name || activeUri}
            priority="high"
            transition={0}
            onError={() => onPhotoError(rawUri!)}
            accessibilityLabel={name}
          />
        </View>
      </View>
    );
  }

  if (kind === 'insider' && ticker) {
    return (
      <View style={ringStyle}>
        <View style={clipStyle} collapsable={false}>
          <TickerLogo
            symbol={ticker}
            size={Math.round(INNER * 0.72)}
            borderRadius={Math.round(INNER * 0.16)}
          />
        </View>
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
      <View style={clipStyle} collapsable={false}>
        <LinearGradient
          colors={[
            tokens.colors.background.navChrome,
            tokens.colors.background.cardSolid,
            tokens.colors.background.primary,
          ]}
          style={[imageStyle, styles.iconBg]}
        >
          <Ionicons
            name={iconName}
            size={Math.round(INNER * 0.38)}
            color="rgba(255,255,255,0.55)"
          />
        </LinearGradient>
      </View>
    </View>
  );
}

export const ProfileHeroAvatar = memo(ProfileHeroAvatarInner);

const styles = StyleSheet.create({
  iconBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
