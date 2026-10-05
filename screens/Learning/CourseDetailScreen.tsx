import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCourse, useEnrollInCourse, useCourseProgress } from '../../hooks/useLearning';
import {
  scheduleAfterNavigationTransition,
  useAllowAfterNavigationTransition,
} from '../../hooks/afterNavigationTransition';
import { AcademySubScreenBar, ModuleSection, LessonRow } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LessonWithProgress } from '../../types/learning';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  ACADEMY_TYPE,
  academyCardSubtitleStyle,
  academyCardTitleStyle,
  academySectionTitleStyle,
} from '../../components/learning/academyLayout';
import { ScreenChrome } from '../../components/ui';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { isLessonLockedForUser } from '../../components/learning/academyCourses';
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
  const allowHeavy = useAllowAfterNavigationTransition();
  const skipFirstFocusRefetch = useRef(true);
  
  const { data: course, isLoading, error, refetch } = useCourse(courseId, { enabled: allowHeavy });
  // יחס הבאנר מהקובץ עצמו (ברירת מחדל 16:9) — המסגרת בדיוק בגודל התמונה
  const [coverRatio, setCoverRatio] = useState(16 / 9);
  const coverUrl = course?.cover_url;
  useEffect(() => {
    if (!coverUrl) return;
    let alive = true;
    Image.getSize(
      coverUrl,
      (w, h) => {
        if (alive && w > 0 && h > 0) setCoverRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [coverUrl]);
  const { data: progressData, refetch: refetchProgress } = useCourseProgress(courseId, {
    enabled: allowHeavy,
  });
  
  // חזרה לשיעור: refetch אחרי ה-pop. בפתיחה הראשונה ה-query כבר רץ אחרי allowHeavy.
  useFocusEffect(
    useCallback(() => {
      return scheduleAfterNavigationTransition(navigation, () => {
        if (skipFirstFocusRefetch.current) {
          skipFirstFocusRefetch.current = false;
          return;
        }
        void refetch();
        void refetchProgress();
      });
    }, [navigation, refetch, refetchProgress])
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

  if ((isLoading || !allowHeavy) && !course) {
    return (
      <ScreenChrome>
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
      <ScreenChrome>
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
    <ScreenChrome>
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
        <View style={[styles.coverContainer, academyCardFrameStyle(frameTier), { aspectRatio: coverRatio }]}>
          {course.cover_url ? (
            <Image
              source={{ uri: course.cover_url }}
              style={styles.coverImage}
              // contain + יחס אמיתי של הקובץ — הבאנר נכנס בדיוק ברוחב, בלי חיתוך של הלוגו/הכיתוב
              resizeMode="contain"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>📚</Text>
            </View>
          )}
        </View>

        {/* Content */}
          <UICard
            variant="soft"
            padding="lg"
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
          <View style={{ marginBottom: APP_LAYOUT.sectionHeaderToContent }}>
            {isEnrolled ? (
              <UIButton
                title={lastLessonId ? 'המשך למידה' : 'התחל'}
                variant="primary"
                fullWidth
                onPress={handleContinueLearning}
              />
            ) : (
              <UIButton
                title={
                  course.access === 'free'
                    ? 'הירשם בחינם'
                    : course.access === 'registration'
                      ? 'הירשם לקורס'
                      : 'קנה קורס'
                }
                variant="primary"
                fullWidth
                loading={enrollMutation.isPending}
                disabled={enrollMutation.isPending}
                onPress={handleEnroll}
              />
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
                  course={course}
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
                isLocked={isLessonLockedForUser({ lesson, enrollment: course.enrollment, course })}
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
    ...ACADEMY_TYPE.body,
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
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
    textAlign: 'center',
  },
  errorMessage: {
    ...ACADEMY_TYPE.body,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  coverContainer: {
    // aspectRatio נקבע בזמן ריצה לפי הקובץ (ברירת מחדל 16:9) — גובה קבוע חתך את הלוגו
    marginBottom: APP_LAYOUT.cardStackGap,
    overflow: 'hidden',
    borderRadius: UI_CARD_RADIUS,
  },
  infoCard: {
    marginBottom: APP_LAYOUT.cardStackGap,
    borderRadius: UI_CARD_RADIUS,
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
    alignItems: 'stretch',
  },
  title: {
    ...academyCardTitleStyle,
    color: tokens.colors.text.primary,
  },
  subtitle: {
    ...academyCardSubtitleStyle,
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
    marginLeft: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: tokens.borderRadius.full,
  } as any,
  avatarPlaceholder: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  instructorBio: {
    ...academyCardSubtitleStyle,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
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
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  progressPercentage: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
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
    ...ACADEMY_TYPE.cardMetricLabel,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  description: {
    ...ACADEMY_TYPE.cardBody,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tagsContainer: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  tagsTitle: {
    ...ACADEMY_TYPE.cardMetricLabel,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  tag: {
    backgroundColor: tokens.colors.background.navChrome,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
  },
  tagText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.primary,
  },
  modulesTitle: {
    ...academySectionTitleStyle,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.sectionHeaderToContent,
  },
});

