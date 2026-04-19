import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ModuleWithLessons, Enrollment } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import { LessonRow } from './LessonRow';

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
      backgroundColor: DesignTokens.colors.background.elevated,
      borderRadius: DesignTokens.borderRadius['2xl'],
      marginBottom: DesignTokens.spacing.lg,
      overflow: 'hidden',
      borderWidth: DesignTokens.layout.borderWidth.normal,
      borderColor: DesignTokens.colors.border.primary,
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
      backgroundColor: DesignTokens.colors.border.primary,
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
      borderTopWidth: DesignTokens.layout.borderWidth.normal,
      borderTopColor: DesignTokens.colors.border.primary,
      position: 'relative',
      paddingHorizontal: DesignTokens.spacing.lg,
      paddingTop: DesignTokens.spacing.sm,
      paddingBottom: DesignTokens.spacing.lg,
    },
    gradientBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  }), [DesignTokens]);

  return (
    <View style={styles.container}>
      {/* Module Header */}
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
            {/* Progress indicator */}
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
            
            {/* Expand/Collapse Icon */}
            <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
              ▼
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Lessons List */}
      {isExpanded && module.lessons && (
        <View style={styles.lessonsContainer}>
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
            pointerEvents="none"
          />
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
    </View>
  );
};

