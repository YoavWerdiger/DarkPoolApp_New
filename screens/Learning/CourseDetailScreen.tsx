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
import { useRoute, useNavigation } from '@react-navigation/native';
import { useCourse, useEnrollInCourse, useCourseProgress } from '../../hooks/useLearning';
import { ModuleSection } from '../../components/learning';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { LessonWithProgress } from '../../types/learning';

export const CourseDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { courseId } = route.params as { courseId: string };
  
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  const { data: course, isLoading, error } = useCourse(courseId);
  const { progressPercentage, lastLessonId } = useCourseProgress(courseId);
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
  const totalLessons = course.modules?.reduce((sum, module) => 
    sum + (module.lessons?.length || 0), 0) || 0;

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

          {/* Course Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalLessons}</Text>
              <Text style={styles.statLabel}>שיעורים</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{course.modules?.length || 0}</Text>
              <Text style={styles.statLabel}>מודולים</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{course.language}</Text>
              <Text style={styles.statLabel}>שפה</Text>
            </View>
          </View>

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
                <ActivityIndicator color="#FFFFFF" size="small" />
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
        {course.modules && course.modules.length > 0 && (
          <View style={styles.modulesContainer}>
            <Text style={styles.modulesTitle}>תוכן הקורס</Text>
            {course.modules.map((module) => (
              <ModuleSection
                key={module.id}
                module={module}
                isExpanded={expandedModules.has(module.id)}
                onToggle={() => toggleModule(module.id)}
                onLessonPress={handleLessonPress}
                enrollment={course.enrollment}
              />
            ))}
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.background,
  },
  loadingText: {
    marginTop: DesignTokens.spacing.md,
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.lg,
    backgroundColor: DesignTokens.colors.background,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: DesignTokens.spacing.lg,
  },
  errorTitle: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
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
    backgroundColor: DesignTokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 48,
  },
  backButton: {
    position: 'absolute',
    top: DesignTokens.spacing.lg,
    right: DesignTokens.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    color: '#FFFFFF',
    fontWeight: DesignTokens.typography.fontWeight.bold,
  },
  content: {
    padding: DesignTokens.spacing.lg,
  },
  courseInfo: {
    marginBottom: DesignTokens.spacing.lg,
  },
  title: {
    fontSize: DesignTokens.typography.fontSize['2xl'],
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.textSecondary,
    marginBottom: DesignTokens.spacing.lg,
    textAlign: 'right',
  },
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.lg,
  },
  instructorAvatar: {
    width: 50,
    height: 50,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: DesignTokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: DesignTokens.spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: DesignTokens.borderRadius.full,
  },
  avatarPlaceholder: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.textPrimary,
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.xs,
    textAlign: 'right',
  },
  instructorBio: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    backgroundColor: DesignTokens.colors.surface,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.primary,
    marginBottom: DesignTokens.spacing.xs,
  },
  statLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
  },
  progressContainer: {
    marginBottom: DesignTokens.spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.sm,
  },
  progressTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
  },
  progressPercentage: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: DesignTokens.colors.border,
    borderRadius: DesignTokens.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.primary,
    borderRadius: DesignTokens.borderRadius.sm,
  },
  descriptionContainer: {
    marginBottom: DesignTokens.spacing.lg,
  },
  descriptionTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'right',
  },
  description: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    lineHeight: DesignTokens.typography.lineHeight.relaxed * DesignTokens.typography.fontSize.sm,
    textAlign: 'right',
  },
  tagsContainer: {
    marginBottom: DesignTokens.spacing.lg,
  },
  tagsTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.sm,
  },
  tag: {
    backgroundColor: DesignTokens.colors.elevated,
    paddingHorizontal: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.sm,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  tagText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
  },
  actionContainer: {
    marginBottom: DesignTokens.spacing.lg,
  },
  enrollButton: {
    backgroundColor: DesignTokens.colors.primary,
    paddingVertical: DesignTokens.spacing.lg,
    borderRadius: DesignTokens.borderRadius.lg,
    alignItems: 'center',
    ...DesignTokens.shadows.green,
  },
  enrollButtonText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: DesignTokens.colors.success,
    paddingVertical: DesignTokens.spacing.lg,
    borderRadius: DesignTokens.borderRadius.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  modulesContainer: {
    marginBottom: DesignTokens.spacing['4xl'],
  },
  modulesTitle: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.lg,
    textAlign: 'right',
  },
});

