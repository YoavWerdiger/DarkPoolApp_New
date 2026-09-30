import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { useAllowAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import {
  AcademyScreenHeader,
  CourseCard,
} from '../../components/learning';
import { ACADEMY_CARD_HP } from '../../components/learning/academyCardLayout';
import {
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  isComingSoonCourse,
  isNativeLearningCourse,
  selectAcademyCatalogCourses,
  DAVID_TRAINING_COURSE_ID,
  ORACLE_COURSE_ID,
} from '../../components/learning/academyCourses';
import { MAIN_SCREEN_HEADER_HP, ScreenChrome } from '../../components/ui';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { prefetchAcademyCovers } from '../../services/appPrefetch';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  ACADEMY_TYPE,
  academySectionTitleStyle,
} from '../../components/learning/academyLayout';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

type Nav = { navigate: (n: string, p?: object) => void };

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const { width: screenWidth } = useWindowDimensions();
  const horizontalCardWidth = Math.min(320, Math.round(screenWidth * 0.78));
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const { data: coursesData, isPending, error, refetch } = useCourses();
  const courses = coursesData?.courses ?? [];
  const showInitialLoader = isPending && courses.length === 0;
  const allowHeavy = useAllowAfterNavigationTransition();

  // חימום באנרים ברגע שיש נתונים (גם מ-cache) — אחרי סיום מעבר
  useEffect(() => {
    if (!allowHeavy) return;
    if (courses.length === 0) return;
    void prefetchAcademyCovers(courses);
  }, [allowHeavy, courses]);

  // Seed רק אם חסרים קורסי ליבה ברשימה — בלי getCourseById כפול על כל mount
  useEffect(() => {
    if (!allowHeavy) return;
    if (isPending && courses.length === 0) return;
    let isMounted = true;
    const ids = new Set(courses.map((c) => c.id));
    const initializeCourses = async () => {
      try {
        let needsRefetch = false;
        if (!ids.has(DAVID_TRAINING_COURSE_ID)) {
          try {
            if (await courseService.createDavidTrainingCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (!ids.has('whales-course-1') && !ids.has('whales-course')) {
          try {
            if (await courseService.createWhalesCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (!ids.has(ORACLE_COURSE_ID)) {
          try {
            if (await courseService.createOracleCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (needsRefetch && isMounted) {
          void refetch();
        }
      } catch {
        /* noop */
      }
    };
    void initializeCourses();
    return () => {
      isMounted = false;
    };
  }, [allowHeavy, courses, isPending, refetch]);

  const enrollMutation = useEnrollInCourse();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
      void HapticFeedback.impactLight();
    }
  }, [refetch]);

  const handleCoursePress = useCallback(
    (course: CourseWithProgress) => {
      const nav = navigation as Nav;
      if (isComingSoonCourse(course)) {
        nav.navigate('CourseComingSoonScreen', {
          courseId: course.id,
          title: course.title,
          subtitle: getAcademyCourseSubtitle(course),
          coverUrl: course.cover_url ?? undefined,
        });
        return;
      }
      if (isNativeLearningCourse(course)) {
        nav.navigate('LearningScreen', { courseId: course.id });
      } else {
        nav.navigate('CourseDetailScreen', { courseId: course.id });
      }
    },
    [navigation]
  );

  const handleOpenNotes = useCallback(() => {
    void HapticFeedback.impactLight();
    (navigation as Nav).navigate('MyNotesScreen');
  }, [navigation]);

  const handleEnroll = useCallback(
    async (course: CourseWithProgress) => {
      if (getAcademyCourseTier(course as CourseWithProgress & { price?: number }) === 'premium') {
        legacyAlert('קורס בתשלום', 'קורס זה דורש תשלום. התכונה תהיה זמינה בקרוב.', [{ text: 'אישור' }]);
        return;
      }
      try {
        await enrollMutation.mutateAsync(course.id);
        void HapticFeedback.success();
        legacyAlert('הצלחה!', 'נרשמת בהצלחה לקורס', [{ text: 'אישור' }]);
      } catch {
        legacyAlert('שגיאה', 'לא ניתן להירשם לקורס כרגע. נסה שוב מאוחר יותר.', [{ text: 'אישור' }]);
      }
    },
    [enrollMutation]
  );

  const orderedCourses = useMemo(() => selectAcademyCatalogCourses(courses), [courses]);
  const isSearching = searchQuery.trim().length > 0;
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedCourses;
    return orderedCourses.filter((c) => {
      const hay = [c.title, c.subtitle, getAcademyCourseSubtitle(c), c.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orderedCourses, searchQuery]);

  const renderHorizontalRow = (list: CourseWithProgress[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalScroll}
      contentContainerStyle={styles.horizontalList}
      decelerationRate="fast"
      snapToInterval={horizontalCardWidth + APP_LAYOUT.cardStackGap}
      snapToAlignment="start"
      disableIntervalMomentum
    >
      {list.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          width={horizontalCardWidth}
          onPress={handleCoursePress}
          onEnroll={course.enrollment ? undefined : handleEnroll}
        />
      ))}
    </ScrollView>
  );

  if (error) {
    return (
      <ScreenChrome>
        <RNSafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.errorInner}>
            <UICard variant="soft" padding="lg" style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={48} color={DesignTokens.colors.text.danger} />
              <Text style={[styles.errorTitle, { color: DesignTokens.colors.text.primary }]}>
                שגיאה בטעינת הקורסים
              </Text>
              <Text style={[styles.errorMessage, { color: DesignTokens.colors.text.secondary }]}>
                {error.message || 'אירעה שגיאה לא צפויה'}
              </Text>
              <UIButton title="נסה שוב" variant="primary" onPress={() => refetch()} />
            </UICard>
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: mainTabsHeight + 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
            />
          }
        >
          <AcademyScreenHeader onMenuPress={openMainDrawer} title="האקדמיה" />

          {!showInitialLoader ? (
            <View style={styles.toolbar}>
              <DayNavBlurButton
                onPress={handleOpenNotes}
                size={44}
                glassIntensity="subtle"
                accessibilityLabel="ההערות שלי"
                style={styles.notesBtn}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={DesignTokens.colors.text.primary}
                />
              </DayNavBlurButton>

              <View style={styles.searchWrap}>
                <UICard variant="soft" padding="none" style={[styles.searchCard, styles.searchCardFill]}>
                  <View style={styles.searchInner}>
                    {isSearching ? (
                      <TouchableOpacity
                        onPress={() => setSearchQuery('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="נקה חיפוש"
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={DesignTokens.colors.text.tertiary}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.searchClearSpacer} />
                    )}
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="חיפוש קורסים..."
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      style={styles.searchInput}
                      returnKeyType="search"
                      accessibilityLabel="חיפוש קורסים"
                    />
                    <Ionicons
                      name="search"
                      size={18}
                      color={DesignTokens.colors.text.tertiary}
                    />
                  </View>
                </UICard>
              </View>
            </View>
          ) : null}

          {showInitialLoader ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={styles.loadingHint}>טוען קורסים…</Text>
            </View>
          ) : filteredCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name={isSearching ? 'search-outline' : 'library-outline'}
                  size={40}
                  color={DesignTokens.colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyStateTitle}>
                {isSearching ? 'אין תוצאות לחיפוש' : 'אין קורסים להצגה'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {isSearching ? 'נסה מילה אחרת או נקה את החיפוש' : 'נסה שוב מאוחר יותר'}
              </Text>
            </View>
          ) : (
            <View style={styles.sections}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>קורסים מלאים</Text>
                {renderHorizontalRow(filteredCourses)}
              </View>
            </View>
          )}
        </ScrollView>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    toolbar: {
      // כמו חדשות: כפתור משמאל, חיפוש מימין — direction:ltr מונע היפוך RTL
      flexDirection: 'row',
      direction: 'ltr',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      marginTop: 4,
      marginBottom: tokens.spacing.md,
    },
    notesBtn: {
      flexShrink: 0,
      zIndex: 2,
    },
    searchWrap: {
      flex: 1,
      minWidth: 0,
    },
    searchCard: {
      borderRadius: tokens.borderRadius.full,
      overflow: 'hidden',
    },
    searchCardFill: {
      backgroundColor: tokens.colors.background.cardSolid,
      borderWidth: 0,
    },
    searchInner: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: 44,
    },
    searchClearSpacer: {
      width: 20,
    },
    searchInput: {
      flex: 1,
      marginHorizontal: 8,
      color: tokens.colors.text.primary,
      ...ACADEMY_TYPE.body,
      textAlign: 'right',
      writingDirection: 'rtl',
      paddingVertical: 6,
    },
    sections: {
      width: '100%',
      gap: APP_LAYOUT.sectionGap,
    },
    section: {
      width: '100%',
      gap: APP_LAYOUT.sectionHeaderToContent,
    },
    sectionTitle: {
      ...academySectionTitleStyle,
      color: tokens.colors.text.primary,
      paddingHorizontal: ACADEMY_CARD_HP,
    },
    horizontalScroll: {
      direction: 'rtl',
    },
    horizontalList: {
      paddingHorizontal: ACADEMY_CARD_HP,
      gap: APP_LAYOUT.cardStackGap,
      flexDirection: 'row',
    },
    loadingWrap: {
      paddingTop: tokens.spacing['2xl'],
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    loadingHint: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: tokens.spacing['4xl'],
      paddingHorizontal: ACADEMY_CARD_HP,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      borderColor: tokens.colors.border.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.04)',
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
    },
    errorInner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: ACADEMY_CARD_HP,
    },
    errorCard: {
      alignItems: 'center',
      gap: tokens.spacing.md,
      borderRadius: UI_CARD_RADIUS,
    },
    errorTitle: {
      ...ACADEMY_TYPE.cardTitle,
      textAlign: 'center',
    },
    errorMessage: {
      ...ACADEMY_TYPE.body,
      textAlign: 'center',
    },
  });
