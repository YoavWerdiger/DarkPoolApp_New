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
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import UICard from '../../components/ui/UICard';

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

  const { data: coursesData, isLoading, error, refetch } = useCourses();

  // טעינת נתונים סטטיסטיים
  useEffect(() => {
    const loadStats = async () => {
      if (!user) {
        setIsLoadingStats(false);
        return;
      }

      try {
        setIsLoadingStats(true);
        const statsData = await learningProgressService.getUserLearningStats(user.id);
        
        // עדכון מספר הקורסים שנרשמת אליהם מהקורסים עצמם
        const enrolledCount = coursesData?.courses?.filter(course => course.enrollment).length || 0;
        
        setStats({
          ...statsData,
          enrolledCourses: enrolledCount,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [user, coursesData]); // נטען שוב כשמשתנים הקורסים

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
  }, [refetch]); // רק פעם אחת, לא תלוי ב-refetch

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
      (navigation as any).navigate('LearningScreen', { courseId: course.id });
    } else {
      // אחרת, נוביל ל-CourseDetailScreen
      (navigation as any).navigate('CourseDetailScreen', { courseId: course.id });
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
    // ה-FlatList כבר נותן paddingHorizontal דרך listContainer,
    // לכן כאן נותנים רק paddingTop כדי שהכרטיס יהיה בדיוק ברוחב כרטיסי הקורסים
    <View style={{ paddingTop: DesignTokens.spacing.lg }}>
      <UICard
        variant="blur"
        padding="lg"
        style={{ marginBottom: DesignTokens.spacing.lg, width: '100%' }}
      >
        <View style={{ gap: DesignTokens.spacing.md }}>
          <Text style={styles.heroTitle}>האקדמיה של DarkPool</Text>
          <Text style={styles.heroSubtitle}>
            מקום אחד לכל מה שצריך לדעת על מסחר והשקעות
          </Text>
          
          <View style={styles.heroStats}>
            <UICard variant="blur" padding="md" style={{ flex: 1 }}>
              <View style={styles.statCard}>
                <GraduationCap size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                <Text style={styles.statValue}>
                  {isLoadingStats ? '...' : stats.enrolledCourses}
                </Text>
                <Text style={styles.statLabel}>קורסים שלי</Text>
              </View>
            </UICard>
            
            <UICard variant="blur" padding="md" style={{ flex: 1 }}>
              <View style={styles.statCard}>
                <BookCheck size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                <Text style={styles.statValue}>
                  {isLoadingStats ? '...' : stats.completedLessons}
                </Text>
                <Text style={styles.statLabel}>שיעורים הושלמו</Text>
              </View>
            </UICard>
            
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MyNotesScreen' as never)}
            >
              <UICard variant="blur" padding="md" style={{ flex: 1 }}>
                <View style={styles.statCard}>
                  <FileText size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                  <Text style={styles.statValue}>
                    {isLoadingStats ? '...' : stats.totalNotes}
                  </Text>
                  <Text style={styles.statLabel}>הערות שלי</Text>
                </View>
              </UICard>
            </TouchableOpacity>
          </View>
        </View>
      </UICard>
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
          ListHeaderComponent={renderHero}
        />
      </RNSafeAreaView>
    </View>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  listContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing['3xl'],
  },
  heroTitle: {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold as any,
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
    alignItems: 'center',
    gap: tokens.spacing.xs / 2,
  },
  statValue: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    marginTop: tokens.spacing.xs / 2,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    fontWeight: tokens.typography.fontWeight.medium as any,
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
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
  },
});
