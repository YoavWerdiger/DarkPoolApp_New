import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMyEnrollments } from '../../hooks/useLearning';
import { CourseCard } from '../../components/learning';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';

export const MyLearningScreen: React.FC = () => {
  const navigation = useNavigation();
  const { data: enrollments, isLoading, error, refetch } = useMyEnrollments();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    navigation.navigate('CourseDetailScreen' as never, { courseId: course.id } as never);
  }, [navigation]);

  const handleContinueLearning = useCallback((course: CourseWithProgress) => {
    if (course.progress?.last_lesson_id) {
      navigation.navigate('LessonPlayerScreen' as never, { 
        lessonId: course.progress.last_lesson_id 
      } as never);
    } else {
      // Navigate to course detail to start learning
      navigation.navigate('CourseDetailScreen' as never, { courseId: course.id } as never);
    }
  }, [navigation]);

  const renderCourse = useCallback(({ item }: { item: CourseWithProgress }) => (
    <View style={styles.courseContainer}>
      <CourseCard
        course={item}
        onPress={handleCoursePress}
      />
      
      {/* Continue Learning Button */}
      {item.progress && item.progress.progress_percentage > 0 && (
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => handleContinueLearning(item)}
        >
          <Text style={styles.continueButtonText}>
            {item.progress.last_lesson_id ? 'המשך למידה' : 'התחל למידה'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  ), [handleCoursePress, handleContinueLearning]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📚</Text>
      <Text style={styles.emptyStateTitle}>אין קורסים נרשמים</Text>
      <Text style={styles.emptyStateSubtitle}>
        התחל לחקור את הקורסים הזמינים
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('CoursesScreen' as never)}
      >
        <Text style={styles.exploreButtonText}>גלה קורסים</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStats = () => {
    if (!enrollments || enrollments.length === 0) return null;

    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(course => 
      course.progress?.progress_percentage === 100
    ).length;
    const inProgressCourses = enrollments.filter(course => 
      course.progress && course.progress.progress_percentage > 0 && course.progress.progress_percentage < 100
    ).length;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>התקדמות הלמידה</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalCourses}</Text>
            <Text style={styles.statLabel}>קורסים נרשמים</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{inProgressCourses}</Text>
            <Text style={styles.statLabel}>בתהליך</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedCourses}</Text>
            <Text style={styles.statLabel}>הושלמו</Text>
          </View>
        </View>
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>שגיאה בטעינת הקורסים</Text>
        <Text style={styles.errorMessage}>
          {error.message || 'אירעה שגיאה לא צפויה'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>הלמידה שלי</Text>
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Courses List with Gradient Background */}
      <View style={styles.listWrapper}>
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
          pointerEvents="none"
        />
        <FlatList
          data={enrollments || []}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary}
            />
          }
          ListEmptyComponent={!isLoading ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background,
  },
  header: {
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingTop: DesignTokens.spacing.lg,
    paddingBottom: DesignTokens.spacing.md,
  },
  headerTitle: {
    fontSize: DesignTokens.typography.fontSize['2xl'],
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.textPrimary,
    textAlign: 'right',
  },
  statsContainer: {
    marginHorizontal: DesignTokens.spacing.lg,
    marginBottom: DesignTokens.spacing.lg,
    backgroundColor: DesignTokens.colors.surface,
    borderRadius: DesignTokens.borderRadius.lg,
    padding: DesignTokens.spacing.lg,
    ...DesignTokens.shadows.md,
  },
  statsTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.md,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: DesignTokens.typography.fontSize.xl,
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.primary,
    marginBottom: DesignTokens.spacing.xs,
  },
  statLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContainer: {
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingBottom: DesignTokens.spacing['4xl'],
  },
  courseContainer: {
    marginBottom: DesignTokens.spacing.lg,
  },
  continueButton: {
    backgroundColor: DesignTokens.colors.success,
    marginTop: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing['5xl'],
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: DesignTokens.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: DesignTokens.spacing.lg,
  },
  exploreButton: {
    backgroundColor: DesignTokens.colors.primary,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  exploreButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.lg,
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
    marginBottom: DesignTokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: DesignTokens.colors.primary,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  retryButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
});

