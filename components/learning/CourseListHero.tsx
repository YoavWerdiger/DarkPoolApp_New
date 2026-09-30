import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DayNavBlurButton } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { ACADEMY_TYPE } from './academyLayout';

/** כמו PersonProfileHero — עיגול 44pt */
const HERO_BACK_BTN_SIZE = 44;

export type CourseListHeroProps = {
  coverUrl?: string | null;
  title: string;
  subtitle?: string;
  height: number;
  topInset: number;
  onBack: () => void;
  progressLabel: string;
  progressPct: number;
  progressLoading?: boolean;
};

function CourseListHeroInner({
  coverUrl,
  title,
  subtitle,
  height,
  topInset,
  onBack,
  progressLabel,
  progressPct,
  progressLoading = false,
}: CourseListHeroProps) {
  const T = useDesignTokens();
  const progressStyles = useMemo(() => createProgressStyles(T), [T]);

  return (
    <View style={[styles.root, { height }]}>
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          cachePolicy="memory-disk"
          recyclingKey={coverUrl}
          priority="high"
          transition={120}
          accessibilityLabel={title}
        />
      ) : (
        <LinearGradient
          colors={['rgba(26,38,26,0.55)', 'rgba(15,22,15,0.28)', 'rgba(8,12,8,0.92)']}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.35)',
          'transparent',
          'rgba(0,0,0,0.35)',
          'rgba(0,0,0,0.72)',
          'transparent',
        ]}
        locations={[0, 0.22, 0.58, 0.86, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: Math.max(topInset, 8) + 6 }]}>
        <DayNavBlurButton
          onPress={onBack}
          size={HERO_BACK_BTN_SIZE}
          glassIntensity="light"
          accessibilityLabel="חזרה"
        >
          <Ionicons name="chevron-forward" size={22} color={T.colors.text.primary} />
        </DayNavBlurButton>
      </View>

      <View style={styles.bottomWrap} pointerEvents="none">
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        <View style={progressStyles.block}>
          {progressLoading ? (
            <View style={progressStyles.barTrack}>
              <View style={[progressStyles.barFill, { width: '0%' }]} />
            </View>
          ) : (
            <>
              <View style={progressStyles.row}>
                <Text style={progressStyles.label}>{progressLabel}</Text>
                <Text style={progressStyles.pct}>{progressPct}%</Text>
              </View>
              <View style={progressStyles.barTrack}>
                <View
                  style={[
                    progressStyles.barFill,
                    {
                      width: `${Math.min(100, Math.max(0, progressPct))}%`,
                      minWidth: progressPct > 0 ? 4 : 0,
                    },
                  ]}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export const CourseListHero = memo(CourseListHeroInner);

function createProgressStyles(T: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    block: {
      width: '100%',
      marginTop: T.spacing.sm,
      gap: T.spacing.xs,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    label: {
      ...ACADEMY_TYPE.caption,
      color: 'rgba(255,255,255,0.88)',
      writingDirection: 'rtl',
    },
    pct: {
      ...ACADEMY_TYPE.caption,
      color: '#FFFFFF',
    },
    barTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: T.colors.primary.main,
    },
  });
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  topBar: {
    direction: 'rtl',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingBottom: APP_LAYOUT.screenPaddingHorizontal,
    gap: 4,
  },
  title: {
    ...ACADEMY_TYPE.pageTitle,
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...ACADEMY_TYPE.sectionSubtitle,
    marginTop: APP_LAYOUT.titleSubtitleGap,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
  },
});
