import { ROOT_DIR, UI_DIR, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { appLocale } from '../../lib/i18n/locale';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Dimensions, Platform, TextInput, TouchableWithoutFeedback, Keyboard, Modal, Linking, ActivityIndicator, useWindowDimensions, RefreshControl } from 'react-native';
// import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui';
import { AcademySubScreenBar, CourseListHero, LessonRow, LessonRowSkeleton } from '../../components/learning';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import type { CourseListResponse } from '../../types/learning';
import { formatLessonMinutes } from '../../components/learning/academyCourses';
import { LinearGradient } from 'expo-linear-gradient';
import { ACADEMY_CARD_HP, ACADEMY_CARD_RADIUS, academyCardWidth } from '../../components/learning/academyCardLayout';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAllowAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { appGroupLabelStyle, appPhysicalRightText } from '../../components/ui/appType';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  ACADEMY_TYPE,
  academySectionTitleStyle,
} from '../../components/learning/academyLayout';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { Ionicons } from '@expo/vector-icons';
import {
  XCircle,
  CheckCircle2,
  RefreshCw,
  Edit3,
  ChevronUp,
  ChevronDown,
  Save,
  Type,
  ImageIcon,
  Palette,
  PlusCircle,
  Star,
  Clock,
  TrendingUp,
  Video as VideoIcon,
} from 'lucide-react-native';
import { ArrowRight, ChevronLeft, ChevronRight } from '../../lib/i18n/dirIcons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { learningProgressService } from '../../services/learningProgressService';
import { AUTO_SEED_CORE_COURSES, courseService } from '../../services/courseService';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { CourseTeaserLock, isCourseTeaserLocked } from '../../components/learning/CourseTeaserLock';
import { CourseCompletionOverlay } from '../../components/learning/CourseCompletionOverlay';
import { BlurTargetView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');

/** טקסט עברי בתוך עץ RTL */
const rtlText = {
  writingDirection: TEXT_DIR,
  textAlign: 'left' as const,
};

const DEMO_COURSE = {
  id: 'demo-course-1',
  title: i18n.t('auto.screens__Learning__LearningScreen.s1'),
  description:
    i18n.t('auto.screens__Learning__LearningScreen.s2'),
  cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/whales-course-cover-2026-10.jpg`,
    instructor: {
      name: i18n.t('auto.screens__Learning__LearningScreen.s3'),
      avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
    rating: 4.9,
    students: 1250
  },
  duration: i18n.t('auto.screens__Learning__LearningScreen.s4'),
  level: i18n.t('auto.screens__Learning__LearningScreen.s5'),
  rating: 4.8,
  students: 1250,
  lessons: [
    {
      id: 'lesson-1',
      title: i18n.t('auto.screens__Learning__LearningScreen.s6'),
      duration: '01:20',
      description: i18n.t('auto.screens__Learning__LearningScreen.s7'),
      completed: true,
      type: 'video',
        vimeoId: '1095579213',
        thumbnail: 'https://vumbnail.com/1095579213.jpg',
        videoUrl: 'https://vimeo.com/1095579213?share=copy'
    },
    {
      id: 'lesson-2', 
      title: i18n.t('auto.screens__Learning__LearningScreen.s8'),
      duration: '03:28',
      description: i18n.t('auto.screens__Learning__LearningScreen.s9'),
      completed: false,
      type: 'video',
      vimeoId: '1095573038',
      thumbnail: 'https://vumbnail.com/1095573038.jpg',
      videoUrl: 'https://vimeo.com/1095573038?share=copy'
    },
    {
      id: 'lesson-3',
      title: i18n.t('auto.screens__Learning__LearningScreen.s10'),
      duration: '21:49', 
      description: i18n.t('auto.screens__Learning__LearningScreen.s11'),
      completed: false,
      type: 'video',
      vimeoId: '1095570862',
      thumbnail: 'https://vumbnail.com/1095570862.jpg',
      videoUrl: 'https://vimeo.com/1095570862?share=copy'
    },
    {
      id: 'lesson-4',
      title: i18n.t('auto.screens__Learning__LearningScreen.s12'),
      duration: '21:41',
      description: i18n.t('auto.screens__Learning__LearningScreen.s13'),
      completed: false,
      type: 'video',
      vimeoId: '1095761556',
      thumbnail: 'https://vumbnail.com/1095761556.jpg',
      videoUrl: 'https://vimeo.com/1095761556?share=copy'
    },
    {
      id: 'lesson-5',
      title: i18n.t('auto.screens__Learning__LearningScreen.s14'),
      duration: '09:37',
      description: i18n.t('auto.screens__Learning__LearningScreen.s15'),
      completed: false,
      type: 'video',
      vimeoId: '1095760652',
      thumbnail: 'https://vumbnail.com/1095760652.jpg',
      videoUrl: 'https://vimeo.com/1095760652?share=copy'
    },
    {
      id: 'lesson-6',
      title: i18n.t('auto.screens__Learning__LearningScreen.s16'),
      duration: '24:15',
      description: i18n.t('auto.screens__Learning__LearningScreen.s17'),
      completed: false,
      type: 'video',
      vimeoId: '1095776680',
      thumbnail: 'https://vumbnail.com/1095776680.jpg',
      videoUrl: 'https://vimeo.com/1095776680?share=copy'
    },
    {
      id: 'lesson-7',
      title: i18n.t('auto.screens__Learning__LearningScreen.s18'),
      duration: '09:13',
      description: i18n.t('auto.screens__Learning__LearningScreen.s19'),
      completed: false,
      type: 'video',
      vimeoId: '1099364716',
      thumbnail: 'https://vumbnail.com/1099364716.jpg',
      videoUrl: 'https://vimeo.com/1099364716?share=copy'
    },
    {
      id: 'lesson-8',
      title: i18n.t('auto.screens__Learning__LearningScreen.s20'),
      duration: '47:49',
      description: i18n.t('auto.screens__Learning__LearningScreen.s21'),
      completed: false,
      type: 'video',
      vimeoId: '1108814085',
      thumbnail: 'https://vumbnail.com/1108814085.jpg',
      videoUrl: 'https://vimeo.com/1108814085?share=copy'
    },
    {
      id: 'lesson-9',
      title: i18n.t('auto.screens__Learning__LearningScreen.s22'),
      duration: '07:07',
      description: i18n.t('auto.screens__Learning__LearningScreen.s23'),
      completed: false,
      type: 'video',
      vimeoId: '1095763209',
      thumbnail: 'https://vumbnail.com/1095763209.jpg',
      videoUrl: 'https://vimeo.com/1095763209?share=copy'
    }
  ]
};

/** פרקים לפי section_index/section_title מהמסד (שומר על סדר השיעורים) */
function groupLessonsBySection(lessons: any[]) {
  const out: { index: number; title: string; lessons: any[]; startIndex: number }[] = [];
  lessons.forEach((lesson, i) => {
    const idx = typeof lesson.section_index === 'number' ? lesson.section_index : 0;
    const last = out[out.length - 1];
    if (last && last.index === idx) last.lessons.push(lesson);
    else out.push({ index: idx, title: lesson.section_title || '', lessons: [lesson], startIndex: i });
  });
  return out;
}

function LearningScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const mainTabsHeight = useMainTabsHeight();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const courseHeroHeight = Math.round(windowHeight * 0.42);
  const { courseId: routeCourseId, lessonId: routeLessonId } = route.params as { courseId?: string; lessonId?: string } || {};
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const handleBackToAcademy = useCallback(() => {
    (navigation as { navigate: (n: string) => void }).navigate('CoursesScreen');
  }, [navigation]);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lessonProgress, setLessonProgress] = useState(0); // התקדמות השיעור הנוכחי
  const [totalProgress, setTotalProgress] = useState(0); // התקדמות כללית של הקורס
  const [userNotes, setUserNotes] = useState(''); // הערות המשתמש
  // הערות בתוך דף השיעור — נשמרות אוטומטית
  const [notesSaveState, setNotesSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const notesBaselineRef = useRef(''); // הטקסט האחרון שנשמר / נטען
  const notesLessonIdRef = useRef<string | null>(null); // השיעור שההערות הנוכחיות שייכות אליו
  const notesPendingRef = useRef<{ lessonId: string; text: string } | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState(DesignTokens.colors.text.primary);
  const [richTextContent, setRichTextContent] = useState<any[]>([]);
  const [currentFormatting, setCurrentFormatting] = useState({
    bold: false,
    color: DesignTokens.colors.text.primary,
    link: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [courseData, setCourseData] = useState<any>(null); // נתוני הקורס מהמסד
  const [lessonsData, setLessonsData] = useState<any[]>([]); // נתוני השיעורים מהמסד
  /** טעינת רשימת השיעורים — כדי להציג פרוגרס גם לפני סיום ולא 0/0 מטעה */
  const [lessonsProgressLoading, setLessonsProgressLoading] = useState(false);
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoWebViewRef = useRef<any>(null);
  const [initialVideoPosition, setInitialVideoPosition] = useState<number>(0);
  const [animatedValues, setAnimatedValues] = useState<Animated.Value[]>([]);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isYouTubePlayerReady, setIsYouTubePlayerReady] = useState(false);
  const allowHeavy = useAllowAfterNavigationTransition();
  const durationUpdatedRef = useRef<Set<string>>(new Set()); // מעקב אחרי שיעורים שכבר עדכנו את ה-duration
  const durationCheckInProgressRef = useRef<Set<string>>(new Set()); // מעקב אחרי שיעורים שבתהליך בדיקה
  const lastProgressSaveTimeRef = useRef<number>(0); // מעקב אחרי הזמן האחרון שעודכן במסד נתונים
  const lastProgressPercentageRef = useRef<number>(0); // מעקב אחרי האחוז האחרון (למניעת קפיצות ל-0)
  // רשימת השיעורים: כפתור גלילה לראש (מופיע אחרי גלילה)
  const courseListScrollRef = useRef<ScrollView>(null);
  const [showCourseScrollTop, setShowCourseScrollTop] = useState(false);
  const courseScrollTopOpacity = useRef(new Animated.Value(0)).current;
  const courseScrollTopShownRef = useRef(false);
  // פס גלילה משלנו בצד שמאל (המובנה של iOS תמיד בימין)
  const courseScrollY = useRef(new Animated.Value(0)).current;
  const courseIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const [courseViewportH, setCourseViewportH] = useState(0);
  const [courseContentH, setCourseContentH] = useState(0);
  const showCourseIndicator = useCallback(() => {
    courseIndicatorOpacity.stopAnimation();
    Animated.timing(courseIndicatorOpacity, { toValue: 1, duration: 120, useNativeDriver: false }).start();
  }, [courseIndicatorOpacity]);
  const hideCourseIndicator = useCallback(() => {
    Animated.timing(courseIndicatorOpacity, { toValue: 0, duration: 300, delay: 700, useNativeDriver: false }).start();
  }, [courseIndicatorOpacity]);

  // כפתור הקפיצה: לשיעור האחרון שהושלם (ההתקדמות). בלי התקדמות — לראש הרשימה.
  const courseScrollYRef = useRef(0);
  const courseViewportHRef = useRef(0);
  const courseContentRef = useRef<View>(null);
  const lessonNodeRefs = useRef(new Map<string, View>());
  const progressTargetYRef = useRef<number | null>(null);
  const [courseJumpDir, setCourseJumpDir] = useState<'up' | 'down'>('up');

  const updateCourseJumpButton = useCallback(() => {
    const y = courseScrollYRef.current;
    const vh = courseViewportHRef.current;
    const target = progressTargetYRef.current;
    let shouldShow: boolean;
    let dir: 'up' | 'down' = 'up';
    if (target == null) {
      shouldShow = y > 400;
    } else {
      const inView = target >= y && target + 140 <= y + vh;
      shouldShow = vh > 0 && !inView;
      dir = target < y ? 'up' : 'down';
    }
    setCourseJumpDir((prev) => (prev === dir ? prev : dir));
    if (shouldShow === courseScrollTopShownRef.current) return;
    courseScrollTopShownRef.current = shouldShow;
    setShowCourseScrollTop(shouldShow);
    Animated.timing(courseScrollTopOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [courseScrollTopOpacity]);

  const handleCourseListScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      courseScrollY.setValue(e.nativeEvent.contentOffset.y);
      courseScrollYRef.current = e.nativeEvent.contentOffset.y;
      updateCourseJumpButton();
    },
    [courseScrollY, updateCourseJumpButton],
  );

  /** מיקום השיעור האחרון שהושלם בתוך תוכן הרשימה */
  const measureProgressTarget = useCallback(() => {
    const lessons = Array.isArray(lessonsData) ? lessonsData : [];
    let lastDone: any = null;
    for (const l of lessons) if (l?.completed) lastDone = l;
    const node = lastDone ? lessonNodeRefs.current.get(lastDone.id) : null;
    const content = courseContentRef.current;
    if (!node || !content) {
      progressTargetYRef.current = null;
      updateCourseJumpButton();
      return;
    }
    node.measureLayout(
      content as any,
      (_x: number, y: number) => {
        progressTargetYRef.current = y;
        updateCourseJumpButton();
      },
      () => undefined,
    );
  }, [lessonsData, updateCourseJumpButton]);

  useEffect(() => {
    const t = setTimeout(measureProgressTarget, 50);
    return () => clearTimeout(t);
  }, [measureProgressTarget]);

  const handleCourseJumpPress = useCallback(() => {
    void HapticFeedback.impactLight();
    const target = progressTargetYRef.current;
    courseListScrollRef.current?.scrollTo({ y: target == null ? 0 : Math.max(0, target - 12), animated: true });
  }, []);

  // מסך סיום קורס (קונפטי) — רק כשהשיעור האחרון הושלם עכשיו, לא כשנכנסים לקורס שכבר הושלם
  const [showCourseComplete, setShowCourseComplete] = useState(false);
  const courseCompleteArmedRef = useRef<boolean | null>(null);
  const availableLessonsCount = (Array.isArray(lessonsData) ? lessonsData : []).filter((l: any) => !l?.comingSoon).length;
  // פיתוח בלבד: EXPO_PUBLIC_PREVIEW_COURSE_COMPLETE=1 — מציג את מסך סיום הקורס מיד כשהשיעורים נטענים (לבדיקת עיצוב)
  useEffect(() => {
    if (!__DEV__ || process.env.EXPO_PUBLIC_PREVIEW_COURSE_COMPLETE !== '1') return;
    if (availableLessonsCount > 0) setShowCourseComplete(true);
  }, [availableLessonsCount]);
  useEffect(() => {
    const available = (Array.isArray(lessonsData) ? lessonsData : []).filter((l: any) => !l?.comingSoon);
    if (!user || available.length === 0) return;
    const allDone = available.every((l: any) => l.completed);
    if (courseCompleteArmedRef.current === null) {
      courseCompleteArmedRef.current = !allDone;
      return;
    }
    if (!allDone) {
      courseCompleteArmedRef.current = true;
      return;
    }
    if (courseCompleteArmedRef.current && !selectedLesson) {
      courseCompleteArmedRef.current = false;
      setShowCourseComplete(true);
    }
  }, [lessonsData, selectedLesson, user]);

  /** אחרי יציאה משיעור — מרעננים את סטטוס ההשלמה (הושלם אוטומטית ב-95% צפייה) */
  const refreshLessonCompleted = useCallback(
    async (lessonId: string) => {
      if (!user || !routeCourseId) return;
      try {
        const p = await learningProgressService.getUserProgress(user.id, routeCourseId, lessonId);
        if (!p?.is_completed) return;
        setLessonsData((prev: any[]) =>
          prev.map((l: any) => (l.id === lessonId && !l.completed ? { ...l, completed: true } : l)),
        );
      } catch {
        /* noop */
      }
    },
    [user, routeCourseId],
  );

  // מעקב התקדמות YouTube דרך interval
  useEffect(() => {
    // ניקוי interval קודם אם קיים
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (selectedLesson && youtubePlayerRef.current && isYouTubePlayerReady) {
      const isYouTube = !!(selectedLesson.youtubeId || selectedLesson.youtubeUrl);
      if (isYouTube) {
        // התחלת מעקב התקדמות דרך getCurrentTime ו-getDuration
        progressIntervalRef.current = setInterval(async () => {
          // בדיקה אם ה-ref עדיין קיים
          if (!youtubePlayerRef.current) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            return;
          }
          
          try {
            const currentTime = await youtubePlayerRef.current.getCurrentTime();
            const duration = await youtubePlayerRef.current.getDuration();
            
            // עדכון גם אם הסרטון לא מנגן (כדי לראות את המיקום)
            if (duration > 0 && currentTime >= 0) {
              setProgress(currentTime);
              setDuration(duration);
              const progressPercentage = Math.round((currentTime / duration) * 100);
              
              // בדיקה שהפרוגרס תקין ולא קופץ ל-0 (למניעת קפיצות)
              if (progressPercentage >= 0 && progressPercentage <= 100) {
                // אם הפרוגרס קופץ ל-0 בעוד שהיה ערך לפני, נשמור את הערך הקודם
                if (progressPercentage === 0 && lastProgressPercentageRef.current > 0 && currentTime > 1) {
                  // לא נעדכן אם הפרוגרס קופץ ל-0 בעוד שהזמן הנוכחי הוא יותר מ-1 שנייה
                } else {
                  setLessonProgress(progressPercentage);
                  lastProgressPercentageRef.current = progressPercentage;
                }
              }
              
              // עדכון duration במסד נתונים ובכרטיסיה אם זה שיעור YouTube
              if (selectedLesson && courseData && duration > 0) {
                const isYouTube = !!(selectedLesson.youtubeId || selectedLesson.youtubeUrl);
                if (isYouTube) {
                  // עדכון מיידי של ה-duration ב-lessonsData כדי שהכרטיסיה תתעדכן
                  const formatDuration = (seconds: number): string => {
                    const hours = Math.floor(seconds / 3600);
                    const remainingSeconds = seconds % 3600;
                    const minutes = Math.floor(remainingSeconds / 60);
                    const secs = remainingSeconds % 60;
                    
                    if (hours > 0) {
                      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    } else {
                      return `${minutes}:${secs.toString().padStart(2, '0')}`;
                    }
                  };
                  
                  const formattedDuration = formatDuration(duration);
                  
                  // עדכון lessonsData ישירות
                  setLessonsData((prevLessons: any[]) => {
                    const updated = prevLessons.map((lesson: any) => {
                      if (lesson.id === selectedLesson.id) {
                        return {
                          ...lesson,
                          duration: formattedDuration,
                          duration_seconds: duration
                        };
                      }
                      return lesson;
                    });
                    return updated;
                  });
                  
                  const lessonKey = `${courseData.id}_${selectedLesson.id}`;
                  // עדכון duration במסד נתונים רק פעם אחת לכל שיעור
                  if (!durationUpdatedRef.current.has(lessonKey) && !durationCheckInProgressRef.current.has(lessonKey)) {
                    durationCheckInProgressRef.current.add(lessonKey);
                    // בדיקה אם יש duration במסד נתונים
                    const checkAndUpdateDuration = async () => {
                      try {
                        const media = await mediaService.getLessonMedia(courseData.id, selectedLesson.id);
                        if (media && (!media.duration_minutes || media.duration_minutes === 0)) {
                          durationUpdatedRef.current.add(lessonKey);
                          // עדכון duration במסד נתונים
                          await mediaService.updateLessonDuration(courseData.id, selectedLesson.id, duration);
                        }
                      } catch (error) {
                      } finally {
                        durationCheckInProgressRef.current.delete(lessonKey);
                      }
                    };
                    checkAndUpdateDuration();
                  }
                }
              }
              
              // עדכון התקדמות במסד נתונים כל 5 שניות (רק כשמנגן)
              // שיפור: בודקים שהזמן השתנה ב-5 שניות לפחות מהעדכון האחרון
              const currentTimeInt = Math.floor(currentTime);
              if (isPlaying && currentTimeInt > 0 && currentTimeInt % 5 === 0 && currentTimeInt !== lastProgressSaveTimeRef.current) {
                lastProgressSaveTimeRef.current = currentTimeInt;
                updateLessonProgress(currentTime, duration);
              }
            }
          } catch (error) {
            // לא עוצרים את ה-interval גם אם יש שגיאה - מנסים שוב בפעם הבאה
          }
        }, 1000); // בדיקה כל שנייה
      }
    }
    
    // ניקוי ה-interval כשהקומפוננטה נסגרת או כשהשיעור משתנה
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // איפוס refs כשהקומפוננטה נסגרת
      lastProgressSaveTimeRef.current = 0;
      lastProgressPercentageRef.current = 0;
    };
  }, [selectedLesson?.id, isYouTubePlayerReady]);

  // משיכה לרענון — השיעורים נטענים רק בכניסה למסך, אז שינויים במסד (שיעור שהוסתר, סרטון חדש) מתעדכנים כאן
  const [refreshingLessons, setRefreshingLessons] = useState(false);
  const handleRefreshLessons = async () => {
    setRefreshingLessons(true);
    try {
      await loadCourseData();
    } finally {
      setRefreshingLessons(false);
      void HapticFeedback.impactLight();
    }
  };

  // טעינת נתונים מהמסד — אחרי סיום ה-slide, כדי לא לחנוק את המעבר
  useEffect(() => {
    if (!allowHeavy) return;
    loadCourseData();
  }, [allowHeavy, user, routeCourseId]);

  // פתיחת שיעור ספציפי אם יש lessonId
  useEffect(() => {
    if (routeLessonId && lessonsData.length > 0 && courseData) {
      const lesson = lessonsData.find((l: any) => l.id === routeLessonId);
      if (lesson) {
        // נשתמש ב-handleLessonPress כדי לפתוח את השיעור
        const lessonIndex = lessonsData.findIndex((l: any) => l.id === routeLessonId);
        if (lessonIndex !== -1) {
          handleLessonPress(lesson, lessonIndex);
        }
      }
    }
  }, [routeLessonId, lessonsData, courseData]);

  // טעינת נתוני הקורס
  const loadCourseData = async () => {
    if (!routeCourseId) {
      return;
    }
    setLessonsProgressLoading(true);
    try {
      // נטען את הקורס מהמסד (או ניצור אותו אם לא קיים)
      const courseId = routeCourseId;
      let course = await courseService.getCourseById(courseId);
      
      if (!course && AUTO_SEED_CORE_COURSES) {
        // אם הקורס לא קיים, ניצור אותו בהתאם לסוג הקורס
        if (courseId === 'david-training-course' || courseId === 'david-training-course-1') {
          await courseService.createDavidTrainingCourse();
        } else {
          await courseService.createWhalesCourse();
        }
        course = await courseService.getCourseById(courseId);
        
        // ניצור גם את קישורי המדיה
        if (course) {
          if (courseId === 'david-training-course' || courseId === 'david-training-course-1') {
            // קישורי המדיה של דוד איראל נוצרים יחד עם השיעורים
          } else {
            await mediaService.createWhalesCourseMedia(courseId);
          }
        }
      }

      if (course) {
        setCourseData(course);
        
        // נטען את השיעורים
        const lessons = await courseService.getCourseLessons(courseId);
        
        if (lessons && lessons.length > 0) {
          // נטען את קישורי המדיה לכל השיעורים בבת אחת
          const mediaLinks = await mediaService.getCourseMedia(courseId);
          
          // נטען את ההתקדמות של כל שיעור ואת קישורי המדיה
          const updatedLessons = await Promise.all(
            lessons.map(async (lesson: any) => {
              const userProgress = user ? await learningProgressService.getUserProgress(user.id, courseId, lesson.id) : null;
              const media = mediaLinks.find(m => m.lesson_id === lesson.id);
              
              // חישוב משך הזמן - נשתמש בנתונים האמיתיים מ-DEMO_COURSE או מהמסד נתונים
              let duration = '';
              
              
              // נחפש את השיעור בנתונים האמיתיים
              // אורך אמיתי מהמסד (מ-Vimeo); נתוני הדמו רק כגיבוי
              const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
              duration =
                formatLessonMinutes(media?.duration_minutes) ||
                formatLessonMinutes(lesson.duration_minutes) ||
                demoLesson?.duration ||
                '';
              
              // נשתמש ב-thumbnail מ-Vimeo או YouTube
              let thumbnailUrl = '';
              if (media?.thumbnail_url) {
                // תמונה שנשמרה מ-Vimeo — vumbnail לא עובד לסרטונים עם הגבלת הטמעה
                thumbnailUrl = media.thumbnail_url;
              } else if (media?.vimeo_id) {
                thumbnailUrl = `https://vumbnail.com/${media.vimeo_id}.jpg`;
              } else if (media?.youtube_id) {
                thumbnailUrl = `https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg`;
              } else if (lesson.youtubeId) {
                thumbnailUrl = `https://img.youtube.com/vi/${lesson.youtubeId}/maxresdefault.jpg`;
              }
              // בלי וידאו — בלי תמונה (placeholder בכרטיס)
              
              return {
                ...lesson,
                completed: userProgress?.is_completed || false,
                progress: userProgress?.progress_percentage || 0,
                vimeoId: media?.vimeo_id || undefined,
                youtubeId: media?.youtube_id || lesson.youtubeId || undefined,
                youtubeUrl: media?.youtube_url || lesson.youtubeUrl || undefined,
                thumbnail: thumbnailUrl,
                videoUrl: media?.vimeo_url || media?.youtube_url || `https://vimeo.com/${media?.vimeo_id || lesson.id}?share=copy`,
                duration: duration,
                type: 'video',
                // בלי וידאו עדיין (או מסומן בקרוב במסד) — מוצג «בקרוב» ולא נפתח
                comingSoon: !!lesson.is_coming_soon || !(media?.vimeo_id || media?.youtube_id || lesson.youtubeId),
              };
            })
          );
          setLessonsData(updatedLessons);
          // עדכון animatedValues למספר השיעורים
          setAnimatedValues(updatedLessons.map(() => new Animated.Value(1)));
        } else {
          // אם אין שיעורים במסד, לא נציג כלום
          setLessonsData([]);
          setAnimatedValues([]);
        }
        
        // נטען את ההתקדמות הכללית
        if (user) {
          const totalProgress = await learningProgressService.calculateUserCourseProgress(user.id, courseId);
          setTotalProgress(totalProgress);
        }
      } else {
        // אם אין קורס במסד, לא נציג כלום (לא DEMO_COURSE)
        setCourseData(null);
        setLessonsData([]);
        setTotalProgress(0);
      }
    } catch (error) {
      // אם יש שגיאה, לא נציג כלום (לא DEMO_COURSE)
      setCourseData(null);
      setLessonsData([]);
      setTotalProgress(0);
    } finally {
      setLessonsProgressLoading(false);
    }
  };

  // טעינת הערות משתמש
  const loadUserNotes = async (lessonId: string) => {
    if (!user || !courseData) return;
    const applyLoadedNotes = (text: string) => {
      notesBaselineRef.current = text;
      notesLessonIdRef.current = lessonId;
      setNotesSaveState('idle');
      setUserNotes(text);
    };
    
    try {
      const notes = await learningProgressService.getUserNotes(user.id, courseData.id, lessonId);
      if (notes && notes.notes_content) {
        // נסה לפרסר JSON, אם לא מצליח - השתמש בטקסט הרגיל
        try {
          const parsedContent = JSON.parse(notes.notes_content);
          if (Array.isArray(parsedContent)) {
            // זה תוכן ישן מהעורך העשיר - נמיר לטקסט רגיל
            const textContent = parsedContent
              .filter(element => element.type === 'text')
              .map(element => element.content)
              .join('\n');
            applyLoadedNotes(textContent);
          } else {
            applyLoadedNotes(notes.notes_content);
          }
        } catch {
          // זה טקסט רגיל
          applyLoadedNotes(notes.notes_content);
        }
      } else {
        applyLoadedNotes('');
      }
    } catch (error) {
      applyLoadedNotes('');
    }
  };

  // טעינת נתוני מדיה מהמסד
  const loadLessonMedia = async (lessonId: string) => {
    if (!courseData) return null;
    
    try {
      const media = await mediaService.getLessonMedia(courseData.id, lessonId);
      return media;
    } catch (error) {
      return null;
    }
  };

  // שמירת הערות משתמש (update/insert חכם)
  const saveUserNotes = async (lessonId: string, notes: string) => {
    if (!user || !courseData) return;
    
    try {
      // בדיקה אם יש הערות קיימות
      const existingNotes = await learningProgressService.getUserNotes(
        user.id,
        courseData.id,
        lessonId
      );
      
      if (existingNotes) {
        // UPDATE - עדכון הערות קיימות
      await learningProgressService.saveUserNotes({
        user_id: user.id,
        course_id: courseData.id,
        lesson_id: lessonId,
        notes_content: notes,
      });
      } else {
        // INSERT - יצירת הערות חדשות
        await learningProgressService.saveUserNotes({
          user_id: user.id,
          course_id: courseData.id,
          lesson_id: lessonId,
          notes_content: notes,
        });
      }
    } catch (error) {
      // Error saving user notes
    }
  };

  // פונקציות לכלים
  const addBoldText = () => {
    const currentText = userNotes;
    const newText = currentText + i18n.t('auto.screens__Learning__LearningScreen.s24');
    setUserNotes(newText);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  const addImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const currentText = userNotes;
        // הוספת התמונה בפורמט markdown
        const newText = currentText + i18n.t('auto.screens__Learning__LearningScreen.s25', { v0: imageUri });
        setUserNotes(newText);
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      legacyAlert(i18n.t('auto.screens__Learning__LearningScreen.s26'), i18n.t('auto.screens__Learning__LearningScreen.s27'));
    }
  };

  const addLink = () => {
    setShowLinkDialog(true);
  };

  const confirmLink = () => {
    if (linkUrl.trim() && linkText.trim()) {
      const currentText = userNotes;
      const newText = currentText + ` [${linkText}](${linkUrl}) `;
      setUserNotes(newText);
      setLinkUrl('');
      setLinkText('');
      setShowLinkDialog(false);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const addColoredText = () => {
    setShowColorPicker(true);
  };

  const confirmColoredText = () => {
    const currentText = userNotes;
    const newText = currentText + i18n.t('auto.screens__Learning__LearningScreen.s28', { v0: selectedColor });
    setUserNotes(newText);
    setShowColorPicker(false);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  // פונקציות לעורך טקסט עשיר
  const addTextElement = (type: string, content: string, options: any = {}) => {
    const newElement = {
      id: Date.now().toString(),
      type,
      content,
      ...options,
    };
    setRichTextContent(prev => [...prev, newElement]);
  };

  const toggleBold = () => {
    setCurrentFormatting(prev => ({
      ...prev,
      bold: !prev.bold,
    }));
  };

  const addImageElement = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

        if (!result.canceled && result.assets[0]) {
          // הוספת התמונה בלבד
          addTextElement('image', result.assets[0].uri, {
            width: 200,
            height: 150,
          });
        }
    } catch (error) {
      legacyAlert(i18n.t('auto.screens__Learning__LearningScreen.s26'), i18n.t('auto.screens__Learning__LearningScreen.s27'));
    }
  };

  const addLinkElement = () => {
    setShowLinkDialog(true);
  };

  const confirmLinkElement = () => {
    if (linkUrl.trim() && linkText.trim()) {
      addTextElement('link', linkText, { url: linkUrl });
      setLinkUrl('');
      setLinkText('');
      setShowLinkDialog(false);
    }
  };

  const addColoredTextElement = () => {
    setShowColorPicker(true);
  };

  const confirmColoredTextElement = () => {
    // עדכון הצבע הנוכחי
    setCurrentFormatting(prev => ({
      ...prev,
      color: selectedColor,
    }));
    setShowColorPicker(false);
  };

  // שינוי צבע ישיר (אחרי לחיצה)
  const changeColorDirectly = (color: string) => {
    setCurrentFormatting(prev => ({
      ...prev,
      color: color,
    }));
  };

  const addDateTimeElement = () => {
    const now = new Date();
    const dateTime = now.toLocaleString(appLocale());
    addTextElement('datetime', dateTime);
  };

  const addListElement = () => {
    addTextElement('list', i18n.t('auto.screens__Learning__LearningScreen.s29'));
  };

  const deleteElement = (elementId: string) => {
    setRichTextContent(prev => prev.filter(element => element.id !== elementId));
  };

  // פונקציות לעריכה ישירה
  const startEditing = () => {
    // מתחיל עריכה חדשה (לא טוען טקסט קיים)
    setIsEditing(true);
    setEditingText('');
  };

  // הוספת טקסט ישירה
  const addTextDirectly = (text: string) => {
    if (text.trim()) {
      addTextElement('text', text.trim(), {
        bold: currentFormatting.bold,
        color: currentFormatting.color,
      });
    }
  };

  // הוספת טקסט עם צבע ספציפי
  const addTextWithColor = (text: string, color: string) => {
    if (text.trim()) {
      addTextElement('text', text.trim(), {
        bold: currentFormatting.bold,
        color: color,
      });
    }
  };

  // רענון התצוגה
  const refreshDisplay = async () => {
    if (selectedLesson) {
      await loadExistingNotes(selectedLesson.id);
    }
  };

  const finishEditing = () => {
    if (editingText.trim()) {
      // מוסיף את הטקסט החדש כשורה חדשה
      const newTextElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        content: editingText.trim(),
        bold: currentFormatting.bold,
        color: currentFormatting.color,
      };
      
      // מוסיף את הטקסט החדש לסוף התוכן הקיים
      setRichTextContent(prev => [...prev, newTextElement]);
    }
    setIsEditing(false);
    setEditingText('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingText('');
  };

  // שמירה אוטומטית של ההערות — 900ms אחרי שמפסיקים להקליד
  useEffect(() => {
    const lessonId = notesLessonIdRef.current;
    if (!lessonId || !selectedLesson || lessonId !== selectedLesson.id) return;
    if (userNotes === notesBaselineRef.current) return;
    const text = userNotes;
    notesPendingRef.current = { lessonId, text };
    setNotesSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await saveUserNotes(lessonId, text);
        if (notesLessonIdRef.current === lessonId) notesBaselineRef.current = text;
        if (notesPendingRef.current?.text === text) notesPendingRef.current = null;
        setNotesSaveState('saved');
      } catch {
        setNotesSaveState('idle');
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userNotes]);

  // יציאה משיעור / מעבר לשיעור אחר — שומרים מה שעוד לא נשמר
  useEffect(() => {
    return () => {
      const pending = notesPendingRef.current;
      if (pending) {
        notesPendingRef.current = null;
        void saveUserNotes(pending.lessonId, pending.text);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson?.id]);

  // טעינת הערות קיימות
  const loadExistingNotes = async (lessonId: string) => {
    if (!user || !courseData) return;
    
    setIsLoadingNotes(true);
    try {
      const notes = await learningProgressService.getUserNotes(
        user.id,
        courseData.id,
        lessonId
      );
      
      if (notes && notes.notes_content) {
        try {
          // ניסיון לפרסור JSON
          const notesData = JSON.parse(notes.notes_content);
          if (Array.isArray(notesData)) {
            setRichTextContent(notesData);
            setLastSavedContent(JSON.stringify(notesData));
          } else {
            // אם זה לא מערך, יוצר מערך עם הטקסט
            setRichTextContent([{
              id: Date.now().toString(),
              type: 'text',
              content: notes.notes_content,
              bold: false,
              color: DesignTokens.colors.text.primary
            }]);
            setLastSavedContent(JSON.stringify([{
              id: Date.now().toString(),
              type: 'text',
              content: notes.notes_content,
              bold: false,
              color: DesignTokens.colors.text.primary
            }]));
          }
        } catch (parseError) {
          // אם יש שגיאת JSON, יוצר אלמנט טקסט מהתוכן
          setRichTextContent([{
            id: Date.now().toString(),
            type: 'text',
            content: notes.notes_content,
            bold: false,
            color: DesignTokens.colors.text.primary
          }]);
          setLastSavedContent(JSON.stringify([{
            id: Date.now().toString(),
            type: 'text',
            content: notes.notes_content,
            bold: false,
            color: DesignTokens.colors.text.primary
          }]));
        }
      } else {
        // אם אין הערות, מתחיל עם רשימה ריקה
        setRichTextContent([]);
        setLastSavedContent('');
      }
    } catch (error) {
      setRichTextContent([]);
      setLastSavedContent('');
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const renderRichTextElement = (element: any, index: number) => {
    const renderContent = () => {
      switch (element.type) {
        case 'text':
          return (
            <Text
              style={[
                styles.flowingText,
                element.bold && styles.boldText,
                { color: element.color || DesignTokens.colors.text.primary }
              ]}
            >
              {element.content}
            </Text>
          );
        
        case 'image':
          return (
            <Image
              source={{ uri: element.content }}
              style={[
                styles.flowingImage, 
                { 
                  width: element.width || 200, 
                  height: element.height || 150 
                }
              ] as any}
              resizeMode="cover"
            />
          );
        
        case 'link':
          return (
            <TouchableOpacity onPress={() => Linking.openURL(element.url)}>
              <Text style={[styles.flowingText, styles.linkText]}>
                {element.content}
              </Text>
            </TouchableOpacity>
          );
        
        case 'datetime':
          return (
            <Text style={[styles.flowingText, styles.datetimeText]}>
              [{element.content}]
            </Text>
          );
        
        case 'list':
          return (
            <Text style={[styles.flowingText, styles.listText]}>
              • {element.content}
            </Text>
          );
        
        default:
          return null;
      }
    };

    return (
      <View key={element.id} style={styles.flowingElementContainer}>
        {renderContent()}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteElement(element.id)}
        >
          <XCircle size={16} color={DesignTokens.colors.text.danger} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    );
  };

  // פונקציה ליצירת טקסט זורם כמו ב-Notes
  const renderFlowingText = () => {
    if (richTextContent.length === 0) {
      return null;
    }

    return (
      <View style={styles.notesLikeContainer}>
        {richTextContent.map((element, index) => {
          switch (element.type) {
            case 'text':
              return (
                <Text
                  key={element.id}
                  style={[
                    styles.notesText,
                    element.bold && styles.boldText,
                    { color: element.color || DesignTokens.colors.text.primary }
                  ]}
                >
                  {element.content}
                </Text>
              );
            case 'image':
              return (
                <Image
                  key={element.id}
                  source={{ uri: element.content }}
                  style={[styles.notesImage, { width: element.width || 200, height: element.height || 150 }]}
                  resizeMode="cover"
                />
              );
            default:
              return null;
          }
        })}
      </View>
    );
  };

  const handleLessonPress = async (lesson: any, index: number) => {
    if (lesson?.comingSoon) return;
    // אנימציה של לחיצה
    const animatedValue = animatedValues[index] || new Animated.Value(1);
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setSelectedLesson(lesson);
    
    // איפוס refs כששיעור חדש נבחר
    lastProgressSaveTimeRef.current = 0;
    lastProgressPercentageRef.current = 0;
    
    // נטען את ההתקדמות הקיימת של המשתמש
    if (user && courseData) {
      const userProgress = await learningProgressService.getUserProgress(user.id, courseData.id, lesson.id);
      
      // בדיקה אם זה YouTube או Vimeo (ללא שימוש בפונקציה חיצונית)
      const isYouTube = !!(lesson.youtubeId || lesson.youtubeUrl);
      
      if (userProgress) {
        
        setLessonProgress(userProgress.progress_percentage);
        setProgress(userProgress.current_time_seconds);
        setDuration(userProgress.total_duration_seconds);
        lastProgressPercentageRef.current = userProgress.progress_percentage;
        
        // שמירת המיקום האחרון רק עבור YouTube (Vimeo מטפל בזה בעצמו)
        if (isYouTube) {
          setInitialVideoPosition(userProgress.current_time_seconds);
        } else {
          setInitialVideoPosition(0); // Vimeo לא צריך את זה - הוא מטפל בזה בעצמו
        }
      } else {
        setLessonProgress(0);
        setProgress(0);
        setDuration(0);
        setInitialVideoPosition(0);
        lastProgressPercentageRef.current = 0;
      }
      
      // נטען את ההערות של המשתמש עבור השיעור הספציפי
      await loadUserNotes(lesson.id);
    }

    // נטען את קישורי המדיה אם לא קיימים
    if (courseData && (!lesson.vimeoId || !lesson.thumbnail)) {
      const media = await loadLessonMedia(lesson.id);
      if (media) {
        // חישוב משך הזמן - נשתמש בנתונים האמיתיים מ-DEMO_COURSE או מהמסד נתונים
        let duration = lesson.duration || '';
        
        
        // נחפש את השיעור בנתונים האמיתיים
        const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
        duration = formatLessonMinutes(media.duration_minutes) || demoLesson?.duration || '';
        
        const updatedLesson = {
          ...lesson,
          vimeoId: media.vimeo_id,
          thumbnail: media.thumbnail_url || `https://vumbnail.com/${media.vimeo_id}.jpg`,
          videoUrl: media.vimeo_url,
          duration: duration
        };
        setSelectedLesson(updatedLesson);
      }
    }
  };

  // חישוב התקדמות כללית של הקורס
  const calculateTotalProgress = () => {
    const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
    if (lessons.length === 0) return 0;
    const completedLessons = lessons.filter((lesson: any) => lesson.completed).length;
    const totalLessons = lessons.length;
    return Math.round((completedLessons / totalLessons) * 100);
  };

  // עדכון התקדמות השיעור הנוכחי במסד נתונים
  // הערה: lessonProgress מתעדכן ישירות ב-onProgress, כאן רק שומרים למסד נתונים
  const updateLessonProgress = async (currentTime: number, totalTime: number) => {
    if (totalTime > 0) {
      // שמירה במסד נתונים בלבד (lessonProgress מתעדכן ב-onProgress)
      if (user && courseData && selectedLesson) {
        const progress = Math.round((currentTime / totalTime) * 100);
        await learningProgressService.updateWatchingTime(
          user.id,
          courseData.id,
          selectedLesson.id,
          currentTime,
          totalTime
        );
      }
    }
  };

  // סימון שיעור כהושלם
  const markLessonAsCompleted = async () => {
    if (selectedLesson && user && courseData) {
      await learningProgressService.markLessonAsCompleted(
        user.id,
        courseData.id,
        selectedLesson.id
      );
      
      // עדכון ההתקדמות הכללית
      const newTotalProgress = await learningProgressService.calculateUserCourseProgress(
        user.id,
        courseData.id
      );
      setTotalProgress(newTotalProgress);
      
      // עדכון lessonsData
      if (lessonsData) {
        const updatedLessons = lessonsData.map((lesson: any) => 
          lesson.id === selectedLesson.id ? { ...lesson, completed: true } : lesson
        );
        setLessonsData(updatedLessons);
      }
    }
  };

  const handleVideoLoad = (status: any) => {
    setDuration(status.durationMillis / 1000);
    setIsLoading(false);
  };

  const handleVideoProgress = (status: any) => {
    setProgress(status.positionMillis / 1000);
  };

  const handleVideoEnd = async () => {
    setIsPlaying(false);
    // שמירת המיקום האחרון לפני סגירה
    if (user && courseData && selectedLesson && progress > 0 && duration > 0) {
      await updateLessonProgress(progress, duration);
    }
    legacyAlert(i18n.t('auto.screens__Learning__LearningScreen.s30'), i18n.t('auto.screens__Learning__LearningScreen.s31'), [
      { text: i18n.t('auto.screens__Learning__LearningScreen.s32'), onPress: () => setSelectedLesson(null) }
    ]);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLessonCard = (lesson: any, index: number) => {
    const animatedValue = animatedValues[index] || new Animated.Value(1);
    const lessonKey = `${lesson.id}_${lesson.duration || '00:00'}`;
    return (
      <Animated.View
        key={lessonKey}
        ref={(node: any) => {
          if (node) lessonNodeRefs.current.set(lesson.id, node);
          else lessonNodeRefs.current.delete(lesson.id);
        }}
        collapsable={false}
        style={{ transform: [{ scale: animatedValue }] }}
      >
        <LessonRow
          lesson={lesson}
          onPress={() => handleLessonPress(lesson, index)}
          courseId={courseData?.id ?? routeCourseId}
          index={index}
          enrollment={courseData?.enrollment}
          fallbackImage={courseData?.cover_url}
        />
      </Animated.View>
    );
  };

  const renderChapterBlock = (
    chapterNum: number,
    title: string,
    lessons: any[],
    startIndex: number,
  ) => {
    if (lessons.length === 0) return null;
    return (
      <View key={`chapter-${chapterNum}`} style={styles.chapterSection}>
        <View style={styles.chapterHeaderRow}>
          <Text style={styles.chapterHeaderTitle}>{title}</Text>
          <View
            style={[
              styles.chapterHeaderBadge,
              { backgroundColor: DesignTokens.colors.background.navChrome },
            ]}
          >
            <Text
              style={[
                styles.chapterHeaderBadgeText,
                { color: DesignTokens.colors.text.secondary },
              ]}
            >{i18n.t('auto.screens__Learning__LearningScreen.s33', { v0: chapterNum })}
            </Text>
          </View>
        </View>
        {lessons.map((lesson, index) => renderLessonCard(lesson, startIndex + index))}
      </View>
    );
  };

  // פונקציה לחילוץ YouTube ID מקישור
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    
    // ניקוי URL
    const cleanUrl = url.trim();
    
    // דפוסים שונים של קישורי YouTube
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      /youtu\.be\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        return videoId;
      }
    }
    
    // אם זה כבר ID (11 תווים)
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }
    
    return null;
  };

  // בדיקה אם השיעור הוא מיוטיוב או מ-Vimeo
  const getVideoType = (lesson: any): 'youtube' | 'vimeo' | null => {
    if (lesson.youtubeId || lesson.youtubeUrl) {
      return 'youtube';
    }
    if (lesson.vimeoId || lesson.vimeoUrl) {
      return 'vimeo';
    }
    return null;
  };

  const getVideoId = (lesson: any): string | null => {
    const videoType = getVideoType(lesson);
    
    if (videoType === 'youtube') {
      // נסה קודם youtubeId
      if (lesson.youtubeId) {
        return lesson.youtubeId;
      }
      // אם אין, נסה לחלץ מ-youtubeUrl
      if (lesson.youtubeUrl) {
        const extractedId = extractYouTubeId(lesson.youtubeUrl);
        if (extractedId) {
          return extractedId;
        }
      }
    }
    
    if (videoType === 'vimeo') {
      return lesson.vimeoId || null;
    }
    
    return null;
  };

  if (selectedLesson) {
    const videoType = getVideoType(selectedLesson);
    const videoId = getVideoId(selectedLesson);
    
    // יצירת HTML לפי סוג הוידאו
    const getVideoHTML = () => {
      if (videoType === 'youtube' && videoId) {
        // שימוש ב-YouTube embed URL ישירות ללא API
        return `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                html, body {
                  width: 100%;
                  height: 100%;
                  overflow: hidden;
                  background: #000;
                }
                .video-container { 
                  position: relative; 
                  width: 100%; 
                  height: 100%;
                  padding-bottom: 56.25%; /* 16:9 aspect ratio */
                }
                iframe { 
                  position: absolute; 
                  top: 0; 
                  left: 0; 
                  width: 100%; 
                  height: 100%; 
                  border: none; 
                }
              </style>
            </head>
            <body>
              <div class="video-container">
                <iframe 
                  src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&controls=1&showinfo=0" 
                  frameborder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowfullscreen
                  title="${selectedLesson.title}">
                </iframe>
              </div>
            </body>
          </html>
        `;
      } else if (videoType === 'vimeo' && videoId) {
        return `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <style>
                        body { margin: 0; padding: 0; background: #000; }
                        .video-container { 
                          padding: 56.25% 0 0 0; 
                          position: relative; 
                          width: 100%; 
                          height: 0; 
                        }
                        iframe { 
                          position: absolute; 
                          top: 0; 
                          left: 0; 
                          width: 100%; 
                          height: 100%; 
                          border: none; 
                        }
                      </style>
                    </head>
                    <body>
                      <div class="video-container">
                        <iframe 
                          id="vimeo-player"
                  src="https://player.vimeo.com/video/${videoId}?badge=0&autopause=0&player_id=0&app_id=58479" 
                          frameborder="0" 
                          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" 
                          referrerpolicy="strict-origin-when-cross-origin" 
                          style="position:absolute;top:0;left:0;width:100%;height:100%;" 
                          title="${selectedLesson.title}">
                        </iframe>
                      </div>
                      <script src="https://player.vimeo.com/api/player.js"></script>
                      <script>
                        const iframe = document.getElementById('vimeo-player');
                        const player = new Vimeo.Player(iframe);
                        
                        player.on('timeupdate', function(data) {
                          const currentTime = data.seconds;
                          const duration = data.duration;
                          const progress = (currentTime / duration) * 100;
                          
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'progress',
                            currentTime: currentTime,
                            duration: duration,
                            progress: Math.round(progress)
                          }));
                        });
                        
                        player.on('ended', function() {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'completed'
                          }));
                        });
                        
                        player.ready().then(function() {
                          player.getDuration().then(function(duration) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'duration',
                              duration: duration
                            }));
                          });
                        });
                      </script>
                    </body>
                  </html>
        `;
      }
      return null;
    };

    const videoHTML = getVideoHTML();

    const progressSeconds = Math.max(0, Math.floor(progress));
    const durationSeconds = Math.max(0, Math.floor(duration));
    const timeLine =
      durationSeconds <= 0 && isLoading
        ? i18n.t('auto.screens__Learning__LearningScreen.s34')
        : `${formatTime(progressSeconds)} / ${formatTime(durationSeconds)}`;
    const barWidthPct =
      durationSeconds > 0
        ? Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100)))
        : isLoading
          ? 0
          : Math.min(100, Math.max(0, Math.round(lessonProgress)));
    // האחוז חי כמו הטיימליין (מיקום / משך) — קודם הוצג רק lessonProgress מהשמירה, שמתעדכן לעיתים רחוקות.
    // הגבוה מבין החי לשמור — חזרה אחורה בסרטון לא מורידה את אחוז הצפייה.
    const pctValue =
      durationSeconds > 0 ? Math.max(barWidthPct, Math.round(lessonProgress)) : Math.round(lessonProgress);
    const pctDisplay =
      durationSeconds <= 0 && isLoading ? '…' : `${Math.min(100, Math.max(0, pctValue))}%`;

    const rawLessonDescription =
      typeof selectedLesson.description === 'string' ? selectedLesson.description : '';
    const lessonDescriptionDisplay = rawLessonDescription
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lessonsForNav = lessonsData && lessonsData.length > 0 ? lessonsData : [];
    const currentLessonIndex = lessonsForNav.findIndex((l: any) => l.id === selectedLesson.id);
    const lessonNumberLabel = currentLessonIndex >= 0 ? currentLessonIndex + 1 : 1;
    const lessonPlayerVideoHeight = Math.round((academyCardWidth(screenWidth) * 9) / 16);
    // מדלגים על שיעורי «בקרוב» (לא נפתחים) — אחרת שיעור כזה באמצע חוסם את הניווט
    const findPlayable = (from: number, step: 1 | -1): number => {
      if (currentLessonIndex < 0) return -1;
      for (let i = from; i >= 0 && i < lessonsForNav.length; i += step) {
        if (!lessonsForNav[i]?.comingSoon) return i;
      }
      return -1;
    };
    const prevIndex = findPlayable(currentLessonIndex - 1, -1);
    const nextIndex = findPlayable(currentLessonIndex + 1, 1);
    const canGoPrev = prevIndex >= 0;
    const canGoNext = nextIndex >= 0;
    const goToPrevLesson = () => {
      if (!canGoPrev) return;
      handleLessonPress(lessonsForNav[prevIndex], prevIndex);
    };
    const goToNextLesson = () => {
      if (!canGoNext) return;
      handleLessonPress(lessonsForNav[nextIndex], nextIndex);
    };

    return (
      <ScreenChrome>
        <RNSafeAreaView style={styles.safeAreaContent} edges={['top']}>
        <AcademySubScreenBar
          onBackPress={async () => {
            if (user && courseData && selectedLesson && progress > 0 && duration > 0) {
              await updateLessonProgress(progress, duration);
            }
            const leavingLessonId = selectedLesson?.id;
            setIsYouTubePlayerReady(false);
            durationUpdatedRef.current.clear();
            durationCheckInProgressRef.current.clear();
            setSelectedLesson(null);
            if (leavingLessonId) void refreshLessonCompleted(leavingLessonId);
          }}
          title={selectedLesson.title}
        />

          <View style={styles.lessonMainContent}>
          {/* KeyboardAwareScrollView: גלילה לאזור ההערות כשהמקלדת נפתחת ומעקב אחרי הסמן בזמן הקלדה (iOS + Android) */}
          <KeyboardAwareScrollView
            style={styles.contentSection}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bottomOffset={24}
          >
            {/* וידאו — בתוך כרטיסיית זכוכית */}
            <UICard variant="blur" padding="none" style={styles.lessonVideoCard}>
              <View style={[styles.videoContainer, { height: lessonPlayerVideoHeight }]}>
            {!allowHeavy ? (
              <View style={styles.videoPlayerPlaceholder}>
                {selectedLesson.thumbnail ? (
                  <Image
                    source={{ uri: selectedLesson.thumbnail }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}
                <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              </View>
            ) : videoType === 'youtube' && videoId ? (
              <YoutubePlayer
                ref={youtubePlayerRef}
                height={lessonPlayerVideoHeight}
                videoId={videoId}
                play={isPlaying}
                onChangeState={(event: string) => {
                  if (event === 'ended') {
                    markLessonAsCompleted();
                  } else if (event === 'playing') {
                    setIsPlaying(true);
                  } else if (event === 'paused') {
                    setIsPlaying(false);
                  }
                }}
                onReady={() => {
                  setIsLoading(false);
                  setIsYouTubePlayerReady(true); // סמן שהפלייר מוכן להתחיל מעקב
                  
                  // הצבת הסרטון במיקום האחרון כשהפלייר מוכן
                  if (initialVideoPosition > 0 && youtubePlayerRef.current) {
                    setTimeout(() => {
                      try {
                        youtubePlayerRef.current?.seekTo(initialVideoPosition, true);
                      } catch (error) {
                        // Error seeking YouTube player
                      }
                    }, 500); // המתנה קצרה כדי לוודא שהפלייר מוכן
                  }
                }}
                onProgress={(data: { currentTime: number; duration: number }) => {
                  // מעקב התקדמות - בדומה ל-Vimeo
                  const currentTime = data.currentTime;
                  const duration = data.duration;
                  
                  if (duration > 0 && currentTime >= 0) {
                    setProgress(currentTime);
                    setDuration(duration);
                    // עדכון ה-timeline כל הזמן (לצורך תצוגה)
                    const progressPercentage = Math.round((currentTime / duration) * 100);
                    
                    // בדיקה שהפרוגרס תקין ולא קופץ ל-0 (למניעת קפיצות)
                    if (progressPercentage >= 0 && progressPercentage <= 100) {
                      // אם הפרוגרס קופץ ל-0 בעוד שהיה ערך לפני, נשמור את הערך הקודם
                      if (progressPercentage === 0 && lastProgressPercentageRef.current > 0 && currentTime > 1) {
                        // לא נעדכן אם הפרוגרס קופץ ל-0 בעוד שהזמן הנוכחי הוא יותר מ-1 שנייה
                      } else {
                        setLessonProgress(progressPercentage);
                        lastProgressPercentageRef.current = progressPercentage;
                      }
                    }
                    
                    // עדכון התקדמות במסד נתונים כל 5 שניות (כדי לא להעמיס על המסד נתונים)
                    // שיפור: בודקים שהזמן השתנה ב-5 שניות לפחות מהעדכון האחרון
                    const currentTimeInt = Math.floor(currentTime);
                    if (currentTimeInt > 0 && currentTimeInt % 5 === 0 && currentTimeInt !== lastProgressSaveTimeRef.current) {
                      lastProgressSaveTimeRef.current = currentTimeInt;
                      updateLessonProgress(currentTime, duration);
                    }
                  }
                }}
                onError={(error: any) => {
                  legacyAlert(i18n.t('auto.screens__Learning__LearningScreen.s26'), i18n.t('auto.screens__Learning__LearningScreen.s35'));
                }}
                initialPlayerParams={{
                  modestbranding: 1,
                  rel: 0,
                  controls: 1,
                  start: initialVideoPosition > 0 ? Math.floor(initialVideoPosition) : undefined,
                  enablejsapi: 1,
                }}
                webViewStyle={{ opacity: 0.99 }}
                webViewProps={{
                  allowsInlineMediaPlayback: true,
                  mediaPlaybackRequiresUserAction: false,
                }}
              />
            ) : videoType === 'vimeo' && videoHTML ? (
              <WebView
                // הסרטונים ב-Vimeo מוגבלים להטמעה בדומיינים מסוימים; בלי baseUrl הנגן נטען בלי דומיין ונחסם (403)
                source={{ html: videoHTML, baseUrl: VIMEO_EMBED_BASE_URL }}
              style={styles.videoPlayer}
              allowsFullscreenVideo={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              onLoadStart={() => {
                setIsLoading(true);
              }}
              onLoadEnd={() => {
                setIsLoading(false);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                legacyAlert(i18n.t('auto.screens__Learning__LearningScreen.s26'), i18n.t('auto.screens__Learning__LearningScreen.s36', { v0: nativeEvent.description || 'שגיאה לא ידועה' }));
              }}
              onHttpError={() => {}}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  
                  if (data.type === 'progress') {
                    updateLessonProgress(data.currentTime, data.duration);
                    setProgress(data.currentTime);
                    setDuration(data.duration);
                  } else if (data.type === 'completed') {
                    markLessonAsCompleted();
                  } else if (data.type === 'duration') {
                    setDuration(data.duration);
                  }
                } catch (error) {
                  // Error parsing message
                }
              }}
            />
            ) : (
              <View style={styles.videoErrorContainer}>
                <Text style={styles.videoErrorIcon}>⚠️</Text>
                <Text style={styles.videoErrorText}>{i18n.t('auto.screens__Learning__LearningScreen.s37')}</Text>
                {selectedLesson.youtubeUrl && (
                  <TouchableOpacity 
                    style={styles.youtubeButton}
                    onPress={() => {
                      Linking.openURL(selectedLesson.youtubeUrl);
                    }}
                  >
                    <Text style={styles.youtubeButtonText}>{i18n.t('auto.screens__Learning__LearningScreen.s38')}</Text>
                  </TouchableOpacity>
                )}
                {!selectedLesson.youtubeId && !selectedLesson.youtubeUrl && (
                  <Text style={styles.videoErrorSubtext}>{i18n.t('auto.screens__Learning__LearningScreen.s39')}</Text>
                )}
              </View>
            )}
                </View>
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <View style={styles.loadingSpinner}>
                    <RefreshCw size={32} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.loadingText}>{i18n.t('auto.screens__Learning__LearningScreen.s40')}</Text>
                </View>
              )}
            </UICard>

            {/* פרטי שיעור + פרוגרס */}
            <UICard variant="soft" padding="md" style={styles.lessonGlassCard}>
              {/* תגית «שיעור X» — כמו תגיות הפרקים ברשימת השיעורים (טופו) */}
              <View style={styles.lessonPlayerIndexRow}>
                <View style={[styles.chapterHeaderBadge, { backgroundColor: DesignTokens.colors.background.navChrome }]}>
                  <Text style={[styles.chapterHeaderBadgeText, { color: DesignTokens.colors.text.secondary }]}>
                    {i18n.t('auto.screens__Learning__LearningScreen.s41', { v0: lessonNumberLabel })}
                  </Text>
                </View>
              </View>
              <Text style={styles.lessonPlayerTitle}>{selectedLesson.title}</Text>
              {lessonDescriptionDisplay ? (
                <Text style={styles.lessonDescription}>
                  {lessonDescriptionDisplay}
                </Text>
              ) : null}

              <View
                style={[
                  styles.lessonPlayerProgressBlock,
                  !lessonDescriptionDisplay ? styles.lessonPlayerProgressBlockCompact : null,
                ]}
              >
                  <View style={styles.progressTimeRow}>
                    <Text style={styles.progressTimeText}>{timeLine}</Text>
                    <Text style={styles.progressPercentageText}>{pctDisplay}</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, barWidthPct))}%`,
                          minWidth: barWidthPct > 0 ? 4 : 0,
                        },
                      ]}
                    />
                  </View>
                  {selectedLesson.completed && (
                    <View style={styles.completedStatus}>
                      <CheckCircle2 size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                      <Text style={styles.completedText}>{i18n.t('auto.screens__Learning__LearningScreen.s42')}</Text>
                    </View>
                  )}
              </View>
            </UICard>

            {/* ניווט שיעורים — כמו יומן כלכלי / מעבר ימים */}
            <UICard
              variant="soft"
              padding="sm"
              style={styles.lessonNavShell}
            >
              <View style={styles.lessonNavRowStandard}>
                <DayNavBlurButton
                  onPress={goToNextLesson}
                  disabled={!canGoNext}
                  style={{ backgroundColor: DesignTokens.colors.background.primary }}
                >
                  <Ionicons
                    name={dirIcon('chevron-back')}
                    size={20}
                    color={canGoNext ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
                  />
                </DayNavBlurButton>

                <View style={styles.lessonNavCenter}>
                  <Text style={styles.lessonNavCenterTitle} numberOfLines={2}>
                    {i18n.t('auto.screens__Learning__LearningScreen.s43')} {lessonNumberLabel} {i18n.t('auto.screens__Learning__LearningScreen.s44')} {lessonsForNav.length || 1}
                  </Text>
                  {(canGoPrev || canGoNext) && (
                    <Text style={styles.lessonNavCenterSub} numberOfLines={1}>{i18n.t('auto.screens__Learning__LearningScreen.s45')}</Text>
                  )}
                </View>

                <DayNavBlurButton
                  onPress={goToPrevLesson}
                  disabled={!canGoPrev}
                  style={{ backgroundColor: DesignTokens.colors.background.primary }}
                >
                  <Ionicons
                    name={dirIcon('chevron-forward')}
                    size={20}
                    color={canGoPrev ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
                  />
                </DayNavBlurButton>
              </View>
            </UICard>

            {/* הערות אישיות — אזור כתיבה בתוך הדף, נשמר אוטומטית */}
            <View style={styles.lessonNotesSection}>
              <Text style={styles.lessonNotesLabel}>{i18n.t('auto.screens__Learning__LearningScreen.s46')}</Text>
              <UICard variant="soft" padding="none" style={styles.lessonGlassCard}>
                <TextInput
                  ref={textInputRef}
                  style={[
                    styles.lessonNotesInput,
                    appPhysicalRightText,
                    { color: DesignTokens.colors.text.primary, textAlign: 'right' },
                    Platform.OS === 'android' && { includeFontPadding: false },
                  ]}
                  placeholder={i18n.t('auto.screens__Learning__LearningScreen.s50')}
                  placeholderTextColor={DesignTokens.colors.text.tertiary}
                  value={userNotes}
                  onChangeText={setUserNotes}
                  multiline
                  // גובה קבוע — הגלילה בתוך ההערות, לא הדף כולו
                  scrollEnabled
                  textAlign="right"
                  textAlignVertical="top"
                />
              </UICard>
              <Text style={styles.lessonNotesHint}>
                {notesSaveState === 'saving'
                  ? i18n.t('auto.screens__Learning__LearningScreen.notesSaving')
                  : notesSaveState === 'saved'
                    ? i18n.t('auto.screens__Learning__LearningScreen.notesSaved')
                    : i18n.t('auto.screens__Learning__LearningScreen.s51')}
              </Text>
            </View>
          </KeyboardAwareScrollView>
          </View>

        {/* Link Dialog */}
        <Modal
          visible={showLinkDialog}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLinkDialog(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{i18n.t('auto.screens__Learning__LearningScreen.s56')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={i18n.t('auto.screens__Learning__LearningScreen.s57')}
                value={linkText}
                onChangeText={setLinkText}
              />
              <TextInput
                style={styles.modalInput}
                placeholder={i18n.t('auto.screens__Learning__LearningScreen.s58')}
                value={linkUrl}
                onChangeText={setLinkUrl}
                keyboardType="url"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setShowLinkDialog(false)}
                >
                  <Text style={styles.modalButtonText}>{i18n.t('auto.screens__Learning__LearningScreen.s59')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={confirmLinkElement}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>{i18n.t('auto.screens__Learning__LearningScreen.s60')}</Text>
                </TouchableOpacity>
                </View>
                </View>
              </View>
        </Modal>

        {/* Color Picker Dialog */}
        <Modal
          visible={showColorPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowColorPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{i18n.t('auto.screens__Learning__LearningScreen.s61')}</Text>
              <View style={styles.colorPicker}>
                {[DesignTokens.colors.text.primary, '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.selectedColor]}
                    onPress={() => {
                      setSelectedColor(color);
                      changeColorDirectly(color);
                    }}
                  />
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setShowColorPicker(false)}
                >
                  <Text style={styles.modalButtonText}>{i18n.t('auto.screens__Learning__LearningScreen.s59')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => setShowColorPicker(false)}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>{i18n.t('auto.screens__Learning__LearningScreen.s62')}</Text>
                </TouchableOpacity>
        </View>
            </View>
          </View>
        </Modal>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  // נתוני הקורס להצגה - לא נציג DEMO_COURSE אם עדיין טוען או אם אין courseData
  const displayCourse = courseData;
  const displayCoverUrl = courseData?.cover_url;
  const displayTitle = courseData?.title;

  // שלד הקורס: אותו מבנה כמו הטעון — באנר (שם ותמונה מרשימת האקדמיה שכבר בקאש), «שיעורי הקורס» וכרטיסי שיעור בטעינה
  const lessonSkeletons = (
    <View style={[styles.courseListBody, { paddingTop: DesignTokens.spacing.md }]}>
      {[0, 1, 2].map((i) => (
        <LessonRowSkeleton key={i} index={i} />
      ))}
    </View>
  );

  if (!courseData) {
    const hint = queryClient
      .getQueryData<CourseListResponse>(appQueryKeys.courses())
      ?.courses?.find((c) => c.id === routeCourseId);
    return (
      <ScreenChrome>
        <RNSafeAreaView style={styles.safeAreaContent} edges={[]}>
          <CourseListHero
            coverUrl={hint?.cover_url ?? undefined}
            title={hint?.title ?? i18n.t('auto.screens__Learning__LearningScreen.s63')}
            height={courseHeroHeight}
            topInset={insets.top}
            onBack={handleBackToAcademy}
            progressLabel=""
            progressPct={0}
            progressLoading
          />
          <View style={styles.courseListBody}>
            <Text style={[styles.courseListSectionTitle, { marginBottom: DesignTokens.spacing.sm }]}>{i18n.t('auto.screens__Learning__LearningScreen.s66')}</Text>
          </View>
          <View pointerEvents="none" style={{ flex: 1, marginBottom: insets.bottom, overflow: 'hidden' }}>
            {lessonSkeletons}
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  const lessonsList = Array.isArray(lessonsData) ? lessonsData : [];
  const totalLessonsCount = lessonsList.length;
  const completedLessonsCount = lessonsList.filter((lesson: { completed?: boolean }) => lesson.completed).length;
  const courseProgressPct =
    totalLessonsCount > 0
      ? Math.min(100, Math.round((completedLessonsCount / totalLessonsCount) * 100))
      : 0;
  const courseProgressLabel =
    totalLessonsCount === 0
      ? i18n.t('auto.screens__Learning__LearningScreen.s64')
      : i18n.t('auto.screens__Learning__LearningScreen.s65', { v0: completedLessonsCount, v1: totalLessonsCount });

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.safeAreaContent} edges={[]}>
        {/* באנר, התקדמות וכותרת קבועים — רק רשימת השיעורים נגללת */}
          <CourseListHero
            coverUrl={displayCoverUrl}
            title={displayTitle ?? i18n.t('auto.screens__Learning__LearningScreen.s63')}
            height={courseHeroHeight}
            topInset={insets.top}
            onBack={handleBackToAcademy}
            progressLabel={courseProgressLabel}
            progressPct={courseProgressPct}
            progressLoading={lessonsProgressLoading}
          />

        <View style={styles.courseListBody}>
          <Text style={[styles.courseListSectionTitle, { marginBottom: DesignTokens.spacing.sm }]}>{i18n.t('auto.screens__Learning__LearningScreen.s66')}</Text>
        </View>

        {/* marginBottom: הרשימה נחתכת מעל ה-safe area התחתון */}
        <View style={{ flex: 1, marginBottom: insets.bottom }}>
          <ScrollView
            ref={courseListScrollRef}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshingLessons}
                onRefresh={handleRefreshLessons}
                tintColor={DesignTokens.colors.primary.main}
              />
            }
            onScroll={handleCourseListScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              courseViewportHRef.current = e.nativeEvent.layout.height;
              setCourseViewportH(e.nativeEvent.layout.height);
              updateCourseJumpButton();
            }}
            onContentSizeChange={(_w, h) => {
              setCourseContentH(h);
              measureProgressTarget();
            }}
            onScrollBeginDrag={showCourseIndicator}
            onMomentumScrollBegin={showCourseIndicator}
            onScrollEndDrag={hideCourseIndicator}
            onMomentumScrollEnd={hideCourseIndicator}
            contentContainerStyle={[
              styles.courseListScroll,
              { paddingBottom: DesignTokens.spacing.xl },
            ]}
          >
            <View ref={courseContentRef} collapsable={false}>
              {lessonsList.length === 0 && lessonsProgressLoading ? lessonSkeletons : (
              <View style={[styles.courseListBody, { paddingTop: DesignTokens.spacing.md }]}>
              {lessonsList.some((l: any) => l.section_index != null)
                ? groupLessonsBySection(lessonsList).map((sec) =>
                    renderChapterBlock(sec.index, sec.title, sec.lessons, sec.startIndex),
                  )
                : (
                  <>
                    {renderChapterBlock(1, i18n.t('auto.screens__Learning__LearningScreen.s67'), lessonsList.slice(0, 1), 0)}
                    {renderChapterBlock(2, i18n.t('auto.screens__Learning__LearningScreen.s68'), lessonsList.slice(1, 8), 1)}
                    {renderChapterBlock(3, i18n.t('auto.screens__Learning__LearningScreen.s69'), lessonsList.slice(8), 8)}
                  </>
                )}
              </View>
              )}
            </View>
          </ScrollView>

          {/* פס גלילה בצד שמאל */}
          {courseViewportH > 0 && courseContentH > courseViewportH ? (() => {
            const thumbH = Math.max(36, (courseViewportH * courseViewportH) / courseContentH);
            const maxScroll = courseContentH - courseViewportH;
            return (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 0,
                  width: 3,
                  height: thumbH,
                  borderRadius: 1.5,
                  backgroundColor: DesignTokens.colors.text.tertiary,
                  opacity: courseIndicatorOpacity,
                  transform: [
                    {
                      translateY: courseScrollY.interpolate({
                        inputRange: [0, maxScroll],
                        outputRange: [0, courseViewportH - thumbH],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              />
            );
          })() : null}
        </View>

        {/* קפיצה להתקדמות (או לראש) — עיגול 44 בצבע ה-CTA, ימין תחתון */}
        <Animated.View
          pointerEvents={showCourseScrollTop ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            right: 12,
            bottom: Math.max(insets.bottom, 12) + 12,
            width: 44,
            height: 44,
            opacity: courseScrollTopOpacity,
            transform: [
              {
                scale: courseScrollTopOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              },
            ],
            zIndex: 1000,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              handleCourseJumpPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={progressTargetYRef.current == null ? i18n.t('auto.screens__Learning__LearningScreen.s70') : i18n.t('auto.screens__Learning__LearningScreen.s71')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              // צבע כפתור ה-CTA (UIButton primary)
              backgroundColor: DesignTokens.colors.primary.lightCta,
              ...DesignTokens.shadows.green,
            }}
          >
            {courseJumpDir === 'down' ? (
              <ChevronDown size={22} color={DesignTokens.colors.text.inverse} strokeWidth={2.4} />
            ) : (
              <ChevronUp size={22} color={DesignTokens.colors.text.inverse} strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {showCourseComplete ? (
          <CourseCompletionOverlay
            courseTitle={courseData?.title}
            lessonsCount={availableLessonsCount}
            onClose={() => setShowCourseComplete(false)}
          />
        ) : null}
      </RNSafeAreaView>
    </ScreenChrome>
  );
}

/**
 * הדומיין שממנו נגן Vimeo נטען — חייב להופיע ברשימת הדומיינים המותרים להטמעה של הסרטונים ב-Vimeo.
 * כרגע my.schooler.biz (כבר מורשה בכל סרטוני הקורס). כשמוסיפים את darkpool.site ב-Vimeo — להחליף לכאן.
 */
const VIMEO_EMBED_BASE_URL = 'https://my.schooler.biz';

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  courseListScroll: {
    flexGrow: 1,
  },
  courseListBody: {
    paddingHorizontal: ACADEMY_CARD_HP,
    paddingTop: tokens.spacing.lg,
  },
  courseHeroCover: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  courseHeroImage: {
    width: '100%',
    height: '100%',
  },
  courseHeroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  courseHeroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.xs,
  },
  courseHeroProgress: {
    width: '100%',
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  courseHeroTitle: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: '800' as const,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize['2xl'] * 1.2),
    writingDirection: TEXT_DIR,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  courseHeroSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
  },
  courseCoverPlaceholder: {
    backgroundColor: tokens.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCoverPlaceholderIcon: {
    fontSize: 48,
  },
  courseListSectionTitle: {
    ...academySectionTitleStyle,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.sectionHeaderToContent,
  },
  // Background Gradient
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  
  // Lesson Page Styles - הרקע מגיע מהגרדיאנט
  lessonContainer: {
    flex: 1,
  },
  safeAreaContent: {
    flex: 1,
  },
  courseLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // New Lesson Header Styles - Glassmorphism שקוף
  newLessonHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.background.cardSolid,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    minHeight: 88,
    gap: tokens.spacing.md,
  },
  newBackButton: {
    width: 44,
    height: 44,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.background.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newHeaderContent: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  newLessonNumber: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.label.weight as any,
    letterSpacing: tokens.typography.label.letterSpacing,
    color: tokens.colors.primary.main,
    marginBottom: 2,
  },
  newLessonTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    lineHeight: tokens.typography.titleSmall.size * tokens.typography.lineHeight.normal,
    textAlign: 'right',
  },
  lessonCardTextCol: {
    width: '100%',
    alignItems: 'stretch',
  },
  lessonCardTitle: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleXs.size * 1.35),
    letterSpacing: 0.15,
    writingDirection: TEXT_DIR,
  },
  lessonDuration: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  menuButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
  },
  lessonMainContent: {
    flex: 1,
  },
  lessonNotesSection: {
    width: '100%',
  },
  lessonNotesLabel: {
    ...appGroupLabelStyle,
    color: tokens.colors.text.secondary,
  },
  lessonNotesInput: {
    ...ACADEMY_TYPE.body,
    // גובה קבוע: טקסט ארוך נגלל בתוך השדה במקום להאריך את הדף
    height: 180,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingTop: APP_LAYOUT.cardPadding,
    paddingBottom: APP_LAYOUT.cardPadding,
    writingDirection: TEXT_DIR,
  },
  lessonNotesHint: {
    ...ACADEMY_TYPE.caption,
    marginTop: tokens.spacing.sm,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  lessonGlassCard: {
    borderRadius: ACADEMY_CARD_RADIUS,
    overflow: 'hidden',
  },
  lessonVideoCard: {
    borderRadius: ACADEMY_CARD_RADIUS,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  lessonPlayerIndex: {
    ...ACADEMY_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginBottom: 0,
    writingDirection: TEXT_DIR,
  },
  // שורת התגית — צמודה לתחילת השורה (ימין בעברית) בעץ פיזי
  lessonPlayerIndexRow: {
    direction: ROOT_DIR,
    alignItems: 'flex-end',
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  lessonPlayerTitle: {
    ...ACADEMY_TYPE.cardTitle,
    marginTop: 0,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoPlayerPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: ACADEMY_CARD_HP,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing['5xl'],
    // מרווח אחיד בין כל הכרטיסים בדף השיעור
    gap: APP_LAYOUT.cardStackGap,
  },
  lessonPlayerProgressBlock: {
    width: '100%',
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    gap: tokens.spacing.sm,
  },
  lessonPlayerProgressBlockCompact: {
    marginTop: APP_LAYOUT.stackGapSmall,
  },
  lessonNavShell: {
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
  },
  lessonNavRowStandard: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  lessonNavCenterTitle: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  lessonNavCenterSub: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  notesSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  notesSettingsTextCol: {
    flex: 1,
  },
  notesSettingsTitle: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  notesSettingsSubtitle: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.footnote,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  notesSettingsIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.navChrome,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  
  // Lesson Info Card - Glassmorphism
  lessonInfoCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  lessonInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lessonInfoLeft: {
    flex: 1,
    marginRight: 16,
  },
  lessonInfoTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.xl * tokens.typography.lineHeight.normal),
    writingDirection: TEXT_DIR,
  },
  lessonInfoDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.body.lineHeight,
    writingDirection: TEXT_DIR,
  },
  lessonInfoRight: {
    alignItems: 'flex-end',
  },
  lessonStats: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Progress Cards
  progressCards: {
    gap: 16,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressCardTitle: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  progressCardPercentage: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  progressCardBar: {
    height: 8,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressCardFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 4,
  },
  progressCardTime: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: tokens.colors.primary.main,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionButtonText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    textAlign: 'right',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionButtonText: {
    color: tokens.colors.primary.main,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    textAlign: 'right',
  },
  
  // Navigation Buttons
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  navButton: {
    flex: 1,
    backgroundColor: tokens.colors.background.cardSolid,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  
  // Notes Card - Glassmorphism
  notesCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notesCardTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  notesCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notesActionButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.tertiary,
  },
  notesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: 16,
    marginBottom: 12,
    minHeight: 100,
  },
  notesTextInput: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
  },
  notesHint: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  
  // Simple Lesson Page Styles - Glassmorphism
  simpleLessonInfo: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  simpleLessonDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.body.size * 1.45),
    writingDirection: TEXT_DIR,
    width: '100%',
  },
  simpleNotesSection: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  simpleNotesHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: tokens.spacing.xs,
  },
  simpleNotesHeaderIconsRow: {
    zIndex: 2,
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
  },
  simpleNotesTitleOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 80,
    zIndex: 0,
  },
  simpleNotesTitle: {
    width: '100%',
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  simpleNotesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: 16,
    minHeight: 100,
  },
  simpleNotesTextInput: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
  },
  notesPreview: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    fontStyle: 'italic',
    width: '100%',
    lineHeight: Math.round(tokens.typography.bodySmall.size * 1.4),
    writingDirection: TEXT_DIR,
  },

  notesSheetContent: {
    flex: 1,
    backgroundColor: 'transparent',
    direction: UI_DIR,
  },
  notesSheetHeader: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 16,
    minHeight: DAY_NAV_BUTTON_SIZE,
  },
  notesSheetTitleWrap: {
    position: 'absolute',
    left: tokens.spacing.lg + DAY_NAV_BUTTON_SIZE,
    right: tokens.spacing.lg + DAY_NAV_BUTTON_SIZE,
    top: 0,
    bottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSheetHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.42,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  notesSheetScroll: {
    flex: 1,
  },
  notesSheetScrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 14,
    gap: 12,
    direction: UI_DIR,
  },
  notesSheetInputShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesSheetInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...ACADEMY_TYPE.body,
    direction: ROOT_DIR,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    textAlignVertical: 'top',
    minHeight: 220,
    width: '100%',
    paddingVertical: 4,
  },
  notesSheetHint: {
    ...ACADEMY_TYPE.caption,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
    width: '100%',
  },
  notesSheetFooter: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.cardStackGap,
    backgroundColor: 'transparent',
  },
  notesSheetSavePrimary: {
    height: 50,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary.main,
  },
  notesSheetSavePrimaryDisabled: {
    opacity: 0.65,
  },
  notesSheetSavePrimaryContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  notesSheetSavePrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.text.inverse,
  },
  
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.backdrop,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: tokens.colors.border.primary,
    minHeight: '60%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    minHeight: 60,
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: tokens.colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
  },
  bottomSheetTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 24,
    textAlignVertical: 'center',
    flex: 1,
    includeFontPadding: false,
  },
  closeButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    gap: 12,
    minHeight: 60,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolbarButton: {
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInputContainer: {
    flex: 1,
    padding: 20,
  },
  textInputWrapper: {
    flex: 1,
  },
  notesTextArea: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
    minHeight: 200,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    width: '80%',
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: tokens.colors.primary.main,
  },
  modalButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.secondary,
  },
  modalButtonTextPrimary: {
    color: tokens.colors.text.primary,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderWidth: 3,
  },
  
  // Rich Text Editor Styles
  richTextContainer: {
    flex: 1,
    padding: 16,
  },
  richTextContent: {
    paddingBottom: 20,
  },
  richTextElement: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  boldText: {
    fontWeight: 'bold',
  },
  richImageElement: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  linkText: {
    color: tokens.colors.primary.main,
    textDecorationLine: 'underline',
  },
  datetimeText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.bodySmall.size,
    fontStyle: 'italic',
  },
  listText: {
    marginLeft: 16,
  },
  placeholderText: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
  },
  activeToolbarButton: {
    backgroundColor: tokens.colors.primary.main + '20',
  },
  
  // Text Input Styles
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
    backgroundColor: tokens.colors.background.tertiary,
  },
  textInput: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius['3xl'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    maxHeight: 100,
    marginRight: 8,
  },
  addTextButton: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elementContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: 2,
  },
  
  // Flowing Text Styles
  flowingTextContainer: {
    flex: 1,
    padding: 16,
  },
  flowingTextContent: {
    paddingBottom: 20,
  },
  flowingText: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  flowingImage: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  flowingElementContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  // Direct Text Editor Styles
  editableTextArea: {
    flex: 1,
    minHeight: 200,
    padding: 16,
  },
  inlineTextInput: {
    flex: 1,
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  newTextInputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 16,
  },
  addNoteText: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.primary.main,
    marginLeft: 8,
    fontWeight: '500',
  },
  textAreaContent: {
    flex: 1,
    minHeight: 200,
  },
  
  // Header Content Styles
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  savingText: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.primary.main,
    marginLeft: 4,
  },
  
  // Notes-like Styles
  notesLikeContainer: {
    flex: 1,
  },
  notesText: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  notesImage: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  formatIndicator: {
    marginTop: 4,
  },
  formatText: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  
  // Lesson Progress Info
  lessonProgressInfo: {
    marginTop: 0,
    width: '100%',
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.divider,
  },
  lessonProgressInfoNoDescription: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  progressTimeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTimeText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.secondary,
  },
  progressPercentageText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.primary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // ירוק המותג (primary) — success בלייט הוא ירוק אמרלד אחר (#10B981) שלא תואם לערכה
  completedText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.primary.main,
  },
  
  // Course Header - שקוף עם הגרדיאנט מאחורה
  courseHeader: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  courseImageContainer: {
    position: 'relative',
    marginBottom: 0,
    overflow: 'hidden',
  },
  courseImage: {
    width: '100%',
    height: 220,
    borderRadius: 0,
  },
  courseGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: tokens.colors.background.primary,
  },
  priceContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: tokens.colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.success.main,
  },
  
  courseInfo: {
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.lg,
  },
  courseTitleBlock: {
    gap: tokens.spacing.xs,
    width: '100%',
  },
  courseTitle: {
    fontSize: tokens.typography.displaySmall.size,
    fontWeight: tokens.typography.displaySmall.weight as any,
    letterSpacing: tokens.typography.displaySmall.letterSpacing,
    color: tokens.colors.text.primary,
    lineHeight: Math.round(tokens.typography.displaySmall.size * 1.22),
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  courseSubtitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleSmall.size * 1.35),
    writingDirection: TEXT_DIR,
  },
  courseDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.body.size * 1.5),
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    width: '100%',
    alignSelf: 'stretch',
  },
  
  // Rating
  ratingContainer: {
    marginTop: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
  },
  ratingCount: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
  },
  
  instructorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  instructorRatingText: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  instructorStudents: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Meta
  courseMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  metaLabel: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  
  // Lessons Section
  lessonsSection: {
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  
  // Chapter Sections
  chapterSection: {
    marginBottom: tokens.spacing.xl,
  },
  chapterHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_LAYOUT.cardStackGap,
    // מרווח מכותרת הפרק לשיעור הראשון
    marginBottom: APP_LAYOUT.groupLabelToContent + 6,
  },
  chapterHeaderTitle: {
    flex: 1,
    ...ACADEMY_TYPE.groupLabel,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  chapterHeaderBadge: {
    minWidth: 56,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterHeaderBadgeText: {
    ...ACADEMY_TYPE.caption,
  },
  progressContainer: {
    alignItems: 'stretch',
    gap: tokens.spacing.sm,
    minWidth: 132,
    width: 132,
    flexShrink: 0,
  },
  progressTextRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    minHeight: 22,
  },
  progressText: {
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'right',
    color: tokens.colors.text.secondary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  progressTextMuted: {
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'right',
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: `${tokens.colors.border.primary}99`,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  
  // Lesson Cards
  lessonTouchable: {
    width: '100%',
  },
  lessonThumbnail: {
    position: 'relative',
    height: 132,
    backgroundColor: tokens.colors.background.primary,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.background.primary,
  },
  thumbnailGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.backdrop,
  },
  /** מספר שיעור על הבאנר — למעלה שמאל (צד שני ל־badge הזמן למטה־ימין) */
  lessonNumberOnThumb: {
    position: 'absolute',
    top: tokens.spacing.md,
    left: tokens.spacing.md,
    zIndex: 2,
    minWidth: 30,
    height: 28,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    ...tokens.shadows.xs,
  },
  lessonNumberOnThumbText: {
    color: tokens.colors.text.inverse,
    fontWeight: '800' as any,
    fontSize: 14,
    lineHeight: 17,
  },
  durationBadge: {
    position: 'absolute',
    bottom: tokens.spacing.md,
    right: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
    shadowColor: tokens.shadows.xs.shadowColor,
    shadowOffset: tokens.shadows.xs.shadowOffset,
    shadowOpacity: tokens.shadows.xs.shadowOpacity,
    shadowRadius: tokens.shadows.xs.shadowRadius,
    elevation: tokens.shadows.xs.elevation,
  },
  durationText: {
    fontSize: tokens.typography.caption.size,
    fontWeight: tokens.typography.caption.weight as any,
  },
  completedBadge: {
    position: 'absolute',
    top: tokens.spacing.md,
    right: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.xs,
    shadowColor: tokens.shadows.xs.shadowColor,
    shadowOffset: tokens.shadows.xs.shadowOffset,
    shadowOpacity: tokens.shadows.xs.shadowOpacity,
    shadowRadius: tokens.shadows.xs.shadowRadius,
    elevation: tokens.shadows.xs.elevation,
  },
  
  lessonContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    width: '100%',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonDescription: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.cardBody,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  lessonStatus: {
    marginTop: 2,
  },
  completedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    marginBottom: 12,
  },
  loadingText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  videoErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    minHeight: 200,
    padding: 20,
  },
  videoErrorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  videoErrorText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    textAlign: 'center',
    marginBottom: 8,
  },
  videoErrorSubtext: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.bodySmall.size,
    textAlign: 'center',
    marginTop: 8,
  },
  youtubeButton: {
    backgroundColor: tokens.colors.danger.main,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 16,
  },
  youtubeButtonText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
  },
});

/** קורסים שעוד לא פתוחים — התוכן מוצג מטושטש מתחת לטיזר «בקרוב» */
function LearningScreenGate() {
  const route = useRoute();
  const navigation = useNavigation();
  const courseId = ((route.params as { courseId?: string } | undefined)?.courseId) ?? null;
  const locked = isCourseTeaserLocked(courseId);
  // Android: BlurView מטשטש רק תוכן שעטוף ב-BlurTargetView
  const blurTargetRef = useRef<View>(null);
  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }} pointerEvents={locked ? 'none' : 'auto'}>
        <LearningScreen />
      </BlurTargetView>
      {locked && courseId ? (
        <CourseTeaserLock courseId={courseId} onBack={() => navigation.goBack()} blurTarget={blurTargetRef} />
      ) : null}
    </View>
  );
}

export default LearningScreenGate;

