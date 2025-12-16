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
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ArrowRight } from 'lucide-react-native';

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
    (navigation as any).navigate('LessonPlayerScreen', { 
      lessonId: lesson.id 
    });
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
      (navigation as any).navigate('LessonPlayerScreen', { 
        lessonId: lastLessonId 
      });
    }
  }, [lastLessonId, navigation]);

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
          locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={styles.loadingText}>טוען קורס...</Text>
          </View>
        </RNSafeAreaView>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
          locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>שגיאה בטעינת הקורס</Text>
            <Text style={styles.errorMessage}>
              {error?.message || 'הקורס לא נמצא'}
            </Text>
          </View>
        </RNSafeAreaView>
      </View>
    );
  }

  const isEnrolled = !!course.enrollment;

  return (
    <View style={{ flex: 1 }}>
      {/* רקע עם גרדיאנט ירוק כהה-שחור אנכי */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header עם back button */}
        <View style={{ paddingTop: DesignTokens.spacing.md, paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.md }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 18,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              alignSelf: 'flex-end',
            }}
          >
            <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

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
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: DesignTokens.spacing.lg }}>
          {/* Course Info Card */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
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
                  {lastLessonId ? 'המשך למידה' : 'התחל למידה'}
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
      </RNSafeAreaView>
    </View>
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
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
    borderRadius: tokens.borderRadius['2xl'],
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
  coverPlaceholderText: {
    fontSize: 48,
  },
  title: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: tokens.spacing.md,
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
    marginBottom: tokens.spacing.xs,
    textAlign: 'right',
  },
  instructorBio: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
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
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
  },
  progressPercentage: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
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
    marginBottom: tokens.spacing.lg,
  },
  descriptionTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  description: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    lineHeight: tokens.typography.lineHeight.relaxed * tokens.typography.fontSize.sm,
    textAlign: 'right',
  },
  tagsContainer: {
    marginBottom: tokens.spacing.lg,
  },
  tagsTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.lg,
  },
  tagText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
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

