import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  DayNavBlurButton,
  DRAWER_MENU_BUTTON_SIZE,
} from '../../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { ltrNameText } from '../utils/bidi';
import { portraitDisplayUrl } from '../utils/investorPlaceholder';

const HERO_ICON_SIZE = DRAWER_MENU_BUTTON_SIZE;
const HERO_ICON_GLYPH = 22;
const HERO_ACTION_GAP = 14;
const HERO_BAR_HP = 16;
interface Props {
  name: string;
  photoCandidates: string[];
  height: number;
  topInset: number;
  onBack: () => void;
  onBell: () => void;
  onShare: () => void;
  isFollowing: boolean;
  followBusy?: boolean;
  bellA11yLabel: string;
  shareA11yLabel: string;
  /** contentOffset.y של ה-ScrollView — overscroll (y < 0) עושה pull-to-zoom. */
  scrollY?: Animated.Value;
  /**
   * שכבת תמונה מוצמדת מתחת ל-ScrollView (Android / RefreshControl).
   * scale בלבד ב-overscroll; בגלילה למטה עוקבת אחרי התוכן.
   */
  pinned?: boolean;
  /** בלי כפתורים/שם — רק התמונה (backdrop). */
  photoOnly?: boolean;
  /**
   * מעטפת ScrollView מעל backdrop מוצמד:
   * בלי תמונה כפולה — הכרום צף מעל התמונה שנשארת מאחור.
   */
  hidePhoto?: boolean;
}

/**
 * מעטפת InsiderWave: תמונת full-bleed, כפתורי אייקון עגולים קטנים, שם על הגרדיאנט.
 */
function PersonProfileHeroInner({
  name,
  photoCandidates,
  height,
  topInset,
  onBack,
  onBell,
  onShare,
  isFollowing,
  followBusy,
  bellA11yLabel,
  shareA11yLabel,
  scrollY,
  pinned = false,
  photoOnly = false,
  hidePhoto = false,
}: Props) {
  const tokens = useDesignTokens();
  const iconColor = tokens.colors.text.primary;
  const { width: photoWidth } = useWindowDimensions();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const candidates = useMemo(
    () => photoCandidates.filter((uri) => !failed.has(uri)),
    [photoCandidates, failed]
  );
  const rawUri = candidates[0] ?? null;
  const activeUri = rawUri ? portraitDisplayUrl(rawUri, 960) ?? rawUri : null;

  const onPhotoError = useCallback((uri: string) => {
    setFailed((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const photoZoomStyle = useMemo(() => {
    if (!scrollY || !(height > 0) || hidePhoto) return null;
    const scale = scrollY.interpolate({
      inputRange: [-height, 0],
      outputRange: [2, 1],
      extrapolateLeft: 'extend',
      extrapolateRight: 'clamp',
    });
    // scale ממרכז → מזיזים למטה ב-(scale-1)*h/2 כדי לגדול מלמעלה.
    const originFix = scrollY.interpolate({
      inputRange: [-height, 0],
      outputRange: [height / 2, 0],
      extrapolateLeft: 'extend',
      extrapolateRight: 'clamp',
    });
    if (!pinned) {
      return { transform: [{ translateY: originFix }, { scale }] };
    }
    const followY = scrollY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -1],
      extrapolateLeft: 'clamp',
    });
    return {
      transform: [{ translateY: followY }, { translateY: originFix }, { scale }],
    };
  }, [scrollY, height, pinned, hidePhoto]);

  const photo = hidePhoto ? null : (
    <Animated.View
      style={[styles.photoLayer, { width: photoWidth, height }, photoZoomStyle]}
      pointerEvents="none"
    >
      {activeUri ? (
        <Image
          source={{ uri: activeUri }}
          style={{ width: photoWidth, height }}
          contentFit="cover"
          contentPosition="top"
          cachePolicy="memory-disk"
          recyclingKey={name || activeUri}
          priority="high"
          transition={0}
          onError={() => onPhotoError(rawUri!)}
          accessibilityLabel={name}
        />
      ) : (
        <LinearGradient
          colors={['rgba(26,38,26,0.55)', 'rgba(15,22,15,0.28)', 'transparent']}
          style={{ width: photoWidth, height }}
        />
      )}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.42)',
          'transparent',
          'rgba(0,0,0,0.12)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.92)',
        ]}
        locations={[0, 0.28, 0.52, 0.78, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </Animated.View>
  );

  if (photoOnly) {
    return (
      <View
        collapsable={false}
        pointerEvents="none"
        style={[styles.root, { height }]}
      >
        {photo}
      </View>
    );
  }

  return (
    <View
      collapsable={false}
      pointerEvents={hidePhoto ? 'box-none' : 'auto'}
      style={[styles.root, { height }]}
    >
      {photo}

      <View style={[styles.topBar, { paddingTop: Math.max(topInset, 8) + 6 }]}>
        <DayNavBlurButton
          size={HERO_ICON_SIZE}
          glassIntensity="subtle"
          onPress={onBack}
          accessibilityLabel="חזרה"
        >
          <Ionicons
            name="chevron-forward"
            size={HERO_ICON_GLYPH}
            color={iconColor}
            style={styles.iconMark}
          />
        </DayNavBlurButton>
        <View style={styles.actions}>
          <DayNavBlurButton
            size={HERO_ICON_SIZE}
            glassIntensity="subtle"
            onPress={onBell}
            accessibilityLabel={bellA11yLabel}
            disabled={followBusy}
          >
            {followBusy ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <Ionicons
                name={isFollowing ? 'notifications' : 'notifications-outline'}
                size={HERO_ICON_GLYPH}
                color={iconColor}
                style={styles.iconMark}
              />
            )}
          </DayNavBlurButton>
          <DayNavBlurButton
            size={HERO_ICON_SIZE}
            glassIntensity="subtle"
            onPress={onShare}
            accessibilityLabel={shareA11yLabel}
          >
            <Ionicons
              name="share-outline"
              size={HERO_ICON_GLYPH}
              color={iconColor}
              style={styles.iconMark}
            />
          </DayNavBlurButton>
        </View>
      </View>

      <View style={styles.nameWrap} pointerEvents="none">
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </View>
  );
}

export const PersonProfileHero = memo(PersonProfileHeroInner);

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  photoLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  topBar: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HERO_BAR_HP,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HERO_ACTION_GAP,
  },
  iconMark: {
    width: HERO_ICON_GLYPH,
    height: HERO_ICON_GLYPH,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: HERO_ICON_GLYPH,
  },
  nameWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  name: {
    ...ltrNameText,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    alignSelf: 'stretch',
  },
});
