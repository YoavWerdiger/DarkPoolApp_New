import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LessonWithProgress, Enrollment, BlockType } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import { CheckCircle2 } from 'lucide-react-native';
import { mediaService } from '../../services/mediaService';
import { useTheme } from '../../context/ThemeContext';

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

  useEffect(() => {
    const loadMedia = async () => {
      if (!courseId) return;
      
      try {
        const media = await mediaService.getLessonMedia(courseId, lesson.id);
        if (media) {
          if (media.thumbnail_url) {
            setThumbnailUrl(media.thumbnail_url);
          } else if (media.youtube_id) {
            setThumbnailUrl(`https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg`);
          } else if (media.vimeo_id) {
            setThumbnailUrl(`https://vumbnail.com/${media.vimeo_id}.jpg`);
          }
        }
      } catch {
      }
    };

    loadMedia();
  }, [courseId, lesson.id]);

  // משתמשים ישירות ב-lesson.duration שנשלף מ-fetchCourse מהמסד הנתונים
  // הקוד ב-learningService.ts כבר ממיר את duration_minutes ל-duration בפורמט MM:SS או HH:MM:SS
  const displayDuration = (lesson as any).duration || '00:00';
  
  const isCompleted = lesson.progress?.status === 'completed';

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: DesignTokens.colors.background.secondary,
      borderRadius: DesignTokens.borderRadius.lg,
      marginBottom: 16,
      overflow: 'hidden',
    },
    lockedContainer: {
      opacity: 0.6,
    },
    lessonThumbnail: {
      position: 'relative',
      height: 120,
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
    durationBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
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
      top: 8,
      left: 8,
      borderRadius: 12,
      padding: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    lessonContent: {
      flex: 1,
      padding: 16,
    },
    lessonCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    lessonCardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: DesignTokens.colors.text.primary,
      textAlign: 'right',
      letterSpacing: 0.2,
      marginRight: 12,
    },
    lockedText: {
      color: DesignTokens.colors.text.tertiary,
    },
    lessonNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lessonNumberText: {
      color: DesignTokens.colors.background.primary,
      fontWeight: '600',
      fontSize: 14,
    },
    lessonDescription: {
      fontSize: 14,
      color: DesignTokens.colors.text.tertiary,
      lineHeight: 20,
      textAlign: 'right',
    },
  }), [DesignTokens]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isLockedForUser && styles.lockedContainer
      ]}
      onPress={() => !isLockedForUser && onPress(lesson)}
      activeOpacity={isLockedForUser ? 1 : 0.8}
      disabled={isLockedForUser}
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
        <View style={styles.lessonCardHeader}>
          <Text 
            style={[
              styles.lessonCardTitle,
              isLockedForUser && styles.lockedText
            ]}
            numberOfLines={2}
          >
            {lesson.title}
          </Text>
          <View style={styles.lessonNumber}>
            <Text style={styles.lessonNumberText}>{index + 1}</Text>
          </View>
        </View>
        {lesson.description && (
          <Text style={styles.lessonDescription} numberOfLines={2}>
            {lesson.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

