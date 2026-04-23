import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CourseWithProgress } from '../../types/learning';
import { ProgressRing } from './ProgressRing';
import { AccessBadge } from './AccessBadge';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
  hideBadges?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  onEnroll,
  hideBadges = false
}) => {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
  const isEnrolled = !!course.enrollment;
  const lessonsFromModules =
    course.modules?.reduce((sum, mod) => sum + (mod.lessons?.length ?? 0), 0) ?? 0;
  const fromProgressTotal = course.progress?.total_lessons;
  const fromMetaTotal = (course as any).total_lessons as number | undefined;
  const fromLessonsArr = Array.isArray((course as any).lessons) ? (course as any).lessons.length : 0;
  const totalLessons =
    [fromProgressTotal, fromMetaTotal, fromLessonsArr, lessonsFromModules].find(
      (n) => typeof n === 'number' && n > 0
    ) ?? 0;
  const completedLessons = course.progress?.completed_lessons || 0;
  const progressPercentage =
    totalLessons > 0
      ? (completedLessons / totalLessons) * 100
      : course.progress?.progress_percentage || 0;
  const showProgressRing = isEnrolled || totalLessons > 0;

  // קבלת מחיר מהקורס (אם יש)
  const coursePrice = (course as any).price || 0;
  const hasTopRightBadge = coursePrice > 0 || (!hideBadges && coursePrice === 0);
  const originalPrice = (course as any).original_price || 0;
  const hasDiscount = originalPrice > 0 && originalPrice > coursePrice;

  return (
    <TouchableOpacity
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress(course);
      }}
      activeOpacity={0.7}
    >
      <UICard
        variant="blur"
        padding="none"
        style={[styles.container, { borderColor: `${DesignTokens.colors.primary.main}18` }]}
      >
        {/* Cover Image - Full Width */}
        <View style={styles.coverContainer}>
          {course.cover_url ? (
            <Image
              source={{ uri: course.cover_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="school-outline" size={48} color={DesignTokens.colors.text.tertiary} />
            </View>
          )}
          
          {/* Price Badge - Top Right */}
          {coursePrice > 0 && (
            <View style={styles.priceBadge}>
              {hasDiscount && (
                <Text style={styles.originalPriceBadge}>
                  ₪{originalPrice.toFixed(0)}
                </Text>
              )}
              <Text style={styles.currentPriceBadge}>
                ₪{coursePrice.toFixed(0)}
              </Text>
            </View>
          )}

          {/* Free Badge */}
          {!hideBadges && coursePrice === 0 && (
            <View style={styles.freeBadgeOverlay}>
              <Text style={styles.freeBadgeOverlayText}>חינם</Text>
            </View>
          )}

          {/* טבעת התקדמות — גם כשיש ספירת שיעורים מהמודולים בלי enrollment בלבד */}
          {showProgressRing && (
            <View
              style={[
                styles.progressContainer,
                hasTopRightBadge && { top: 56 },
              ]}
            >
              <ProgressRing
                progress={Math.min(100, Math.max(0, progressPercentage))}
                size={48}
                strokeWidth={3}
                color={DesignTokens.colors.primary.main}
                centerLabel={`${Math.round(progressPercentage)}%`}
              />
            </View>
          )}

          {/* Access Badge */}
          {!hideBadges && (
            <View style={styles.badgeContainer}>
              <AccessBadge access={course.access} />
            </View>
          )}
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

          {/* Description */}
          {course.description && (
            <Text style={styles.description} numberOfLines={2}>
              {course.description}
            </Text>
          )}

          {/* סיכום שיעורים — בלי פס התקדמות (האחוז בטבעת) */}
          {totalLessons > 0 && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {completedLessons}/{totalLessons} שיעורים הושלמו
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
      </UICard>
    </TouchableOpacity>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: tokens.borderRadius['2xl'],
    marginBottom: tokens.spacing.lg,
    borderWidth: 1,
  },
  coverContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
    borderTopLeftRadius: tokens.borderRadius['2xl'],
    borderTopRightRadius: tokens.borderRadius['2xl'],
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  } as any,
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: tokens.spacing.md,
    right: tokens.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: tokens.borderRadius.full,
    padding: tokens.spacing.xs,
  },
  badgeContainer: {
    position: 'absolute',
    top: tokens.spacing.md,
    left: tokens.spacing.md,
  },
  priceBadge: {
    position: 'absolute',
    top: tokens.spacing.md,
    right: tokens.spacing.md,
    backgroundColor: tokens.colors.overlay || 'rgba(0,0,0,0.7)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  originalPriceBadge: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPriceBadge: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.success.main || tokens.colors.primary.main,
  },
  freeBadgeOverlay: {
    position: 'absolute',
    top: tokens.spacing.md,
    right: tokens.spacing.md,
    backgroundColor: tokens.colors.primary.main + 'E6',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
  },
  freeBadgeOverlayText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: '800' as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  description: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.tertiary,
    lineHeight: 20,
    textAlign: 'right',
  },
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  instructorLabel: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
    marginLeft: tokens.spacing.xs,
  },
  instructorName: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  progressInfo: {
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  progressText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    textAlign: 'right',
  },
  tagsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
  },
  tagText: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
    borderTopWidth: tokens.layout?.borderWidth?.thin || 1,
    borderTopColor: tokens.colors.border.primary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  originalPrice: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
  },
  freeBadge: {
    backgroundColor: tokens.colors.primary.main + '20',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.md,
  },
  freeBadgeText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.primary.main,
  },
  premiumBadge: {
    backgroundColor: tokens.colors.danger.main + '20',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.md,
  },
  premiumBadgeText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.danger.main,
  },
});

