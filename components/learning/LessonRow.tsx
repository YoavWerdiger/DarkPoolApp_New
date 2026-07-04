import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LessonWithProgress, Enrollment, BlockType } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { CheckCircle2 } from 'lucide-react-native';
import { mediaService } from '../../services/mediaService';
import { useTheme } from '../../context/ThemeContext';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { academyCardFrameStyle } from './academyCardLayout';

interface LessonRowProps {
  lesson: LessonWithProgress;
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
  index = 0
}) => {
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const isEnrolled = !!enrollment;
  const hasAccess = isEnrolled || lesson.is_preview;
  const isLockedForUser = isLocked || (!hasAccess);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<string | null>(null);

  useEffect(() => {
    const loadMedia = async () => {
      if (!courseId) return;
      try {
        const media = await mediaService.getLessonMedia(courseId, lesson.id);
        if (media) {
          // Thumbnail
          if (media.thumbnail_url) {
            setThumbnailUrl(media.thumbnail_url);
          } else if (media.youtube_id) {
            setThumbnailUrl(`https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg`);
          } else if (media.vimeo_id) {
            setThumbnailUrl(`https://vumbnail.com/${media.vimeo_id}.jpg`);
          }
          // Duration fallback from media record
          if (media.duration_minutes && media.duration_minutes > 0) {
            const m = media.duration_minutes;
            const h = Math.floor(m / 60);
            const mins = m % 60;
            setMediaDuration(h > 0 ? `${h}:${mins.toString().padStart(2,'0')}:00` : `${mins}:00`);
          }
        }
      } catch {
      }
    };
    loadMedia();
  }, [courseId, lesson.id]);

  // lesson.duration comes from learningService (duration_minutes → MM:SS).
  // If it's '00:00' or missing, use media duration fetched directly.
  const lessonDur = (lesson as any).duration;
  const displayDuration = (lessonDur && lessonDur !== '00:00') ? lessonDur : (mediaDuration || '00:00');
  
  const isCompleted = lesson.progress?.status === 'completed';

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      marginBottom: DesignTokens.spacing.lg,
      overflow: 'hidden',
    },
    lockedContainer: {
      opacity: 0.6,
    },
    lessonThumbnail: {
      position: 'relative',
      height: 132,
      backgroundColor: '#000000',
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    thumbnailPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    thumbnailPlaceholderText: {
      color: DesignTokens.colors.text.primary,
      fontSize: 24,
    },
    lessonNumberOnThumb: {
      position: 'absolute',
      top: DesignTokens.spacing.md,
      left: DesignTokens.spacing.md,
      zIndex: 2,
      minWidth: 30,
      height: 28,
      paddingHorizontal: DesignTokens.spacing.sm,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...DesignTokens.shadows.xs,
    },
    lessonNumberOnThumbText: {
      color: DesignTokens.colors.text.inverse,
      fontWeight: '800',
      fontSize: 14,
      lineHeight: 17,
    },
    durationBadge: {
      position: 'absolute',
      bottom: DesignTokens.spacing.md,
      right: DesignTokens.spacing.md,
      paddingHorizontal: DesignTokens.spacing.sm,
      paddingVertical: DesignTokens.spacing.xs,
      borderRadius: DesignTokens.borderRadius.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    durationText: {
      fontSize: 12,
      fontWeight: '600',
    },
    completedBadge: {
      position: 'absolute',
      top: DesignTokens.spacing.md,
      right: DesignTokens.spacing.md,
      borderRadius: DesignTokens.borderRadius.md,
      padding: DesignTokens.spacing.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    lessonContent: {
      paddingHorizontal: DesignTokens.spacing.lg,
      paddingTop: DesignTokens.spacing.lg,
      paddingBottom: DesignTokens.spacing.lg,
      width: '100%',
    },
    lessonCardTextCol: {
      width: '100%',
      alignItems: 'stretch',
    },
    lessonCardTitle: {
      fontSize: DesignTokens.typography.titleXs.size,
      fontWeight: '600',
      color: DesignTokens.colors.text.primary,
      textAlign: 'right',
      letterSpacing: 0.15,
      lineHeight: Math.round(DesignTokens.typography.titleXs.size * 1.35),
      writingDirection: 'rtl',
    },
    lockedText: {
      color: DesignTokens.colors.text.tertiary,
    },
    lessonDescription: {
      marginTop: DesignTokens.spacing.xs,
      fontSize: DesignTokens.typography.bodySmall.size,
      color: DesignTokens.colors.text.secondary,
      lineHeight: Math.round(DesignTokens.typography.bodySmall.size * 1.45),
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  }), [DesignTokens]);

  return (
    <TouchableOpacity
      style={isLockedForUser ? styles.lockedContainer : undefined}
      onPress={() => {
        if (isLockedForUser) return;
        void HapticFeedback.impactLight();
        onPress(lesson);
      }}
      activeOpacity={isLockedForUser ? 1 : 0.8}
      disabled={isLockedForUser}
    >
      <UICard
        variant="blur"
        padding="none"
        showGlassBorder={false}
        style={[styles.container, academyCardFrameStyle('neutral')]}
      >
      {/* Thumbnail */}
      <View style={styles.lessonThumbnail}>
        {thumbnailUrl ? (
          <Image 
            source={{ uri: thumbnailUrl }} 
            style={styles.thumbnailImage}
            resizeMode="cover"
            onError={() => {
              setThumbnailUrl(null);
            }}
          />
        ) : (
          <View style={[styles.thumbnailImage, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>🎥</Text>
          </View>
        )}
        <View style={styles.lessonNumberOnThumb} accessibilityLabel={`שיעור ${index + 1}`}>
          <Text style={styles.lessonNumberOnThumbText}>{index + 1}</Text>
        </View>
        <View style={[
          styles.durationBadge,
          {
            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : '#FFFFFF',
          }
        ]}>
          <Text style={[
            styles.durationText,
            {
              color: isDarkMode ? '#FFFFFF' : '#000000',
            }
          ]}>{displayDuration}</Text>
        </View>
        {isCompleted && (
          <View style={[
            styles.completedBadge,
            {
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : '#FFFFFF',
            }
          ]}>
            <CheckCircle2 size={24} color="#00C805" strokeWidth={2} />
          </View>
        )}
      </View>
      
      {/* Content */}
      <View style={styles.lessonContent}>
        <View style={styles.lessonCardTextCol}>
          <Text
            style={[styles.lessonCardTitle, isLockedForUser && styles.lockedText]}
            numberOfLines={2}
          >
            {lesson.title}
          </Text>
          {lesson.description ? (
            <Text style={styles.lessonDescription} numberOfLines={2}>
              {lesson.description}
            </Text>
          ) : null}
        </View>
      </View>
      </UICard>
    </TouchableOpacity>
  );
};

