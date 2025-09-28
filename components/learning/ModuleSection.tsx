import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ModuleWithLessons, Enrollment } from '../../types/learning';
import { DesignTokens } from '../ui/DesignTokens';
import { LessonRow } from './LessonRow';

interface ModuleSectionProps {
  module: ModuleWithLessons;
  isExpanded: boolean;
  onToggle: () => void;
  onLessonPress: (lesson: any) => void;
  enrollment?: Enrollment;
}

export const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  isExpanded,
  onToggle,
  onLessonPress,
  enrollment
}) => {
  const isEnrolled = !!enrollment;
  const totalLessons = module.lessons?.length || 0;
  const completedLessons = module.lessons?.filter(lesson => 
    lesson.progress?.status === 'completed'
  ).length || 0;

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
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DesignTokens.colors.surface,
    borderRadius: DesignTokens.borderRadius.lg,
    marginBottom: DesignTokens.spacing.md,
    overflow: 'hidden',
    borderWidth: DesignTokens.layout.borderWidth.normal,
    borderColor: DesignTokens.colors.border,
  },
  header: {
    padding: DesignTokens.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    marginRight: DesignTokens.spacing.md,
  },
  headerRight: {
    alignItems: 'center',
    minWidth: 60,
  },
  title: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.xs,
    textAlign: 'right',
  },
  description: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'right',
    lineHeight: DesignTokens.typography.lineHeight.normal * DesignTokens.typography.fontSize.sm,
  },
  lessonCount: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.textMuted,
    textAlign: 'right',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.sm,
  },
  progressBar: {
    width: 40,
    height: 4,
    backgroundColor: DesignTokens.colors.border,
    borderRadius: DesignTokens.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: DesignTokens.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.primary,
    borderRadius: DesignTokens.borderRadius.sm,
  },
  progressText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.primary,
    fontWeight: DesignTokens.typography.fontWeight.medium,
  },
  expandIcon: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  lessonsContainer: {
    borderTopWidth: DesignTokens.layout.borderWidth.normal,
    borderTopColor: DesignTokens.colors.border,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

