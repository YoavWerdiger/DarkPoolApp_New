import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { CourseCard } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, FileText, BookCheck } from 'lucide-react-native';
import { learningProgressService } from '../../services/learningProgressService';
import { SafeAreaView } from 'react-native-safe-area-context';

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalCourses: 0,
    enrolledCourses: 0,
    completedLessons: 0,
    totalLessons: 0,
    totalNotes: 0,
    totalWatchTime: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // טעינת סטטיסטיקות
  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) {
        setIsLoadingStats(false);
        return;
      }

      try {
        setIsLoadingStats(true);
        const userStats = await learningProgressService.getUserLearningStats(user.id);
        setStats(userStats);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [user?.id, coursesData]);

  // וידוא שהקורסים נוצרו כשהמסך נטען (רק פעם אחת)
  useEffect(() => {
    let isMounted = true;
    const initializeCourses = async () => {
      try {
        // בדיקה אם קורס הכשרה של דוד קיים
        const davidCourse = await courseService.getCourseById('david-training-course');
        
        if (!isMounted) return;
        
        if (!davidCourse) {
          console.log('⚠️ CoursesScreen: David Training course not found in database');
          // ננסה ליצור אותו דרך ה-API (אם יש הרשאות)
          try {
            const created = await courseService.createDavidTrainingCourse();
            if (created && isMounted) {
              console.log('✅ CoursesScreen: David Training course created successfully');
              setTimeout(() => {
                if (isMounted) refetch();
              }, 1000);
            }
          } catch (createError: any) {
            console.warn('⚠️ CoursesScreen: Cannot create course via API (RLS issue). Please use SQL script.');
          }
        }
      } catch (error) {
        console.error('🎓 CoursesScreen: Error checking courses:', error);
      }
    };

    initializeCourses();
    
    return () => {
      isMounted = false;
    };
  }, []); // רק פעם אחת, לא תלוי ב-refetch

  const { data: coursesData, isLoading, error, refetch } = useCourses();

  const enrollMutation = useEnrollInCourse();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    // אם זה קורס הלוויתנים או קורס דוד איראל, נוביל ל-LearningScreen
    if (course.slug === 'whales-course' || course.id === 'whales-course-1' || course.title === 'קורס הלוויתנים' ||
        course.id === 'david-training-course' || course.title === 'הכשרה של דוד אריאל') {
      navigation.navigate('LearningScreen' as never, { courseId: course.id } as never);
    } else {
      // אחרת, נוביל ל-CourseDetailScreen
    navigation.navigate('CourseDetailScreen' as never, { courseId: course.id } as never);
    }
  }, [navigation]);

  const handleEnroll = useCallback(async (course: CourseWithProgress) => {
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
  }, [enrollMutation]);

  const renderCourse = useCallback(({ item }: { item: CourseWithProgress }) => (
    <CourseCard
      course={item}
      onPress={handleCoursePress}
      onEnroll={item.enrollment ? undefined : handleEnroll}
      hideBadges={true}
    />
  ), [handleCoursePress, handleEnroll]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📚</Text>
      <Text style={styles.emptyStateTitle}>לא נמצאו קורסים</Text>
      <Text style={styles.emptyStateSubtitle}>
        אין קורסים זמינים כרגע
      </Text>
    </View>
  );

  const renderHero = useCallback(() => (
    <View style={styles.heroContainer}>
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>האקדמיה של DarkPool</Text>
        <Text style={styles.heroSubtitle}>
          מקום אחד לכל מה שצריך לדעת על מסחר והשקעות
        </Text>
        
        <View style={styles.heroStats}>
          <View style={styles.statCard}>
            <GraduationCap size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            <Text style={styles.statValue}>
              {isLoadingStats ? '...' : stats.enrolledCourses}
            </Text>
            <Text style={styles.statLabel}>קורסים שלי</Text>
          </View>
          
          <View style={styles.statCard}>
            <BookCheck size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            <Text style={styles.statValue}>
              {isLoadingStats ? '...' : stats.completedLessons}
            </Text>
            <Text style={styles.statLabel}>שיעורים הושלמו</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MyNotesScreen' as never)}
          >
            <FileText size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            <Text style={styles.statValue}>
              {isLoadingStats ? '...' : stats.totalNotes}
            </Text>
            <Text style={styles.statLabel}>הערות שלי</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [stats, isLoadingStats, DesignTokens, styles, navigation]);

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
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.safeAreaContent}>
          {renderHero()}
        </View>
      </SafeAreaView>
      <FlatList
        data={coursesData?.courses || []}
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
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  safeArea: {
    backgroundColor: tokens.colors.background.secondary,
    borderBottomLeftRadius: tokens.borderRadius.lg,
    borderBottomRightRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  safeAreaContent: {
    paddingHorizontal: tokens.spacing.md,
  },
  listContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing['3xl'],
  },
  heroContainer: {
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.background.secondary,
    marginBottom: tokens.spacing.md,
    marginHorizontal: -tokens.spacing.md,
  },
  heroContent: {
    gap: tokens.spacing.md,
  },
  heroTitle: {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    letterSpacing: -0.5,
    marginBottom: 0,
  },
  heroSubtitle: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.lineHeight.relaxed * tokens.typography.fontSize.base,
    marginBottom: tokens.spacing.sm,
  },
  heroStats: {
    flexDirection: 'row-reverse',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.xs / 2,
  },
  statValue: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    marginTop: tokens.spacing.xs / 2,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    fontWeight: tokens.typography.fontWeight.medium,
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
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
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
    color: tokens.colors.text.primary,
  },
});
