import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ModuleWithLessons, Enrollment } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { LessonRow } from './LessonRow';
import { academyCardFrameStyle } from './academyCardLayout';
import { APP_LAYOUT } from '../ui/appLayout';
import { appCardSubtitleStyle, appCardTitleStyle } from '../ui/appType';
import { ACADEMY_TYPE } from './academyLayout';
import { isLessonLockedForUser } from './academyCourses';
import type { CourseWithProgress } from '../../types/learning';

interface ModuleSectionProps {
  module: ModuleWithLessons;
  isExpanded: boolean;
  onToggle: () => void;
  onLessonPress: (lesson: any) => void;
  enrollment?: Enrollment;
  courseId?: string;
  lessonStartIndex?: number;
  course?: Pick<CourseWithProgress, 'id' | 'title' | 'access'> | null;
}

export const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  isExpanded,
  onToggle,
  onLessonPress,
  enrollment,
  courseId,
  lessonStartIndex = 0,
  course,
}) => {
  const DesignTokens = useDesignTokens();
  const totalLessons = module.lessons?.length || 0;
  const completedLessons = module.lessons?.filter(lesson => 
    lesson.progress?.status === 'completed'
  ).length || 0;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: APP_LAYOUT.cardStackGap,
      overflow: 'hidden',
    },
    header: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 15,
    },
    headerContent: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
      marginLeft: DesignTokens.spacing.md,
      gap: APP_LAYOUT.cardTitleToBodyGap,
    },
    headerRight: {
      alignItems: 'center',
      minWidth: 60,
    },
    title: {
      ...appCardTitleStyle,
      color: DesignTokens.colors.text.primary,
    },
    description: {
      ...appCardSubtitleStyle,
    },
    lessonCount: {
      ...ACADEMY_TYPE.cardSubtitle,
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
      ...ACADEMY_TYPE.cardSubtitle,
      color: DesignTokens.colors.text.secondary,
    },
    expandIcon: {
      ...ACADEMY_TYPE.caption,
      color: DesignTokens.colors.text.secondary,
      transform: [{ rotate: '0deg' }],
    },
    expandIconRotated: {
      transform: [{ rotate: '180deg' }],
    },
    lessonsContainer: {
      borderTopWidth: 1,
      borderTopColor: DesignTokens.colors.border.divider,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingTop: APP_LAYOUT.stackGapSmall,
      paddingBottom: APP_LAYOUT.cardPadding,
    },
  }), [DesignTokens]);

  return (
    <UICard
      variant="soft"
      padding="none"
      style={[styles.container, academyCardFrameStyle('neutral')]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={{ width: '100%' }}>
              <Text style={styles.title}>{module.title}</Text>
              {module.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {module.description}
                </Text>
              ) : null}
            </View>
            <Text style={styles.lessonCount}>
              {totalLessons} שיעורים • {completedLessons} הושלמו
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            {enrollment && totalLessons > 0 && (
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
              isLocked={isLessonLockedForUser({ lesson, enrollment, course })}
              courseId={courseId}
              index={lessonStartIndex + index}
            />
          ))}
        </View>
      )}
    </UICard>
  );
};
