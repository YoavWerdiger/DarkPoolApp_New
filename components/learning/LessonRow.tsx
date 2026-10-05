import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LessonWithProgress, Enrollment } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
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

interface LessonRowProps {
  lesson: LessonWithProgress & { completed?: boolean; thumbnail?: string | null };
  onPress: (lesson: LessonWithProgress) => void;
  enrollment?: Enrollment;
  isLocked?: boolean;
  courseId?: string;
  index?: number;
}

export const LessonRow: React.FC<LessonRowProps> = ({
  lesson,
  onPress,
  enrollment,
  isLocked = false,
  courseId,
  index = 0,
}) => {
  const T = useDesignTokens();
  const styles = useMemo(() => createStyles(T), [T]);

  /** נעילה רק כשההורה מבקש (CourseDetail) — לא לפי enrollment פנימי. */
  const isLockedForUser = isLocked;
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
        if (media.duration_minutes && media.duration_minutes > 0) {
          const m = media.duration_minutes;
          const h = Math.floor(m / 60);
          const mins = m % 60;
          setMediaDuration(h > 0 ? `${h}:${mins.toString().padStart(2, '0')}:00` : `${mins}:00`);
        }
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

  return (
    <UICard variant="soft" disableBlur padding="none" style={styles.card}>
      <TouchableOpacity
        style={styles.touchable}
        activeOpacity={isLockedForUser ? 1 : 0.88}
        disabled={isLockedForUser}
        onPress={() => {
          void HapticFeedback.impactLight();
          onPress(lesson);
        }}
        accessibilityRole="button"
        accessibilityLabel={`שיעור ${index + 1}: ${lesson.title}`}
      >
        <View style={styles.thumbWrap}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
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
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={styles.durationText}>{displayDuration}</Text>
            </View>
          ) : null}

          {isCompleted ? (
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
                <Ionicons name="play" size={18} color="#fff" style={styles.playIcon} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Text style={styles.indexLabel}>שיעור {index + 1}</Text>
            <Text
              style={[
                appCardTitleStyle,
                styles.title,
                isLockedForUser && styles.titleLocked,
              ]}
              numberOfLines={2}
            >
              {lesson.title}
            </Text>

            {description ? (
              <Text
                style={[
                  appCardBodyStyle,
                  styles.description,
                  isLockedForUser && styles.descriptionLocked,
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

function createStyles(T: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      borderRadius: ACADEMY_CARD_RADIUS,
      overflow: 'hidden',
      marginBottom: APP_LAYOUT.cardStackGap,
      direction: 'ltr',
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
    playCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
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
      marginTop: 0,
      color: T.colors.text.secondary,
    },
    title: {
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      color: T.colors.text.primary,
    },
    titleLocked: {
      color: T.colors.text.tertiary,
    },
    description: {
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      color: T.colors.text.secondary,
    },
    descriptionLocked: {
      color: T.colors.text.tertiary,
    },
  });
}
