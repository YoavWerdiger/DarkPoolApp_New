import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCourse, useEnrollInCourse, useCourseProgress } from '../../hooks/useLearning';
import { AcademySubScreenBar, ModuleSection, LessonRow } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LessonWithProgress } from '../../types/learning';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ScreenChrome } from '../../components/ui';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import {
  ACADEMY_CARD_HP,
  academyCardFrameStyle,
} from '../../components/learning/academyCardLayout';
import { getAcademyCourseTier } from '../../components/learning/academyCourses';

export const CourseDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { courseId } = route.params as { courseId: string };
  
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  const { data: course, isLoading, error, refetch } = useCourse(courseId);
  const { data: progressData, refetch: refetchProgress } = useCourseProgress(courseId);
  
  // טעינה מחדש של הנתונים כשהמשתמש חוזר למסך (למשל אחרי שצפה בסרטון)
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchProgress();
    }, [refetch, refetchProgress])
  );
  const progressPercentage = progressData?.progressPercentage || 0;
  const lastLessonId = progressData?.lastLessonId || null;
  const enrollMutation = useEnrollInCourse();

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  }, []);

  const handleLessonPress = useCallback((lesson: LessonWithProgress) => {
    (navigation as any).navigate('LessonPlayerScreen', {
      lessonId: lesson.id,
      courseId,
    });
  }, [navigation, courseId]);

  const handleEnroll = useCallback(async () => {
    if (!course) return;

    if (course.access === 'paid') {
      legacyAlert(
        'קורס בתשלום',
        'קורס זה דורש תשלום. התכונה תהיה זמינה בקרוב.',
        [{ text: 'אישור' }]
      );
      return;
    }

    try {
      await enrollMutation.mutateAsync(course.id);
      legacyAlert(
        'הצלחה!',
        'נרשמת בהצלחה לקורס',
        [{ text: 'אישור' }]
      );
    } catch (error) {
      legacyAlert(
        'שגיאה',
        'לא ניתן להירשם לקורס כרגע. נסה שוב מאוחר יותר.',
        [{ text: 'אישור' }]
      );
    }
  }, [course, enrollMutation]);

  const handleContinueLearning = useCallback(() => {
    if (lastLessonId) {
      (navigation as any).navigate('LessonPlayerScreen', {
        lessonId: lastLessonId,
        courseId,
      });
    }
  }, [lastLessonId, navigation, courseId]);

  if (isLoading) {
    return (
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={styles.loadingText}>טוען קורס...</Text>
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  if (error || !course) {
    return (
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>שגיאה בטעינת הקורס</Text>
            <Text style={styles.errorMessage}>
              {error?.message || 'הקורס לא נמצא'}
            </Text>
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  const isEnrolled = !!course.enrollment;
  const frameTier = getAcademyCourseTier(course) === 'premium' ? 'premium' : 'free';

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <ScrollView 
            style={styles.container} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        <AcademySubScreenBar onBackPress={() => navigation.goBack()} />

        <View style={{ paddingHorizontal: ACADEMY_CARD_HP }}>
        {/* Cover Image */}
        <View style={[styles.coverContainer, academyCardFrameStyle(frameTier)]}>
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
        </View>

        {/* Content */}
          <UICard
            variant="blur"
            padding="lg"
            showGlassBorder={false}
            style={[styles.infoCard, academyCardFrameStyle(frameTier)]}
          >
            <View style={styles.courseInfoStack}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>{course.title}</Text>
                {course.subtitle ? <Text style={styles.subtitle}>{course.subtitle}</Text> : null}
              </View>

            {/* Instructor */}
            {course.owner && (
              <View style={styles.instructorContainer}>
                <View style={styles.instructorAvatar}>
                  {course.owner.avatar_url ? (
                    <Image
                      source={{ uri: course.owner.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarPlaceholder}>
                      {course.owner.display_name.charAt(0)}
                    </Text>
                  )}
                </View>
                <View style={styles.instructorInfo}>
                  <Text style={styles.instructorName}>{course.owner.display_name}</Text>
                  {course.owner.bio && (
                    <Text style={styles.instructorBio} numberOfLines={2}>
                      {course.owner.bio}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Progress (if enrolled) */}
            {isEnrolled && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>התקדמות</Text>
                  <Text style={styles.progressPercentage}>
                    {Math.round(progressPercentage)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${progressPercentage}%` }
                    ]} 
                  />
                </View>
              </View>
            )}

            {/* Description */}
            {course.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionTitle}>תיאור הקורס</Text>
                <Text style={styles.description}>{course.description}</Text>
              </View>
            )}

            {/* Tags */}
            {course.tags && course.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <Text style={styles.tagsTitle}>תגיות</Text>
                <View style={styles.tagsRow}>
                  {course.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            </View>
          </UICard>

          {/* Action Button */}
          <View style={{ marginBottom: DesignTokens.spacing.lg }}>
            {isEnrolled ? (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinueLearning}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>
                  {lastLessonId ? 'המשך למידה ←' : 'התחל ←'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.enrollButton}
                onPress={handleEnroll}
                disabled={enrollMutation.isPending}
                activeOpacity={0.8}
              >
                {enrollMutation.isPending ? (
                  <ActivityIndicator color={DesignTokens.colors.text.primary} size="small" />
                ) : (
                  <Text style={styles.enrollButtonText}>
                    {course.access === 'free' ? 'הירשם בחינם' : 
                     course.access === 'registration' ? 'הירשם לקורס' : 
                     'קנה קורס'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Modules */}
          {course.modules && course.modules.length > 0 && courseId !== 'david-training-course' && (
            <View style={{ marginBottom: DesignTokens.spacing.lg }}>
              <Text style={styles.modulesTitle}>תוכן הקורס</Text>
            {course.modules.map((module, moduleIndex) => {
              // חישוב האינדקס ההתחלתי של השיעורים במודול זה
              let lessonStartIndex = 0;
              for (let i = 0; i < moduleIndex; i++) {
                lessonStartIndex += course.modules![i].lessons?.length || 0;
              }
              
              return (
                <ModuleSection
                  key={module.id}
                  module={module}
                  isExpanded={expandedModules.has(module.id)}
                  onToggle={() => toggleModule(module.id)}
                  onLessonPress={handleLessonPress}
                  enrollment={course.enrollment}
                  courseId={courseId}
                  lessonStartIndex={lessonStartIndex}
                />
              );
            })}
          </View>
        )}
        
          {/* Lessons directly (for courses without modules like david-training-course) */}
          {course.lessons && course.lessons.length > 0 && (courseId === 'david-training-course' || !course.modules || course.modules.length === 0) && (
            <View style={{ marginBottom: DesignTokens.spacing.lg }}>
              <Text style={styles.modulesTitle}>תוכן הקורס</Text>
            {course.lessons.map((lesson, index) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                onPress={handleLessonPress}
                enrollment={course.enrollment}
                isLocked={!course.enrollment && !lesson.is_preview}
                courseId={courseId}
                index={index}
              />
            ))}
          </View>
        )}
        </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: tokens.spacing['5xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  errorTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  coverContainer: {
    height: 200,
    marginBottom: tokens.spacing.lg,
    overflow: 'hidden',
  },
  infoCard: {
    marginBottom: tokens.spacing.lg,
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
  coverPlaceholderText: {
    fontSize: 48,
  },
  courseInfoStack: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  titleBlock: {
    width: '100%',
    gap: tokens.spacing.xs,
    alignItems: 'stretch',
  },
  title: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize['2xl'] * 1.22),
  },
  subtitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: '500' as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize.base * 1.45),
  },
  instructorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  instructorAvatar: {
    width: 50,
    height: 50,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: tokens.borderRadius.full,
  } as any,
  avatarPlaceholder: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize.base * 1.35),
    marginBottom: tokens.spacing.micro,
  },
  instructorBio: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.45),
  },
  progressContainer: {
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  progressTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.base * 1.3),
  },
  progressPercentage: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
    lineHeight: Math.round(tokens.typography.fontSize.base * 1.3),
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: tokens.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: tokens.borderRadius.sm,
  },
  descriptionContainer: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  descriptionTitle: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.35),
  },
  description: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.52),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tagsContainer: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  tagsTitle: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.35),
  },
  tagsRow: {
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
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.3),
  },
  enrollButton: {
    backgroundColor: tokens.colors.primary.main,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...tokens.shadows.md,
  },
  enrollButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
  },
  continueButton: {
    backgroundColor: tokens.colors.primary.main,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...tokens.shadows.md,
  },
  continueButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
  },
  modulesTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.lg,
    textAlign: 'right',
  },
});

