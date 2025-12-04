import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCourse, useEnrollInCourse, useCourseProgress } from '../../hooks/useLearning';
import { ModuleSection, LessonRow } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LessonWithProgress } from '../../types/learning';

export const CourseDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { courseId } = route.params as { courseId: string };
  
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
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
    navigation.navigate('LessonPlayerScreen' as never, { 
      lessonId: lesson.id 
    } as never);
  }, [navigation]);

  const handleEnroll = useCallback(async () => {
    if (!course) return;

    if (course.access === 'paid') {
      Alert.alert(
        'קורס בתשלום',
        'קורס זה דורש תשלום. התכונה תהיה זמינה בקרוב.',
        [{ text: 'אישור' }]
      );
      return;
    }

    try {
      await enrollMutation.mutateAsync(course.id);
      Alert.alert(
        'הצלחה!',
        'נרשמת בהצלחה לקורס',
        [{ text: 'אישור' }]
      );
    } catch (error) {
      Alert.alert(
        'שגיאה',
        'לא ניתן להירשם לקורס כרגע. נסה שוב מאוחר יותר.',
        [{ text: 'אישור' }]
      );
    }
  }, [course, enrollMutation]);

  const handleContinueLearning = useCallback(() => {
    if (lastLessonId) {
      navigation.navigate('LessonPlayerScreen' as never, { 
        lessonId: lastLessonId 
      } as never);
    }
  }, [lastLessonId, navigation]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary} />
        <Text style={styles.loadingText}>טוען קורס...</Text>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>שגיאה בטעינת הקורס</Text>
        <Text style={styles.errorMessage}>
          {error?.message || 'הקורס לא נמצא'}
        </Text>
      </View>
    );
  }

  const isEnrolled = !!course.enrollment;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.25)', 'transparent', 'rgba(0, 230, 84, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
        
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Course Info */}
        <View style={styles.courseInfo}>
          <Text style={styles.title}>{course.title}</Text>
          
          {course.subtitle && (
            <Text style={styles.subtitle}>{course.subtitle}</Text>
          )}

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

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {isEnrolled ? (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinueLearning}
            >
              <Text style={styles.continueButtonText}>
                {lastLessonId ? 'המשך למידה' : 'התחל למידה'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.enrollButton}
              onPress={handleEnroll}
              disabled={enrollMutation.isPending}
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
          <View style={styles.modulesContainer}>
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
          <View style={styles.modulesContainer}>
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
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  errorTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  coverContainer: {
    position: 'relative',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 48,
  },
  backButton: {
    position: 'absolute',
    top: tokens.spacing.lg,
    right: tokens.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.text.primary,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  courseInfo: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.lg,
    textAlign: 'right',
  },
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  instructorAvatar: {
    width: 50,
    height: 50,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: tokens.spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: tokens.borderRadius.full,
  },
  avatarPlaceholder: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.textPrimary,
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.xs,
    textAlign: 'right',
  },
  instructorBio: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.xs,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
  },
  progressContainer: {
    marginBottom: tokens.spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  progressTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
  },
  progressPercentage: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.sm,
  },
  descriptionContainer: {
    marginBottom: tokens.spacing.lg,
  },
  descriptionTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  description: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    lineHeight: tokens.typography.lineHeight.relaxed * tokens.typography.fontSize.sm,
    textAlign: 'right',
  },
  tagsContainer: {
    marginBottom: tokens.spacing.lg,
  },
  tagsTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  tag: {
    backgroundColor: tokens.colors.elevated,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.lg,
  },
  tagText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
  },
  actionContainer: {
    marginBottom: tokens.spacing.lg,
  },
  enrollButton: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    ...tokens.shadows.green,
  },
  enrollButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  continueButton: {
    backgroundColor: tokens.colors.success,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  modulesContainer: {
    marginBottom: tokens.spacing['4xl'],
  },
  modulesTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.lg,
    textAlign: 'right',
  },
});

