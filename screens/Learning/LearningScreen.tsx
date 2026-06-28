import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Dimensions, Platform, TextInput, SafeAreaView, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Modal, Linking, ActivityIndicator } from 'react-native';
// import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui';
import { AcademySubScreenBar } from '../../components/learning';
import { LinearGradient } from 'expo-linear-gradient';
import { ACADEMY_CARD_HP, ACADEMY_CARD_RADIUS, academyCardWidth } from '../../components/learning/academyCardLayout';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { Ionicons } from '@expo/vector-icons';
import { XCircle, CheckCircle2, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Edit3, ChevronUp, ChevronDown, Save, Type, ImageIcon, Palette, PlusCircle, Star, Clock, TrendingUp, Video as VideoIcon } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { learningProgressService } from '../../services/learningProgressService';
import { courseService } from '../../services/courseService';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';

const { width: screenWidth } = Dimensions.get('window');

const NOTES_SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';

/** טקסט עברי בתוך עץ RTL */
const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};

const DEMO_COURSE = {
  id: 'demo-course-1',
  title: 'קורס הלוויתנים',
  description: 'קורס דיגיטלי פרקטי ומעשי שכולל בתוכו קונספטים ואסטרטגיית מסחר יומי מוכחת! \nהקורס פונה לסוחרים מתקדמים בשוק ההון שרוצים לקחת את המסחר שלהם לרמה הבאה! וללמוד אסטרטגיית מסחר מקצועית במסחר יומי!',
  cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/Wheles.png`,
    instructor: {
      name: 'דוד אריאל',
      avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
    rating: 4.9,
    students: 1250
  },
  duration: '4 שעות',
  level: 'מתקדם',
  rating: 4.8,
  students: 1250,
  lessons: [
    {
      id: 'lesson-1',
      title: 'הכירות עם הקורס',
      duration: '01:20',
      description: 'הכרות עם הקורס והנושאים שילמדו בו',
      completed: true,
      type: 'video',
        vimeoId: '1095579213',
        thumbnail: 'https://vumbnail.com/1095579213.jpg',
        videoUrl: 'https://vimeo.com/1095579213?share=copy'
    },
    {
      id: 'lesson-2', 
      title: 'מה זה - Price Action',
      duration: '03:28',
      description: 'הבנת מושגי ה-Price Action והשימוש בהם',
      completed: false,
      type: 'video',
      vimeoId: '1095573038',
      thumbnail: 'https://vumbnail.com/1095573038.jpg',
      videoUrl: 'https://vimeo.com/1095573038?share=copy'
    },
    {
      id: 'lesson-3',
      title: 'מה זה - Liquidity',
      duration: '21:49', 
      description: 'הבנת מושג הנזילות והשפעתו על השוק',
      completed: false,
      type: 'video',
      vimeoId: '1095570862',
      thumbnail: 'https://vumbnail.com/1095570862.jpg',
      videoUrl: 'https://vimeo.com/1095570862?share=copy'
    },
    {
      id: 'lesson-4',
      title: 'מה זה - FVG',
      duration: '21:41',
      description: 'הבנת Fair Value Gaps וזיהוי הזדמנויות',
      completed: false,
      type: 'video',
      vimeoId: '1095761556',
      thumbnail: 'https://vumbnail.com/1095761556.jpg',
      videoUrl: 'https://vimeo.com/1095761556?share=copy'
    },
    {
      id: 'lesson-5',
      title: 'מה זה - IFVG',
      duration: '09:37',
      description: 'הבנת Imbalanced Fair Value Gaps',
      completed: false,
      type: 'video',
      vimeoId: '1095760652',
      thumbnail: 'https://vumbnail.com/1095760652.jpg',
      videoUrl: 'https://vimeo.com/1095760652?share=copy'
    },
    {
      id: 'lesson-6',
      title: 'אסטרטגיית - מודל PO3',
      duration: '24:15',
      description: 'לימוד מודל PO3 ואסטרטגיות מסחר',
      completed: false,
      type: 'video',
      vimeoId: '1095776680',
      thumbnail: 'https://vumbnail.com/1095776680.jpg',
      videoUrl: 'https://vimeo.com/1095776680?share=copy'
    },
    {
      id: 'lesson-7',
      title: 'אסטרטגיית - Golden Zone + FVG',
      duration: '09:13',
      description: 'שילוב Golden Zone עם Fair Value Gaps',
      completed: false,
      type: 'video',
      vimeoId: '1099364716',
      thumbnail: 'https://vumbnail.com/1099364716.jpg',
      videoUrl: 'https://vimeo.com/1099364716?share=copy'
    },
    {
      id: 'lesson-8',
      title: 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)',
      duration: '47:49',
      description: 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה',
      completed: false,
      type: 'video',
      vimeoId: '1108814085',
      thumbnail: 'https://vumbnail.com/1108814085.jpg',
      videoUrl: 'https://vimeo.com/1108814085?share=copy'
    },
    {
      id: 'lesson-9',
      title: 'הלוויתנים מקנאים בכם!',
      duration: '07:07',
      description: 'הבנת התנהגות הלוויתנים והשפעתם על השוק',
      completed: false,
      type: 'video',
      vimeoId: '1095763209',
      thumbnail: 'https://vumbnail.com/1095763209.jpg',
      videoUrl: 'https://vimeo.com/1095763209?share=copy'
    }
  ]
};

function LearningScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const mainTabsHeight = useMainTabsHeight();
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
  const [notesModalVisible, setNotesModalVisible] = useState(false);
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
  const [isSaving, setIsSaving] = useState(false);
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
  const durationUpdatedRef = useRef<Set<string>>(new Set()); // מעקב אחרי שיעורים שכבר עדכנו את ה-duration
  const durationCheckInProgressRef = useRef<Set<string>>(new Set()); // מעקב אחרי שיעורים שבתהליך בדיקה
  const lastProgressSaveTimeRef = useRef<number>(0); // מעקב אחרי הזמן האחרון שעודכן במסד נתונים
  const lastProgressPercentageRef = useRef<number>(0); // מעקב אחרי האחוז האחרון (למניעת קפיצות ל-0)

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

  // טעינת נתונים מהמסד
  useEffect(() => {
    loadCourseData();
  }, [user, routeCourseId]);

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
      
      if (!course) {
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
              let duration = '00:00';
              
              // פונקציה לעיצוב duration בפורמט MM:SS או HH:MM:SS
              const formatDuration = (minutes?: number) => {
                if (!minutes) return '00:00';
                const totalSeconds = minutes * 60;
                const hours = Math.floor(totalSeconds / 3600);
                const remainingSeconds = totalSeconds % 3600;
                const mins = Math.floor(remainingSeconds / 60);
                const secs = remainingSeconds % 60;
                
                if (hours > 0) {
                  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                } else {
                  return `${mins}:${secs.toString().padStart(2, '0')}`;
                }
              };
              
              // נחפש את השיעור בנתונים האמיתיים
              const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
              if (demoLesson?.duration) {
                duration = demoLesson.duration;
              } else if (media?.duration_minutes) {
                duration = formatDuration(media.duration_minutes);
              } else if (lesson.duration_minutes) {
                duration = formatDuration(lesson.duration_minutes);
              }
              
              // נשתמש ב-thumbnail מ-Vimeo או YouTube
              let thumbnailUrl = '';
              if (media?.vimeo_id) {
                thumbnailUrl = `https://vumbnail.com/${media.vimeo_id}.jpg`;
              } else if (media?.youtube_id) {
                thumbnailUrl = `https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg`;
              } else if (lesson.youtubeId) {
                thumbnailUrl = `https://img.youtube.com/vi/${lesson.youtubeId}/maxresdefault.jpg`;
              } else {
                thumbnailUrl = `https://vumbnail.com/${lesson.id}.jpg`;
              }
              
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
                type: 'video'
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
            setUserNotes(textContent);
          } else {
            setUserNotes(notes.notes_content);
          }
        } catch {
          // זה טקסט רגיל
          setUserNotes(notes.notes_content);
        }
      } else {
        setUserNotes('');
      }
    } catch (error) {
      setUserNotes('');
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
    const newText = currentText + ' **טקסט מודגש** ';
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
        const newText = currentText + `\n\n📷 [תמונה נוספה]\n${imageUri}\n\n`;
        setUserNotes(newText);
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן לבחור תמונה');
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
    const newText = currentText + ` <span style="color: ${selectedColor}">טקסט צבעוני</span> `;
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
      legacyAlert('שגיאה', 'לא ניתן לבחור תמונה');
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
    const dateTime = now.toLocaleString('he-IL');
    addTextElement('datetime', dateTime);
  };

  const addListElement = () => {
    addTextElement('list', 'נקודה חדשה');
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
        let duration = lesson.duration || '00:00';
        
        // פונקציה לעיצוב duration בפורמט MM:SS או HH:MM:SS
        const formatDuration = (minutes?: number) => {
          if (!minutes) return '00:00';
          const totalSeconds = minutes * 60;
          const hours = Math.floor(totalSeconds / 3600);
          const remainingSeconds = totalSeconds % 3600;
          const mins = Math.floor(remainingSeconds / 60);
          const secs = remainingSeconds % 60;
          
          if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          } else {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        };
        
        // נחפש את השיעור בנתונים האמיתיים
        const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
        if (demoLesson?.duration) {
          duration = demoLesson.duration;
        } else if (media.duration_minutes) {
          duration = formatDuration(media.duration_minutes);
        }
        
        const updatedLesson = {
          ...lesson,
          vimeoId: media.vimeo_id,
          thumbnail: `https://vumbnail.com/${media.vimeo_id}.jpg`,
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
    legacyAlert('מעולה!', 'השיעור הושלם בהצלחה!', [
      { text: 'המשך', onPress: () => setSelectedLesson(null) }
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
    // משתמשים ב-duration ב-key כדי ש-React יעדכן את הקומפוננטה כשהערך משתנה
    const lessonKey = `${lesson.id}_${lesson.duration || '00:00'}`;
    return (
    <Animated.View
      key={lessonKey}
      style={[
        { marginBottom: DesignTokens.spacing.lg, transform: [{ scale: animatedValue }] }
      ]}
    >
      <UICard variant="blur" padding="none" style={styles.lessonGlassCard}>
      <TouchableOpacity
        style={styles.lessonTouchable}
        onPress={() => handleLessonPress(lesson, index)}
        activeOpacity={0.8}
      >
        <View style={styles.lessonThumbnail}>
          {lesson.thumbnail ? (
          <Image 
            source={{ uri: lesson.thumbnail }} 
            style={styles.thumbnailImage}
            resizeMode="cover"
              onError={() => {}}
              onLoad={() => {}}
          />
          ) : (
            <View style={[styles.thumbnailImage, { backgroundColor: DesignTokens.colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: DesignTokens.colors.text.primary, fontSize: DesignTokens.typography.fontSize['2xl'] }}>🎥</Text>
            </View>
          )}
          <View style={styles.lessonNumberOnThumb} accessibilityLabel={`שיעור ${index + 1}`}>
            <Text style={styles.lessonNumberOnThumbText}>{index + 1}</Text>
          </View>
          <View style={[
            styles.durationBadge,
            {
              backgroundColor: isDarkMode ? DesignTokens.colors.overlay : DesignTokens.colors.background.secondary,
            }
          ]}>
            <Text style={[
              styles.durationText,
              {
                color: DesignTokens.colors.text.primary,
              }
            ]}>{lesson.duration || '00:00'}</Text>
          </View>
          {lesson.completed && (
            <View style={[
              styles.completedBadge,
              {
                backgroundColor: isDarkMode ? DesignTokens.colors.overlay : DesignTokens.colors.background.secondary,
              }
            ]}>
              <CheckCircle2 size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            </View>
          )}
        </View>
        
        <View style={styles.lessonContent}>
          <View style={styles.lessonCardTextCol}>
            <Text style={styles.lessonCardTitle} numberOfLines={2}>
              {lesson.title}
            </Text>
            {lesson.description ? (
              <Text style={styles.lessonDescription} numberOfLines={3}>
                {lesson.description}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      </UICard>
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
              { backgroundColor: DesignTokens.colors.primary.dim },
            ]}
          >
            <Text
              style={[
                styles.chapterHeaderBadgeText,
                { color: DesignTokens.colors.primary.main },
              ]}
            >
              פרק {chapterNum}
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
        ? 'טוען…'
        : `${formatTime(progressSeconds)} / ${formatTime(durationSeconds)}`;
    const pctDisplay =
      durationSeconds <= 0 && isLoading ? '…' : `${Math.min(100, Math.max(0, Math.round(lessonProgress)))}%`;
    const barWidthPct =
      durationSeconds > 0
        ? Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100)))
        : isLoading
          ? 0
          : Math.min(100, Math.max(0, Math.round(lessonProgress)));

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
    const lessonPlayerVideoHeight = Math.round((screenWidth * 9) / 16);
    const canGoPrev = currentLessonIndex > 0;
    const canGoNext = currentLessonIndex >= 0 && currentLessonIndex < lessonsForNav.length - 1;
    const goToPrevLesson = () => {
      if (!canGoPrev) return;
      handleLessonPress(lessonsForNav[currentLessonIndex - 1], currentLessonIndex - 1);
    };
    const goToNextLesson = () => {
      if (!canGoNext) return;
      handleLessonPress(lessonsForNav[currentLessonIndex + 1], currentLessonIndex + 1);
    };

    return (
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <RNSafeAreaView style={styles.safeAreaContent} edges={['top']}>
        <AcademySubScreenBar
          onBackPress={async () => {
            if (user && courseData && selectedLesson && progress > 0 && duration > 0) {
              await updateLessonProgress(progress, duration);
            }
            setIsYouTubePlayerReady(false);
            durationUpdatedRef.current.clear();
            durationCheckInProgressRef.current.clear();
            setSelectedLesson(null);
          }}
          title={selectedLesson.title}
          subtitle={
            courseData?.title
              ? `שיעור ${lessonNumberLabel} · ${courseData.title}`
              : `שיעור ${lessonNumberLabel}`
          }
        />

          <View style={styles.lessonMainContent}>
          <ScrollView
            style={styles.contentSection}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {/* וידאו — מלא רוחב, מנותק מהכרטיסיות */}
            <View style={[styles.lessonVideoBleed, { height: lessonPlayerVideoHeight }]}>
              <View style={styles.videoContainer}>
            {videoType === 'youtube' && videoId ? (
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
                  legacyAlert('שגיאה', 'שגיאה בטעינת הסרטון. נסה לפתוח ב-YouTube.');
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
                source={{ html: videoHTML }}
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
                legacyAlert('שגיאה', `שגיאה בטעינת הסרטון: ${nativeEvent.description || 'שגיאה לא ידועה'}`);
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
                <Text style={styles.videoErrorText}>וידאו לא זמין</Text>
                {selectedLesson.youtubeUrl && (
                  <TouchableOpacity 
                    style={styles.youtubeButton}
                    onPress={() => {
                      Linking.openURL(selectedLesson.youtubeUrl);
                    }}
                  >
                    <Text style={styles.youtubeButtonText}>פתח ב-YouTube</Text>
                  </TouchableOpacity>
                )}
                {!selectedLesson.youtubeId && !selectedLesson.youtubeUrl && (
                  <Text style={styles.videoErrorSubtext}>
                    לא נמצא קישור יוטיוב לשיעור זה
                  </Text>
                )}
              </View>
            )}
                </View>
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <View style={styles.loadingSpinner}>
                    <RefreshCw size={32} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.loadingText}>טוען וידאו...</Text>
                </View>
              )}
            </View>

            {/* פרטי שיעור + פרוגרס */}
            <UICard variant="blur" padding="md" style={styles.lessonGlassCard}>
              <Text style={styles.lessonPlayerIndex}>שיעור {lessonNumberLabel}</Text>
              <Text style={styles.lessonCardTitle} numberOfLines={3}>
                {selectedLesson.title}
              </Text>
              {lessonDescriptionDisplay ? (
                <Text style={styles.lessonDescription} numberOfLines={4}>
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
                      <CheckCircle2 size={16} color={DesignTokens.colors.success.main} strokeWidth={2} />
                      <Text style={styles.completedText}>הושלם</Text>
                    </View>
                  )}
              </View>
            </UICard>

            {/* ניווט שיעורים — כמו יומן כלכלי / מעבר ימים */}
            <UICard
              variant="blur"
              glassIntensity="subtle"
              padding="sm"
              style={styles.lessonNavShell}
            >
              <View style={styles.lessonNavRowStandard}>
                <DayNavBlurButton
                  onPress={goToPrevLesson}
                  disabled={!canGoPrev}
                  glassIntensity="subtle"
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={canGoPrev ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
                  />
                </DayNavBlurButton>

                <View style={styles.lessonNavCenter}>
                  <Text style={styles.lessonNavCenterTitle} numberOfLines={2}>
                    שיעור {lessonNumberLabel} מתוך {lessonsForNav.length || 1}
                  </Text>
                  {(canGoPrev || canGoNext) && (
                    <Text style={styles.lessonNavCenterSub} numberOfLines={1}>
                      ניווט בין שיעורים
                    </Text>
                  )}
                </View>

                <DayNavBlurButton
                  onPress={goToNextLesson}
                  disabled={!canGoNext}
                  glassIntensity="subtle"
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={canGoNext ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
                  />
                </DayNavBlurButton>
              </View>
            </UICard>

            {/* הערות אישיות — שורת הגדרות סטנדרטית */}
            <UICard variant="blur" padding="none" style={styles.lessonGlassCard}>
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.impactLight();
                  setNotesModalVisible(true);
                }}
                activeOpacity={0.7}
                style={styles.notesSettingsRow}
              >
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                <View style={styles.notesSettingsTextCol}>
                  <Text style={styles.notesSettingsTitle}>הערות אישיות</Text>
                  <Text style={styles.notesSettingsSubtitle} numberOfLines={2}>
                    {userNotes.trim()
                      ? userNotes.length > 80
                        ? `${userNotes.substring(0, 80)}...`
                        : userNotes
                      : 'לחץ לעריכה והוספת הערות לשיעור'}
                  </Text>
                </View>
                <View style={styles.notesSettingsIcon}>
                  <Edit3 size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>
            </UICard>
          </ScrollView>
          </View>
        {/* Notes Bottom Sheet */}
        <BottomSheet
          isOpen={notesModalVisible}
          onClose={() => {
            if (!isSaving) {
              setNotesModalVisible(false);
            }
          }}
          snapPoints={[0.85]}
          enablePanDownToClose={!isSaving}
          backdropOpacity={0.5}
          edgeToEdge
          showHandle
          showBrandBackground
          showBrandWatermark={false}
          contentPaddingBottom={0}
          topCornerRadius={28}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.notesSheetContent}
          >
            <View style={styles.notesSheetHeader}>
              <DayNavBlurButton
                onPress={() => !isSaving && setNotesModalVisible(false)}
                size={DAY_NAV_BUTTON_SIZE}
                glassIntensity="subtle"
                style={styles.notesSheetHeaderIcon}
                accessibilityLabel="סגור"
                disabled={isSaving}
              >
                <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
              </DayNavBlurButton>

              <View style={styles.notesSheetHeaderCenter}>
                <Text style={[styles.notesSheetHeaderTitle, rtlText, { color: DesignTokens.colors.text.primary }]}>
                  הערות אישיות
                </Text>
                <Text
                  style={[styles.notesSheetHeaderSubtitle, rtlText, { color: DesignTokens.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {selectedLesson?.title ?? 'נשמרות לחשבון שלך מכל מכשיר'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.selection();
                  setUserNotes('');
                }}
                style={styles.notesSheetHeaderTextBtn}
                disabled={!userNotes.length || isSaving}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.notesSheetHeaderTextBtnLabel,
                    (!userNotes.length || isSaving) && styles.notesSheetHeaderTextBtnLabelDisabled,
                  ]}
                >
                  נקה
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.notesSheetScroll}
              contentContainerStyle={styles.notesSheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <UICard variant="inputGlass" padding="none" style={styles.notesSheetInputShell}>
                <TextInput
                  ref={textInputRef}
                  style={[
                    styles.notesSheetInput,
                    rtlText,
                    { color: DesignTokens.colors.text.primary },
                    Platform.OS === 'android' && { includeFontPadding: false },
                  ]}
                  placeholder="כתבו מחשבות, רעיונות ותזכורות מהשיעור..."
                  placeholderTextColor={DesignTokens.colors.text.tertiary}
                  value={userNotes}
                  onChangeText={setUserNotes}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              </UICard>

              <Text style={[styles.notesSheetHint, rtlText, { color: DesignTokens.colors.text.tertiary }]}>
                ההערות נשמרות לחשבון שלך וזמינות מכל מכשיר
              </Text>
            </ScrollView>

            <RNSafeAreaView edges={['bottom']} style={styles.notesSheetFooter}>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedLesson && !isSaving) {
                    void HapticFeedback.medium();
                    try {
                      setIsSaving(true);
                      await saveUserNotes(selectedLesson.id, userNotes);
                      legacyAlert('נשמר!', 'ההערות נשמרו בהצלחה');
                      setNotesModalVisible(false);
                    } catch (error) {
                      legacyAlert('שגיאה', 'לא ניתן לשמור את ההערות');
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                disabled={isSaving}
                activeOpacity={0.85}
                style={[styles.notesSheetSavePrimary, isSaving && styles.notesSheetSavePrimaryDisabled]}
                accessibilityRole="button"
                accessibilityLabel="שמור הערות"
              >
                {isSaving ? (
                  <View style={styles.notesSheetSavePrimaryContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.notesSheetSavePrimaryText}>שומר…</Text>
                  </View>
                ) : (
                  <Text style={styles.notesSheetSavePrimaryText}>שמור הערות</Text>
                )}
              </TouchableOpacity>
            </RNSafeAreaView>
          </KeyboardAvoidingView>
        </BottomSheet>

        {/* Link Dialog */}
        <Modal
          visible={showLinkDialog}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLinkDialog(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>הוספת קישור</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="טקסט הקישור"
                value={linkText}
                onChangeText={setLinkText}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="כתובת הקישור"
                value={linkUrl}
                onChangeText={setLinkUrl}
                keyboardType="url"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setShowLinkDialog(false)}
                >
                  <Text style={styles.modalButtonText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={confirmLinkElement}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>הוסף</Text>
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
              <Text style={styles.modalTitle}>בחירת צבע</Text>
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
                  <Text style={styles.modalButtonText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => setShowColorPicker(false)}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>אישור</Text>
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
  const displayDescription = (courseData?.description ?? '').trim();
  const displayInstructorName = courseData?.instructor_name || courseData?.owner?.display_name;
  const displayInstructorAvatar = courseData?.instructor_avatar || courseData?.owner?.avatar_url;

  if (!courseData) {
    return null;
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
      ? 'אין שיעורים בקורס'
      : `${completedLessonsCount}/${totalLessonsCount} הושלמו`;
  const courseHeroHeight = Math.round(academyCardWidth(screenWidth) * 0.58);

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContent} edges={['top']}>
        <AcademySubScreenBar
          onBackPress={handleBackToAcademy}
          title={displayTitle ?? 'קורס'}
          subtitle={
            displayInstructorName
              ? `${displayInstructorName}${totalLessonsCount > 0 ? ` · ${totalLessonsCount} שיעורים` : ''}`
              : totalLessonsCount > 0
                ? `${totalLessonsCount} שיעורים`
                : undefined
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.courseListScroll,
            { paddingBottom: Math.max(mainTabsHeight, DesignTokens.spacing['5xl']) },
          ]}
        >
          <View style={styles.courseListBody}>
            {/* באנר בכרטיס — תמונה + גרדיאנט שחור + שם */}
            <UICard variant="blur" padding="none" style={styles.lessonGlassCard}>
              <View style={[styles.courseHeroCover, { height: courseHeroHeight }]}>
                {displayCoverUrl ? (
                  <Image
                    source={{ uri: displayCoverUrl }}
                    style={styles.courseHeroImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.courseHeroImage, styles.courseCoverPlaceholder]}>
                    <Text style={styles.courseCoverPlaceholderIcon}>📚</Text>
                  </View>
                )}
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0.45)',
                    'rgba(0,0,0,0.88)',
                  ]}
                  locations={[0, 0.42, 1]}
                  style={styles.courseHeroGradient}
                  pointerEvents="none"
                />
                <View style={styles.courseHeroText}>
                  <Text style={styles.courseHeroTitle} numberOfLines={3}>
                    {displayTitle}
                  </Text>
                  {courseData?.subtitle ? (
                    <Text style={styles.courseHeroSubtitle} numberOfLines={2}>
                      {courseData.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            </UICard>

            {/* פרטי קורס + התקדמות */}
            <UICard variant="blur" padding="md" style={styles.lessonGlassCard}>
              {displayDescription ? (
                <Text style={styles.courseDescription}>{displayDescription}</Text>
              ) : null}

              {displayInstructorName ? (
                <View style={styles.instructorContainer}>
                  {displayInstructorAvatar ? (
                    <Image source={{ uri: displayInstructorAvatar }} style={styles.instructorAvatar} />
                  ) : (
                    <View style={[styles.instructorAvatar, styles.instructorAvatarFallback]}>
                      <Text style={styles.instructorAvatarInitial}>
                        {displayInstructorName.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.instructorInfo}>
                    <Text style={styles.instructorName}>{displayInstructorName}</Text>
                    <Text style={styles.instructorRole}>
                      {courseData?.owner?.bio || 'מרצה הקורס'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.lessonPlayerProgressBlock,
                  !displayDescription && !courseData?.subtitle && !displayInstructorName
                    ? styles.lessonPlayerProgressBlockCompact
                    : null,
                ]}
              >
                {lessonsProgressLoading ? (
                  <>
                    <View style={styles.progressTextRow}>
                      <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
                      <Text style={styles.progressTextMuted}>טוען התקדמות…</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: '0%' }]} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.progressTimeRow}>
                      <Text style={styles.progressText}>{courseProgressLabel}</Text>
                      <Text style={styles.progressPercentageText}>{courseProgressPct}%</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${courseProgressPct}%`,
                            minWidth: courseProgressPct > 0 ? 4 : 0,
                          },
                        ]}
                      />
                    </View>
                  </>
                )}
              </View>
            </UICard>

            {/* רשימת שיעורים */}
            <View style={styles.lessonsSection}>
              <Text style={styles.courseListSectionTitle}>שיעורי הקורס</Text>

              {renderChapterBlock(1, 'כמה דברים לפני שמתחילים', lessonsList.slice(0, 1), 0)}
              {renderChapterBlock(2, 'קונספטים ואסטרטגיה', lessonsList.slice(1, 8), 1)}
              {renderChapterBlock(3, 'כמה דברים לקראת סיום', lessonsList.slice(8), 8)}
            </View>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </ScreenChrome>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  courseListScroll: {
    paddingTop: tokens.spacing.sm,
  },
  courseListBody: {
    paddingHorizontal: ACADEMY_CARD_HP,
    paddingTop: tokens.spacing.sm,
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
  courseHeroTitle: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: '800' as const,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize['2xl'] * 1.2),
    writingDirection: 'rtl',
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
    writingDirection: 'rtl',
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
    fontSize: tokens.typography.caption.size,
    fontWeight: '800' as const,
    color: tokens.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: tokens.typography.letterSpacing.wide,
    textAlign: 'right',
    marginBottom: tokens.spacing.lg,
    writingDirection: 'rtl',
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
    writingDirection: 'rtl',
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
  lessonGlassCard: {
    marginBottom: tokens.spacing.lg,
    borderRadius: ACADEMY_CARD_RADIUS,
    overflow: 'hidden',
  },
  lessonVideoBleed: {
    marginHorizontal: -ACADEMY_CARD_HP,
    marginBottom: tokens.spacing.lg,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  lessonPlayerIndex: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '700' as const,
    color: tokens.colors.primary.main,
    textAlign: 'right',
    marginBottom: tokens.spacing.xs,
    writingDirection: 'rtl',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
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
  },
  lessonPlayerProgressBlock: {
    width: '100%',
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: tokens.spacing.sm,
  },
  lessonPlayerProgressBlockCompact: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  lessonNavShell: {
    marginBottom: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
  },
  lessonNavRowStandard: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  lessonNavCenterTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: '600' as const,
    lineHeight: 21,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  lessonNavCenterSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600' as const,
    color: tokens.colors.primary.main,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  notesSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.base,
  },
  notesSettingsTextCol: {
    flex: 1,
    marginHorizontal: tokens.spacing.md,
  },
  notesSettingsTitle: {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs / 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notesSettingsSubtitle: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.bodySmall.weight as any,
    lineHeight: tokens.typography.bodySmall.lineHeight,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notesSettingsIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: `${tokens.colors.primary.main}1A`,
    alignItems: 'center',
    justifyContent: 'center',
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
    writingDirection: 'rtl',
  },
  lessonInfoDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.body.lineHeight,
    writingDirection: 'rtl',
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
    writingDirection: 'rtl',
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
    ...StyleSheet.absoluteFillObject,
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
    writingDirection: 'rtl',
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
    writingDirection: 'rtl',
  },

  notesSheetContent: {
    flex: 1,
    backgroundColor: 'transparent',
    direction: 'rtl',
  },
  notesSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NOTES_SHEET_BORDER,
    gap: 10,
  },
  notesSheetHeaderIcon: {
    alignSelf: 'center',
  },
  notesSheetHeaderCenter: {
    flex: 1,
    alignItems: 'flex-start',
  },
  notesSheetHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  notesSheetHeaderSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  notesSheetHeaderTextBtn: {
    minWidth: DAY_NAV_BUTTON_SIZE,
    height: DAY_NAV_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSheetHeaderTextBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primary.main,
  },
  notesSheetHeaderTextBtnLabelDisabled: {
    color: tokens.colors.text.tertiary,
  },
  notesSheetScroll: {
    flex: 1,
  },
  notesSheetScrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 14,
    gap: 12,
    direction: 'rtl',
  },
  notesSheetInputShell: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notesSheetInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontSize: 15,
    lineHeight: tokens.typography.body.lineHeight,
    textAlignVertical: 'top',
    minHeight: 220,
    width: '100%',
    paddingVertical: 4,
  },
  notesSheetHint: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  notesSheetFooter: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 8 : 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NOTES_SHEET_BORDER,
    backgroundColor: tokens.colors.background.secondary,
  },
  notesSheetSavePrimary: {
    height: 50,
    borderRadius: 14,
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
    color: '#fff',
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
    paddingTop: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  lessonProgressInfoNoDescription: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  progressTimeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  progressTimeText: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  progressPercentageText: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.titleXs.weight as any,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: `${tokens.colors.border.primary}99`,
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
  completedText: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.success.main,
    fontWeight: tokens.typography.fontWeight.medium as any,
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
    writingDirection: 'rtl',
  },
  courseSubtitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleSmall.size * 1.35),
    writingDirection: 'rtl',
  },
  courseDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.body.size * 1.5),
    textAlign: 'right',
    writingDirection: 'rtl',
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
  
  // Instructor
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  instructorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  instructorAvatarFallback: {
    backgroundColor: tokens.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructorAvatarInitial: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold as any,
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleXs.size * 1.3),
    writingDirection: 'rtl',
  },
  instructorRole: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginTop: tokens.spacing.xs,
    lineHeight: Math.round(tokens.typography.bodySmall.size * 1.35),
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
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  chapterHeaderTitle: {
    flex: 1,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '800' as const,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.lg * 1.25),
    writingDirection: 'rtl',
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
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '800' as const,
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
    writingDirection: 'rtl',
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  progressTextMuted: {
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'right',
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: 'rtl',
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
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    lineHeight: Math.round(tokens.typography.bodySmall.size * 1.45),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lessonStatus: {
    marginTop: 2,
  },
  completedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.success.main,
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

export default LearningScreen;

