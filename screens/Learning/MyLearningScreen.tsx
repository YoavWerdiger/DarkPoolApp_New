import React, { useCallback, useMemo } from 'react';
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
import UIButton from '../../components/ui/UIButton';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { useMyEnrollments } from '../../hooks/useLearning';
import { useAllowAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import { AcademyScreenHeader, CourseCard } from '../../components/learning';
import { ACADEMY_CARD_HP, academyCardFrameStyle } from '../../components/learning/academyCardLayout';
import { ACADEMY_TYPE } from '../../components/learning/academyLayout';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  getAcademyCourseSubtitle,
  isComingSoonCourse,
  isNativeLearningCourse,
  selectAcademyCatalogCourses,
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
  const allowHeavy = useAllowAfterNavigationTransition();
  const { data: enrollments, isLoading, error, refetch } = useMyEnrollments({
    enabled: allowHeavy,
  });
  const catalogEnrollments = useMemo(
    () => selectAcademyCatalogCourses(enrollments ?? []),
    [enrollments],
  );
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
            <UIButton
              title={pct > 0 ? 'המשך למידה' : 'התחל'}
              variant="primary"
              fullWidth
              onPress={() => handleContinueLearning(item)}
            />
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
      <UIButton
        title="גלה קורסים"
        variant="primary"
        onPress={() => navigation.navigate('CoursesScreen')}
      />
    </View>
  );

  const renderStats = () => {
    if (catalogEnrollments.length === 0) return null;
    const totalCourses = catalogEnrollments.length;
    const completedCourses = catalogEnrollments.filter(c => c.progress?.progress_percentage === 100).length;
    const inProgressCourses = catalogEnrollments.filter(c =>
      c.progress && c.progress.progress_percentage > 0 && c.progress.progress_percentage < 100
    ).length;
    return (
      <UICard
        variant="soft"
        padding="lg"
        style={[{ marginHorizontal: ACADEMY_CARD_HP, marginBottom: APP_LAYOUT.cardStackGap }, academyCardFrameStyle('neutral')]}
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
      <ScreenChrome>
        <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>שגיאה בטעינת הקורסים</Text>
            <Text style={styles.errorMessage}>
              {error.message || 'אירעה שגיאה לא צפויה'}
            </Text>
            <UIButton title="נסה שוב" variant="primary" onPress={() => refetch()} />
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <AcademyScreenHeader onMenuPress={openMainDrawer} title="הלמידה שלי" />

        {/* Stats */}
        {renderStats()}

        {/* Courses List */}
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <FlatList
            data={catalogEnrollments}
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
          ListEmptyComponent={!isLoading && allowHeavy ? renderEmptyState : null}
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
      ...ACADEMY_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      ...ACADEMY_TYPE.cardMetricValueSecondary,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardMetricLabelToValueGap,
      textAlign: 'center',
    },
    statLabel: {
      ...ACADEMY_TYPE.cardMetricLabel,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    listContainer: {
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingTop: tokens.spacing.md,
      paddingBottom: tokens.spacing['5xl'],
    },
    courseContainer: {
      marginBottom: APP_LAYOUT.cardStackGap,
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
      ...ACADEMY_TYPE.caption2,
      color: tokens.colors.text.secondary,
      minWidth: 32,
      textAlign: 'right',
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
      ...ACADEMY_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
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
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
  });

