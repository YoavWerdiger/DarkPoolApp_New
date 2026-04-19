import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenChrome, MAIN_SCREEN_HEADER_HP } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { useMyEnrollments } from '../../hooks/useLearning';
import { AcademyScreenHeader, CourseCard } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

export const MyLearningScreen: React.FC = () => {
  const navigation = useNavigation() as {
    navigate: (name: string, params?: object) => void;
  };
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const { data: enrollments, isLoading, error, refetch } = useMyEnrollments();
  const [refreshing, setRefreshing] = React.useState(false);

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    // אם זה קורס הלוויתנים או קורס דוד איראל, נוביל ל-LearningScreen
    if (course.slug === 'whales-course' || course.id === 'whales-course-1' || course.title === 'קורס הלוויתנים' ||
        course.id === 'david-training-course' || course.title === 'הכשרה של דוד אריאל') {
      navigation.navigate('LearningScreen', { courseId: course.id });
    } else {
      navigation.navigate('CourseDetailScreen', { courseId: course.id });
    }
  }, [navigation]);

  const handleContinueLearning = useCallback((course: CourseWithProgress) => {
    if (course.progress?.last_lesson_id) {
      navigation.navigate('LessonPlayerScreen', {
        lessonId: course.progress.last_lesson_id,
      });
    } else {
      // אם זה קורס הלוויתנים או קורס דוד איראל, נוביל ל-LearningScreen
      if (course.slug === 'whales-course' || course.id === 'whales-course-1' || course.title === 'קורס הלוויתנים' ||
          course.id === 'david-training-course' || course.title === 'הכשרה של דוד אריאל') {
        navigation.navigate('LearningScreen', { courseId: course.id });
      } else {
        navigation.navigate('CourseDetailScreen', { courseId: course.id });
      }
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
        onPress={() => navigation.navigate('CoursesScreen')}
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
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
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
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <AcademyScreenHeader onMenuPress={openMainDrawer} title="הלמידה שלי" />

        {/* Stats */}
        {renderStats()}

        {/* Courses List */}
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <FlatList
            data={enrollments || []}
            renderItem={renderCourse}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
            />
          }
          ListEmptyComponent={!isLoading ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
          />
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    safeAreaContainer: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: tokens.colors.background.primary,
    },
    statsContainer: {
      marginHorizontal: MAIN_SCREEN_HEADER_HP,
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: tokens.borderRadius['2xl'],
      padding: tokens.spacing.lg,
    },
    statsTitle: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: tokens.colors.text.primary,
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
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.primary.main,
      marginBottom: tokens.spacing.xs,
    },
    statLabel: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    listContainer: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: tokens.spacing.md,
      paddingBottom: tokens.spacing['5xl'],
    },
    courseContainer: {
      marginBottom: tokens.spacing.lg,
    },
    continueButton: {
      backgroundColor: tokens.colors.success.main,
      marginTop: tokens.spacing.sm,
      paddingVertical: tokens.spacing.md,
      borderRadius: tokens.borderRadius.lg,
      alignItems: 'center',
    },
    continueButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: tokens.colors.text.inverse,
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
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      marginBottom: tokens.spacing.lg,
    },
    exploreButton: {
      backgroundColor: tokens.colors.primary.main,
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: tokens.spacing.md,
      borderRadius: tokens.borderRadius.lg,
    },
    exploreButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: tokens.colors.text.inverse,
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
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      marginBottom: tokens.spacing.lg,
    },
    retryButton: {
      backgroundColor: tokens.colors.primary.main,
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: tokens.spacing.md,
      borderRadius: tokens.borderRadius.lg,
    },
    retryButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: tokens.colors.text.inverse,
    },
  });

