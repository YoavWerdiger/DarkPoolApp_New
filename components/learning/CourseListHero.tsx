import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';
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
  /** לא בשימוש — גובה התמונה נגזר מהיחס שלה (נשמר לתאימות) */
  height?: number;
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
  topInset,
  onBack,
  progressLabel,
  progressPct,
  progressLoading = false,
}: CourseListHeroProps) {
  const T = useDesignTokens();
  const progressStyles = useMemo(() => createProgressStyles(T), [T]);

  // יחס הבאנר מהקובץ עצמו (ברירת מחדל 16:9): התמונה ברוחב המסך, כולה גלויה, בלי טקסט מעליה
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    if (!coverUrl) return;
    let alive = true;
    RNImage.getSize(
      coverUrl,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [coverUrl]);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={[styles.media, { aspectRatio: ratio }]}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
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

        <View style={styles.topBar}>
          <DayNavBlurButton
            onPress={onBack}
            size={HERO_BACK_BTN_SIZE}
            glassIntensity="light"
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={T.colors.text.primary} />
          </DayNavBlurButton>
        </View>
      </View>

      <View style={styles.bottomWrap} pointerEvents="none">
        <Text style={[styles.title, { color: T.colors.text.primary }]} numberOfLines={3}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: T.colors.text.secondary }]} numberOfLines={2}>
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
      color: T.colors.text.secondary,
      writingDirection: 'rtl',
    },
    pct: {
      ...ACADEMY_TYPE.caption,
      color: T.colors.text.primary,
    },
    barTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: T.colors.background.tertiary,
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
  },
  media: {
    width: '100%',
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  bottomWrap: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.cardPadding,
    gap: 4,
  },
  title: {
    ...ACADEMY_TYPE.pageTitle,
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
  },
  subtitle: {
    ...ACADEMY_TYPE.sectionSubtitle,
    marginTop: APP_LAYOUT.titleSubtitleGap,
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
  },
});
