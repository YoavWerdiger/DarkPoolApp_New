import { ROOT_DIR } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LessonWithProgress, Enrollment } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { SkeletonBox, SkeletonLine } from '../ui/SkeletonLoader';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ACADEMY_CARD_RADIUS } from './academyCardLayout';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  appCardBodyStyle,
  appCardSubtitleStyle,
  appCardTitleStyle,
} from '../ui/appType';
import { ACADEMY_TYPE } from './academyLayout';
import { formatLessonMinutes } from './academyCourses';

interface LessonRowProps {
  lesson: LessonWithProgress & { completed?: boolean; thumbnail?: string | null };
  onPress: (lesson: LessonWithProgress) => void;
  enrollment?: Enrollment;
  isLocked?: boolean;
  courseId?: string;
  index?: number;
  /** באנר לשיעור בלי תמונה משלו (למשל «בקרוב») — תמונת הקורס */
  fallbackImage?: string | null;
}

export const LessonRow: React.FC<LessonRowProps> = ({
  lesson,
  onPress,
  enrollment,
  isLocked = false,
  courseId,
  index = 0,
  fallbackImage,
}) => {
  const T = useDesignTokens();
  const styles = useMemo(() => createStyles(T), [T]);

  /** נעילה רק כשההורה מבקש (CourseDetail) — לא לפי enrollment פנימי. */
  const isLockedForUser = isLocked;
  /** שיעור שעוד אין לו וידאו — «בקרוב», לא נלחץ */
  const isComingSoon = (lesson as { comingSoon?: boolean }).comingSoon === true;
  const isDisabled = isLockedForUser || isComingSoon;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(lesson.thumbnail ?? null);
  const [mediaDuration, setMediaDuration] = useState<string | null>(null);

  useEffect(() => {
    if (lesson.thumbnail) {
      setThumbnailUrl(lesson.thumbnail);
      return;
    }
    const loadMedia = async () => {
      if (!courseId) return;
      try {
        const media = await mediaService.getLessonMedia(courseId, lesson.id);
        if (!media) return;
        if (media.thumbnail_url) {
          setThumbnailUrl(media.thumbnail_url);
        } else if (media.youtube_id) {
          setThumbnailUrl(`https://img.youtube.com/vi/${media.youtube_id}/mqdefault.jpg`);
        } else if (media.vimeo_id) {
          setThumbnailUrl(`https://vumbnail.com/${media.vimeo_id}.jpg`);
        }
        const minutesLabel = formatLessonMinutes(media.duration_minutes);
        if (minutesLabel) setMediaDuration(minutesLabel);
      } catch {
        /* noop */
      }
    };
    void loadMedia();
  }, [courseId, lesson.id, lesson.thumbnail]);

  const lessonDur = (lesson as { duration?: string }).duration;
  const displayDuration =
    lessonDur && lessonDur !== '00:00' ? lessonDur : mediaDuration || null;

  const isCompleted =
    lesson.completed === true || lesson.progress?.status === 'completed';

  const description = lesson.description?.trim() || null;

  // התקדמות בשיעור: הושלם = 100; במסך הלווייתנים progress הוא אחוז צפייה (מספר)
  const rawProgress = (lesson as { progress?: unknown }).progress;
  const progressPct = isCompleted
    ? 100
    : typeof rawProgress === 'number'
      ? Math.min(100, Math.max(0, rawProgress))
      : 0;

  return (
    <UICard variant="soft" disableBlur padding="none" style={styles.card}>
      <TouchableOpacity
        style={styles.touchable}
        activeOpacity={isDisabled ? 1 : 0.88}
        disabled={isDisabled}
        onPress={() => {
          void HapticFeedback.impactLight();
          onPress(lesson);
        }}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('auto.components__learning__LessonRow.s1', { v0: index + 1, v1: lesson.title })}
      >
        <View style={styles.thumbWrap}>
          {thumbnailUrl || fallbackImage ? (
            <Image
              source={{ uri: (thumbnailUrl || fallbackImage) as string }}
              style={styles.thumbImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={lesson.id}
              transition={120}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="play-circle-outline" size={40} color={T.colors.text.tertiary} />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {displayDuration ? (
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{displayDuration}</Text>
            </View>
          ) : null}

          {isComingSoon ? (
            <View style={styles.lockOverlay}>
              <View style={styles.soonPill}>
                <Text style={styles.soonText}>{i18n.t('auto.components__learning__LessonRow.s2')}</Text>
              </View>
            </View>
          ) : isCompleted ? (
            <View style={styles.donePill}>
              <Ionicons name="checkmark-circle" size={18} color={T.colors.primary.main} />
            </View>
          ) : isLockedForUser ? (
            <View style={styles.lockOverlay}>
              <View style={styles.lockCircle}>
                <Ionicons name="lock-closed" size={18} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.playOverlay} pointerEvents="none">
              <View style={styles.playCircle}>
                <Ionicons name="play" size={20} color={T.colors.text.primary} style={styles.playIcon} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            {/* טופו: כותרת הכרטיס ואז תת־כותרת אפורה צמודה (שיעור N; המשך על התמונה) */}
            <Text
              style={[
                appCardTitleStyle,
                styles.title,
                isDisabled && styles.titleLocked,
              ]}
              numberOfLines={2}
            >
              {lesson.title}
            </Text>
            <Text style={styles.indexLabel} numberOfLines={1}>
              {i18n.t('auto.components__learning__LessonRow.s3')} {index + 1}
              {isComingSoon ? i18n.t('auto.components__learning__LessonRow.s4') : ''}
            </Text>

            {/* פס התקדמות מתחת למספר השיעור — כמו בכרטיסי הקורסים */}
            {!isComingSoon ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPct}%`, backgroundColor: T.colors.primary.main },
                  ]}
                />
              </View>
            ) : null}

            {description ? (
              <Text
                style={[
                  appCardBodyStyle,
                  styles.description,
                  isDisabled && styles.descriptionLocked,
                ]}
                numberOfLines={3}
              >
                {description}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </UICard>
  );
};

const THUMB_HEIGHT = 136;

/**
 * כרטיס שיעור בטעינה — אותו כרטיס, אותו גובה תמונה ואותן שורות כמו LessonRow:
 * «שיעור N» ופס ההתקדמות קבועים; רק התמונה והכותרת הן צורות טעינה.
 */
export function LessonRowSkeleton({ index }: { index: number }) {
  const T = useDesignTokens();
  const styles = useMemo(() => createStyles(T), [T]);
  return (
    <UICard variant="soft" disableBlur padding="none" style={styles.card}>
      <View pointerEvents="none">
        <SkeletonBox width="100%" height={THUMB_HEIGHT} borderRadius={0} />
        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <SkeletonLine lineHeight={appCardTitleStyle.lineHeight as number} width="70%" box={15} align="flex-end" />
            <Text style={styles.indexLabel} numberOfLines={1}>
              {i18n.t('auto.components__learning__LessonRow.s3')} {index + 1}
            </Text>
            <View style={styles.progressTrack} />
          </View>
        </View>
      </View>
    </UICard>
  );
}

function createStyles(T: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      borderRadius: ACADEMY_CARD_RADIUS,
      overflow: 'hidden',
      marginBottom: APP_LAYOUT.cardStackGap,
      direction: ROOT_DIR,
    },
    touchable: {
      width: '100%',
    },
    thumbWrap: {
      width: '100%',
      height: THUMB_HEIGHT,
      backgroundColor: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
      position: 'relative',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    thumbPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durationPill: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    durationText: {
      ...ACADEMY_TYPE.cardSubtitle,
      color: '#fff',
    },
    donePill: {
      position: 'absolute',
      top: 10,
      left: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    playOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // כמו כפתורי הכרום באפליקציה: עיגול cardSolid, אייקון בצבע הטקסט, בלי מסגרת
    playCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: T.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    playIcon: {
      marginLeft: 2,
    },
    lockOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    soonPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    soonText: {
      ...ACADEMY_TYPE.cardSubtitle,
      color: '#fff',
    },
    lockCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingTop: APP_LAYOUT.cardPadding,
      paddingBottom: APP_LAYOUT.cardPadding,
      alignItems: 'stretch',
      width: '100%',
    },
    titleBlock: {
      width: '100%',
      alignItems: 'stretch',
    },
    indexLabel: {
      ...appCardSubtitleStyle,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      color: T.colors.text.secondary,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: T.colors.border.divider,
      overflow: 'hidden',
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      alignSelf: 'flex-end',
    },
    title: {
      marginTop: 0,
      color: T.colors.text.primary,
    },
    titleLocked: {
      color: T.colors.text.tertiary,
    },
    description: {
      marginTop: APP_LAYOUT.stackGapSmall,
      color: T.colors.text.secondary,
    },
    descriptionLocked: {
      color: T.colors.text.tertiary,
    },
  });
}
