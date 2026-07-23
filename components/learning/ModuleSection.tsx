import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ModuleWithLessons, Enrollment } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { LessonRow } from './LessonRow';
import { academyCardFrameStyle } from './academyCardLayout';

interface ModuleSectionProps {
  module: ModuleWithLessons;
  isExpanded: boolean;
  onToggle: () => void;
  onLessonPress: (lesson: any) => void;
  enrollment?: Enrollment;
  courseId?: string;
  lessonStartIndex?: number;
}

export const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  isExpanded,
  onToggle,
  onLessonPress,
  enrollment,
  courseId,
  lessonStartIndex = 0
}) => {
  const DesignTokens = useDesignTokens();
  const isEnrolled = !!enrollment;
  const totalLessons = module.lessons?.length || 0;
  const completedLessons = module.lessons?.filter(lesson => 
    lesson.progress?.status === 'completed'
  ).length || 0;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: DesignTokens.spacing.lg,
      overflow: 'hidden',
    },
    header: {
      padding: DesignTokens.spacing.lg,
    },
    headerContent: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
      marginLeft: DesignTokens.spacing.md,
      gap: DesignTokens.spacing.sm,
    },
    headerRight: {
      alignItems: 'center',
      minWidth: 60,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: DesignTokens.colors.text.primary,
      textAlign: 'right',
      letterSpacing: 0.3,
      lineHeight: Math.round(18 * DesignTokens.typography.lineHeight.normal),
      writingDirection: 'rtl',
    },
    description: {
      fontSize: DesignTokens.typography.fontSize.sm,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'right',
      lineHeight: Math.round(DesignTokens.typography.fontSize.sm * DesignTokens.typography.lineHeight.normal),
      writingDirection: 'rtl',
    },
    lessonCount: {
      fontSize: DesignTokens.typography.fontSize.xs,
      color: DesignTokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    progressContainer: {
      alignItems: 'center',
      marginBottom: DesignTokens.spacing.xs,
    },
    progressBar: {
      width: 40,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: DesignTokens.borderRadius.sm,
      overflow: 'hidden',
      marginBottom: DesignTokens.spacing.xs,
    },
    progressFill: {
      height: '100%',
      backgroundColor: DesignTokens.colors.primary.main,
      borderRadius: DesignTokens.borderRadius.sm,
    },
    progressText: {
      fontSize: DesignTokens.typography.fontSize.xs,
      color: DesignTokens.colors.primary.main,
      fontWeight: DesignTokens.typography.fontWeight.medium as any,
    },
    expandIcon: {
      fontSize: DesignTokens.typography.fontSize.sm,
      color: DesignTokens.colors.text.secondary,
      transform: [{ rotate: '0deg' }],
    },
    expandIconRotated: {
      transform: [{ rotate: '180deg' }],
    },
    lessonsContainer: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: DesignTokens.spacing.lg,
      paddingTop: DesignTokens.spacing.sm,
      paddingBottom: DesignTokens.spacing.lg,
    },
  }), [DesignTokens]);

  return (
    <UICard
      variant="blur"
      padding="none"
      showGlassBorder={false}
      style={[styles.container, academyCardFrameStyle('neutral')]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{module.title}</Text>
            {module.description && (
              <Text style={styles.description} numberOfLines={2}>
                {module.description}
              </Text>
            )}
            <Text style={styles.lessonCount}>
              {totalLessons} שיעורים • {completedLessons} הושלמו
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            {isEnrolled && totalLessons > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(completedLessons / totalLessons) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round((completedLessons / totalLessons) * 100)}%
                </Text>
              </View>
            )}
            
            <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
              ▼
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && module.lessons && (
        <View style={styles.lessonsContainer}>
          {module.lessons.map((lesson, index) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              onPress={onLessonPress}
              enrollment={enrollment}
              isLocked={!isEnrolled && !lesson.is_preview}
              courseId={courseId}
              index={lessonStartIndex + index}
            />
          ))}
        </View>
      )}
    </UICard>
  );
};
