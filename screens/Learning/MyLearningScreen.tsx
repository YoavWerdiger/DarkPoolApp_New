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
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';

export const MyLearningScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
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

const createStyles = (tokens: ReturnType<typeof usetokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  headerTitle: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.textPrimary,
    textAlign: 'right',
  },
  statsContainer: {
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    ...tokens.shadows.md,
  },
  statsTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.md,
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
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.xs,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
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
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing['4xl'],
  },
  courseContainer: {
    marginBottom: tokens.spacing.lg,
  },
  continueButton: {
    backgroundColor: tokens.colors.success,
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing['5xl'],
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  exploreButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  exploreButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
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
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  retryButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
});

