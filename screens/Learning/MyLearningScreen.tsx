import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import UICard from '../../components/ui/UICard';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenChrome } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { useMyEnrollments } from '../../hooks/useLearning';
import { AcademyScreenHeader, CourseCard } from '../../components/learning';
import { ACADEMY_CARD_HP, academyCardFrameStyle } from '../../components/learning/academyCardLayout';
import {
  getAcademyCourseSubtitle,
  isComingSoonCourse,
  isNativeLearningCourse,
} from '../../components/learning/academyCourses';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

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
    try {
      await refetch();
    } finally {
      setRefreshing(false);
      void HapticFeedback.impactLight();
    }
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    if (isComingSoonCourse(course)) {
      navigation.navigate('CourseComingSoonScreen', {
        courseId: course.id,
        title: course.title,
        subtitle: getAcademyCourseSubtitle(course),
        coverUrl: course.cover_url ?? undefined,
      });
      return;
    }
    if (isNativeLearningCourse(course)) {
      navigation.navigate('LearningScreen', { courseId: course.id });
    } else {
      navigation.navigate('CourseDetailScreen', { courseId: course.id });
    }
  }, [navigation]);

  const handleContinueLearning = useCallback((course: CourseWithProgress) => {
    void HapticFeedback.impactLight();
    if (isComingSoonCourse(course)) {
      navigation.navigate('CourseComingSoonScreen', {
        courseId: course.id,
        title: course.title,
        subtitle: getAcademyCourseSubtitle(course),
        coverUrl: course.cover_url ?? undefined,
      });
      return;
    }
    if (course.progress?.last_lesson_id) {
      navigation.navigate('LessonPlayerScreen', {
        lessonId: course.progress.last_lesson_id,
        courseId: course.id,
      });
    } else if (isNativeLearningCourse(course)) {
      navigation.navigate('LearningScreen', { courseId: course.id });
    } else {
      navigation.navigate('CourseDetailScreen', { courseId: course.id });
    }
  }, [navigation]);

  const renderCourse = useCallback(({ item }: { item: CourseWithProgress }) => {
    const pct = item.progress?.progress_percentage ?? 0;
    return (
      <View style={styles.courseContainer}>
        <CourseCard course={item} onPress={handleCoursePress} />

        {/* Progress bar + continue button */}
        {item.enrollment && (
          <View style={styles.courseFooter}>
            {pct > 0 && (
              <View style={styles.progressBarWrap}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(pct, 100)}%` as any }]} />
                </View>
                <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => handleContinueLearning(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>
                {pct > 0 ? 'המשך למידה ←' : 'התחל ←'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [handleCoursePress, handleContinueLearning]);

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
    const completedCourses = enrollments.filter(c => c.progress?.progress_percentage === 100).length;
    const inProgressCourses = enrollments.filter(c =>
      c.progress && c.progress.progress_percentage > 0 && c.progress.progress_percentage < 100
    ).length;
    return (
      <UICard
        variant="blur"
        padding="lg"
        showGlassBorder={false}
        style={[{ marginHorizontal: ACADEMY_CARD_HP, marginBottom: 16 }, academyCardFrameStyle('neutral')]}
      >
        <Text style={styles.statsTitle}>התקדמות הלמידה</Text>
        <View style={styles.statsRow}>
          {[
            { value: totalCourses, label: 'קורסים' },
            { value: inProgressCourses, label: 'בתהליך' },
            { value: completedCourses, label: 'הושלמו' },
          ].map(s => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </UICard>
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
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingTop: tokens.spacing.md,
      paddingBottom: tokens.spacing['5xl'],
    },
    courseContainer: {
      marginBottom: tokens.spacing.lg,
    },
    courseFooter: {
      marginTop: -tokens.spacing.sm,
      gap: tokens.spacing.sm,
    },
    progressBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      paddingHorizontal: 2,
    },
    progressBarTrack: {
      flex: 1,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: tokens.colors.primary.main,
      borderRadius: 2,
    },
    progressPct: {
      fontSize: 11,
      color: tokens.colors.text.secondary,
      minWidth: 32,
      textAlign: 'right',
    },
    continueButton: {
      backgroundColor: tokens.colors.primary.main,
      paddingVertical: tokens.spacing.md,
      borderRadius: tokens.borderRadius.lg,
      alignItems: 'center',
    },
    continueButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: '#fff',
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

