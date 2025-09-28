import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { CourseWithProgress, AccessLevel } from '../../types/learning';
import { DesignTokens } from '../ui/DesignTokens';
import { ProgressRing } from './ProgressRing';
import { AccessBadge } from './AccessBadge';

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  onEnroll
}) => {
  console.log('🎓 CourseCard: Rendering course:', course.title);
  
  const isEnrolled = !!course.enrollment;
  const progressPercentage = course.progress?.progress_percentage || 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(course)}
      activeOpacity={0.7}
    >
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        {course.cover_url ? (
          <Image
            source={{ uri: course.cover_url }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>📚</Text>
          </View>
        )}
        
        {/* Progress Ring for enrolled courses */}
        {isEnrolled && (
          <View style={styles.progressContainer}>
            <ProgressRing
              progress={progressPercentage}
              size={40}
              strokeWidth={3}
              color={DesignTokens.colors.primary}
            />
          </View>
        )}

        {/* Access Badge */}
        <View style={styles.badgeContainer}>
          <AccessBadge access={course.access} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {course.title}
        </Text>
        
        {course.subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {course.subtitle}
          </Text>
        )}

        {/* Instructor */}
        {course.owner && (
          <View style={styles.instructorContainer}>
            <Text style={styles.instructorLabel}>מרצה:</Text>
            <Text style={styles.instructorName}>
              {course.owner.display_name}
            </Text>
          </View>
        )}

        {/* Progress Info for enrolled courses */}
        {isEnrolled && course.progress && (
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {course.progress.completed_lessons} מתוך {course.progress.total_lessons} שיעורים
            </Text>
          </View>
        )}

        {/* Tags */}
        {course.tags && course.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {course.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DesignTokens.colors.surface,
    borderRadius: DesignTokens.borderRadius.lg,
    marginBottom: DesignTokens.spacing.lg,
    overflow: 'hidden',
    ...DesignTokens.shadows.md,
  },
  coverContainer: {
    position: 'relative',
    height: 160,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: DesignTokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: DesignTokens.typography.fontSize['3xl'],
  },
  progressContainer: {
    position: 'absolute',
    top: DesignTokens.spacing.md,
    right: DesignTokens.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: DesignTokens.borderRadius.full,
    padding: DesignTokens.spacing.xs,
  },
  badgeContainer: {
    position: 'absolute',
    top: DesignTokens.spacing.md,
    left: DesignTokens.spacing.md,
  },
  content: {
    padding: DesignTokens.spacing.lg,
  },
  title: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    marginBottom: DesignTokens.spacing.md,
    textAlign: 'right',
    lineHeight: DesignTokens.typography.lineHeight.normal * DesignTokens.typography.fontSize.sm,
  },
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.sm,
  },
  instructorLabel: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.textMuted,
    marginLeft: DesignTokens.spacing.xs,
  },
  instructorName: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    fontWeight: DesignTokens.typography.fontWeight.medium,
  },
  progressInfo: {
    marginBottom: DesignTokens.spacing.sm,
  },
  progressText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.primary,
    fontWeight: DesignTokens.typography.fontWeight.medium,
    textAlign: 'right',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.xs,
  },
  tag: {
    backgroundColor: DesignTokens.colors.elevated,
    paddingHorizontal: DesignTokens.spacing.sm,
    paddingVertical: DesignTokens.spacing.xs,
    borderRadius: DesignTokens.borderRadius.sm,
  },
  tagText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.textSecondary,
  },
});

