import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Dimensions, Alert, Platform, TextInput, SafeAreaView, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Modal, Linking } from 'react-native';
// import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { XCircle, CheckCircle2, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Edit3, ChevronUp, ChevronDown, Save, X, Type, ImageIcon, Palette, PlusCircle, Star, Clock, TrendingUp, Video as VideoIcon } from 'lucide-react-native';
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

const DEMO_COURSE = {
  id: 'demo-course-1',
  title: 'קורס הלוויתנים',
  description: 'קורס דיגיטלי פרקטי ומעשי שכולל בתוכו קונספטים ואסטרטגיית מסחר יומי מוכחת! \nהקורס פונה לסוחרים מתקדמים בשוק ההון שרוצים לקחת את המסחר שלהם לרמה הבאה! וללמוד אסטרטגיית מסחר מקצועית במסחר יומי!',
  cover_url: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/Wheles.png',
    instructor: {
      name: 'דוד אריאל',
      avatar: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/channels4_profile.jpg',
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
  const { courseId: routeCourseId, lessonId: routeLessonId } = route.params as { courseId?: string; lessonId?: string } || {};
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
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
        console.log('🔄 Starting YouTube progress tracking interval');
        
        // התחלת מעקב התקדמות דרך getCurrentTime ו-getDuration
        progressIntervalRef.current = setInterval(async () => {
          // בדיקה אם ה-ref עדיין קיים
          if (!youtubePlayerRef.current) {
            console.log('⚠️ YouTube ref is null, stopping interval');
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
              console.log('📊 YouTube progress (interval):', { 
                currentTime: currentTime.toFixed(1), 
                duration: duration.toFixed(1),
                isPlaying 
              });
              setProgress(currentTime);
              setDuration(duration);
              const progressPercentage = Math.round((currentTime / duration) * 100);
              
              // בדיקה שהפרוגרס תקין ולא קופץ ל-0 (למניעת קפיצות)
              if (progressPercentage >= 0 && progressPercentage <= 100) {
                // אם הפרוגרס קופץ ל-0 בעוד שהיה ערך לפני, נשמור את הערך הקודם
                if (progressPercentage === 0 && lastProgressPercentageRef.current > 0 && currentTime > 1) {
                  // לא נעדכן אם הפרוגרס קופץ ל-0 בעוד שהזמן הנוכחי הוא יותר מ-1 שנייה
                  console.log('⚠️ Skipping progress update - jumped to 0:', { 
                    currentTime, 
                    previousProgress: lastProgressPercentageRef.current 
                  });
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
                          const success = await mediaService.updateLessonDuration(courseData.id, selectedLesson.id, duration);
                          if (success) {
                            console.log('✅ Updated lesson duration in database:', { 
                              courseId: courseData.id, 
                              lessonId: selectedLesson.id, 
                              durationMinutes: Math.round(duration / 60),
                              durationSeconds: duration
                            });
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error checking/updating duration:', error);
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
            } else {
              console.log('⚠️ Invalid time values:', { currentTime, duration });
            }
          } catch (error) {
            console.error('❌ Error getting YouTube progress:', error);
            // לא עוצרים את ה-interval גם אם יש שגיאה - מנסים שוב בפעם הבאה
          }
        }, 1000); // בדיקה כל שנייה
      }
    }
    
    // ניקוי ה-interval כשהקומפוננטה נסגרת או כשהשיעור משתנה
    return () => {
      console.log('🧹 Cleaning up YouTube progress interval');
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
    console.log('useEffect triggered, user:', user?.id, 'courseId:', routeCourseId);
    loadCourseData();
  }, [user, routeCourseId]);

  // פתיחת שיעור ספציפי אם יש lessonId
  useEffect(() => {
    if (routeLessonId && lessonsData.length > 0 && courseData) {
      const lesson = lessonsData.find((l: any) => l.id === routeLessonId);
      if (lesson) {
        console.log('Opening specific lesson:', routeLessonId);
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
    console.log('loadCourseData called');
    try {
      // נטען את הקורס מהמסד (או ניצור אותו אם לא קיים)
      // אם אין routeCourseId, לא נטען כלום (לא נשתמש ב-default)
      if (!routeCourseId) {
        console.log('No courseId provided, skipping load');
        return;
      }
      const courseId = routeCourseId;
      console.log('Getting course by ID:', courseId);
      let course = await courseService.getCourseById(courseId);
      console.log('Course from database:', course);
      
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
        console.log('Getting course lessons...');
        const lessons = await courseService.getCourseLessons(courseId);
        console.log('Loaded lessons from database:', lessons);
        console.log('Number of lessons found:', lessons?.length || 0);
        
        if (lessons && lessons.length > 0) {
          // נטען את קישורי המדיה לכל השיעורים בבת אחת
          console.log('Getting course media...');
          const mediaLinks = await mediaService.getCourseMedia(courseId);
          console.log('Loaded media links:', mediaLinks);
          console.log('Number of media links found:', mediaLinks.length);
          
          // נטען את ההתקדמות של כל שיעור ואת קישורי המדיה
          console.log('Processing lessons with media...');
          const updatedLessons = await Promise.all(
            lessons.map(async (lesson: any) => {
              console.log(`Processing lesson: ${lesson.id} - ${lesson.title}`);
              const userProgress = user ? await learningProgressService.getUserProgress(user.id, courseId, lesson.id) : null;
              const media = mediaLinks.find(m => m.lesson_id === lesson.id);
              console.log(`Lesson ${lesson.id} media:`, media);
              
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
              console.log(`Lesson ${lesson.id} demo lesson:`, demoLesson);
              if (demoLesson?.duration) {
                duration = demoLesson.duration;
                console.log(`Lesson ${lesson.id} using demo duration:`, duration);
              } else if (media?.duration_minutes) {
                duration = formatDuration(media.duration_minutes);
                console.log(`Lesson ${lesson.id} using media duration:`, duration);
              } else if (lesson.duration_minutes) {
                duration = formatDuration(lesson.duration_minutes);
                console.log(`Lesson ${lesson.id} using lesson duration:`, duration);
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
              console.log(`Lesson ${lesson.id} thumbnail URL:`, thumbnailUrl);
              console.log(`Lesson ${lesson.id} media vimeo_id:`, media?.vimeo_id);
              console.log(`Lesson ${lesson.id} lesson id:`, lesson.id);
              console.log(`Lesson ${lesson.id} duration:`, duration);
              console.log(`Lesson ${lesson.id} vimeoId:`, media?.vimeo_id);
              console.log(`Lesson ${lesson.id} final data:`, {
                title: lesson.title,
                thumbnail: thumbnailUrl,
                duration: duration,
                vimeoId: media?.vimeo_id,
                demoLesson: demoLesson
              });
              
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
          console.log('Updated lessons with media:', updatedLessons);
          console.log('Setting lessons data...');
          setLessonsData(updatedLessons);
          // עדכון animatedValues למספר השיעורים
          setAnimatedValues(updatedLessons.map(() => new Animated.Value(1)));
          console.log('Lessons data set successfully');
          console.log('First lesson thumbnail:', updatedLessons[0]?.thumbnail);
          console.log('First lesson duration:', updatedLessons[0]?.duration);
          console.log('All lessons durations:', updatedLessons.map(l => ({ id: l.id, title: l.title, duration: l.duration })));
        } else {
          // אם אין שיעורים במסד, לא נציג כלום
          console.log('No lessons found in database');
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
        console.log('Course not found in database');
        setCourseData(null);
        setLessonsData([]);
        setTotalProgress(0);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      // אם יש שגיאה, לא נציג כלום (לא DEMO_COURSE)
      setCourseData(null);
      setLessonsData([]);
      setTotalProgress(0);
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
      console.error('Error loading user notes:', error);
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
      console.error('Error loading lesson media:', error);
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
      console.error('Error saving user notes:', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      console.error('Error picking image:', error);
      Alert.alert('שגיאה', 'לא ניתן לבחור תמונה');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      console.error('Error picking image:', error);
      Alert.alert('שגיאה', 'לא ניתן לבחור תמונה');
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
              color: '#FFFFFF'
            }]);
            setLastSavedContent(JSON.stringify([{
              id: Date.now().toString(),
              type: 'text',
              content: notes.notes_content,
              bold: false,
              color: '#FFFFFF'
            }]));
          }
        } catch (parseError) {
          // אם יש שגיאת JSON, יוצר אלמנט טקסט מהתוכן
          console.log('JSON parse error, treating as plain text:', parseError);
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
      console.error('Error loading notes:', error);
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
      console.log('📊 Loading user progress for lesson:', lesson.id);
      const userProgress = await learningProgressService.getUserProgress(user.id, courseData.id, lesson.id);
      
      // בדיקה אם זה YouTube או Vimeo (ללא שימוש בפונקציה חיצונית)
      const isYouTube = !!(lesson.youtubeId || lesson.youtubeUrl);
      console.log('🎥 Video type detection:', {
        lessonId: lesson.id,
        isYouTube,
        youtubeId: lesson.youtubeId,
        youtubeUrl: lesson.youtubeUrl,
        vimeoId: lesson.vimeoId
      });
      
      if (userProgress) {
        console.log('✅ User progress found:', {
          current_time_seconds: userProgress.current_time_seconds,
          total_duration_seconds: userProgress.total_duration_seconds,
          progress_percentage: userProgress.progress_percentage,
          is_completed: userProgress.is_completed
        });
        
        setLessonProgress(userProgress.progress_percentage);
        setProgress(userProgress.current_time_seconds);
        setDuration(userProgress.total_duration_seconds);
        lastProgressPercentageRef.current = userProgress.progress_percentage;
        
        // שמירת המיקום האחרון רק עבור YouTube (Vimeo מטפל בזה בעצמו)
        if (isYouTube) {
          console.log('🎬 Setting initial video position for YouTube:', userProgress.current_time_seconds);
          setInitialVideoPosition(userProgress.current_time_seconds);
        } else {
          console.log('🎬 Vimeo detected - not setting initial position (handles it itself)');
          setInitialVideoPosition(0); // Vimeo לא צריך את זה - הוא מטפל בזה בעצמו
        }
      } else {
        console.log('ℹ️ No user progress found - starting from beginning');
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
      console.log(`Loading media for lesson ${lesson.id}`);
      const media = await loadLessonMedia(lesson.id);
      console.log(`Media for lesson ${lesson.id}:`, media);
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
        console.log(`Lesson ${lesson.id} demo lesson in handleLessonPress:`, demoLesson);
        if (demoLesson?.duration) {
          duration = demoLesson.duration;
          console.log(`Lesson ${lesson.id} using demo duration in handleLessonPress:`, duration);
        } else if (media.duration_minutes) {
          duration = formatDuration(media.duration_minutes);
          console.log(`Lesson ${lesson.id} using media duration in handleLessonPress:`, duration);
        }
        
        const updatedLesson = {
          ...lesson,
          vimeoId: media.vimeo_id,
          thumbnail: `https://vumbnail.com/${media.vimeo_id}.jpg`,
          videoUrl: media.vimeo_url,
          duration: duration
        };
        console.log(`Updated lesson with media:`, updatedLesson);
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
        console.log('💾 Updating lesson progress in database:', {
          userId: user.id,
          courseId: courseData.id,
          lessonId: selectedLesson.id,
          currentTime: Math.floor(currentTime),
          totalTime: Math.floor(totalTime),
          progressPercentage: progress
        });
        await learningProgressService.updateWatchingTime(
          user.id,
          courseData.id,
          selectedLesson.id,
          currentTime,
          totalTime
        );
      } else {
        console.log('⚠️ Cannot update progress - missing data:', {
          hasUser: !!user,
          hasCourseData: !!courseData,
          hasSelectedLesson: !!selectedLesson
        });
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
      
      console.log(`שיעור ${selectedLesson.title} הושלם!`);
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
    Alert.alert('מעולה!', 'השיעור הושלם בהצלחה!', [
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
    console.log(`Rendering lesson card ${index}:`, lesson.title, 'thumbnail:', lesson.thumbnail, 'duration:', lesson.duration);
    console.log(`Lesson ${lesson.id} thumbnail check:`, {
      hasThumbnail: !!lesson.thumbnail,
      thumbnailUrl: lesson.thumbnail,
      vimeoId: lesson.vimeoId,
      duration: lesson.duration
    });
    const animatedValue = animatedValues[index] || new Animated.Value(1);
    // משתמשים ב-duration ב-key כדי ש-React יעדכן את הקומפוננטה כשהערך משתנה
    const lessonKey = `${lesson.id}_${lesson.duration || '00:00'}`;
    return (
    <Animated.View
      key={lessonKey}
      style={[
        styles.lessonCard,
        { transform: [{ scale: animatedValue }] }
      ]}
    >
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
              onError={(error) => {
              // אם התמונה לא נטענת, נשתמש בצבע רקע
                console.log('Thumbnail failed to load for lesson:', lesson.title, 'URL:', lesson.thumbnail, 'Error:', error);
              }}
              onLoad={() => {
                console.log('Thumbnail loaded successfully for lesson:', lesson.title, 'URL:', lesson.thumbnail);
            }}
          />
          ) : (
            <View style={[styles.thumbnailImage, { backgroundColor: DesignTokens.colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 24 }}>🎥</Text>
            </View>
          )}
          <View style={[
            styles.durationBadge,
            {
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : '#FFFFFF',
            }
          ]}>
            <Text style={[
              styles.durationText,
              {
                color: isDarkMode ? '#FFFFFF' : '#000000',
              }
            ]}>{lesson.duration || '00:00'}</Text>
          </View>
          {lesson.completed && (
            <View style={[
              styles.completedBadge,
              {
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : '#FFFFFF',
              }
            ]}>
              <CheckCircle2 size={24} color="#05d157" strokeWidth={2} />
            </View>
          )}
        </View>
        
        <View style={styles.lessonContent}>
          <View style={styles.lessonCardHeader}>
              <Text style={styles.lessonCardTitle}>{lesson.title}</Text>
            <View style={styles.lessonNumber}>
              <Text style={styles.lessonNumberText}>{index + 1}</Text>
            </View>
          </View>
          <Text style={styles.lessonDescription}>{lesson.description}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
  };

  // פונקציה לחילוץ YouTube ID מקישור
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    console.log('Extracting YouTube ID from URL:', url);
    
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
        console.log('Extracted YouTube ID:', videoId);
        return videoId;
      }
    }
    
    // אם זה כבר ID (11 תווים)
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      console.log('URL is already a YouTube ID:', cleanUrl);
      return cleanUrl;
    }
    
    console.log('Could not extract YouTube ID from URL:', url);
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
    console.log('Getting video ID for lesson:', {
      videoType,
      youtubeId: lesson.youtubeId,
      youtubeUrl: lesson.youtubeUrl,
      vimeoId: lesson.vimeoId
    });
    
    if (videoType === 'youtube') {
      // נסה קודם youtubeId
      if (lesson.youtubeId) {
        console.log('Using youtubeId:', lesson.youtubeId);
        return lesson.youtubeId;
      }
      // אם אין, נסה לחלץ מ-youtubeUrl
      if (lesson.youtubeUrl) {
        const extractedId = extractYouTubeId(lesson.youtubeUrl);
        if (extractedId) {
          console.log('Extracted ID from youtubeUrl:', extractedId);
          return extractedId;
        }
      }
    }
    
    if (videoType === 'vimeo') {
      return lesson.vimeoId || null;
    }
    
    console.log('No video ID found');
    return null;
  };

  if (selectedLesson) {
    const videoType = getVideoType(selectedLesson);
    const videoId = getVideoId(selectedLesson);
    
    console.log('Selected lesson:', {
      id: selectedLesson.id,
      title: selectedLesson.title,
      youtubeId: selectedLesson.youtubeId,
      youtubeUrl: selectedLesson.youtubeUrl,
      vimeoId: selectedLesson.vimeoId,
      videoType,
      videoId
    });
    
    // יצירת HTML לפי סוג הוידאו
    const getVideoHTML = () => {
      if (videoType === 'youtube' && videoId) {
        console.log('Creating YouTube HTML with videoId:', videoId);
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
    
    console.log('Video HTML created:', videoHTML ? 'Yes' : 'No');
    
    if (!videoHTML) {
      console.error('No video HTML generated!', {
        videoType,
        videoId,
        lesson: selectedLesson
      });
    }

    return (
      <View style={styles.lessonContainer}>
        {/* Header - extends to top of screen */}
        <View style={styles.newLessonHeader}>
          <View style={styles.newHeaderContent}>
            <Text style={styles.newLessonNumber}>
              שיעור {(() => {
                const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                return currentIndex >= 0 ? currentIndex + 1 : 1;
              })()}
            </Text>
            <Text style={styles.newLessonTitle} numberOfLines={2}>
              {selectedLesson.title}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.newBackButton}
            onPress={async () => {
              // שמירת המיקום האחרון לפני סגירה
              if (user && courseData && selectedLesson && progress > 0 && duration > 0) {
                await updateLessonProgress(progress, duration);
              }
              setIsYouTubePlayerReady(false); // איפוס flag כשסוגרים
              durationUpdatedRef.current.clear(); // איפוס מעקב duration כשסוגרים
              durationCheckInProgressRef.current.clear(); // איפוס מעקב בדיקות duration
              setSelectedLesson(null);
            }}
          >
            <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        
        {/* Safe Area for content */}
        <SafeAreaView style={styles.safeAreaContent}>
          
          {/* Main Content */}
          <View style={styles.lessonMainContent}>
          {/* Video Section */}
          <View style={styles.videoSection}>
            <View style={styles.videoContainer}>
            {videoType === 'youtube' && videoId ? (
              <YoutubePlayer
                ref={youtubePlayerRef}
                height={(screenWidth * 9) / 16}
                videoId={videoId}
                play={isPlaying}
                onChangeState={(event: string) => {
                  console.log('YouTube player state changed:', event);
                  if (event === 'ended') {
                    markLessonAsCompleted();
                  } else if (event === 'playing') {
                    setIsPlaying(true);
                  } else if (event === 'paused') {
                    setIsPlaying(false);
                  }
                }}
                onReady={() => {
                  console.log('✅ YouTube player ready');
                  console.log('📊 Initial video position:', initialVideoPosition);
                  console.log('📊 Current progress state:', { progress, duration, lessonProgress });
                  console.log('🔗 YouTube player ref:', youtubePlayerRef.current ? 'exists' : 'null');
                  setIsLoading(false);
                  setIsYouTubePlayerReady(true); // סמן שהפלייר מוכן להתחיל מעקב
                  
                  // הצבת הסרטון במיקום האחרון כשהפלייר מוכן
                  if (initialVideoPosition > 0 && youtubePlayerRef.current) {
                    console.log('⏩ Seeking to position:', initialVideoPosition, 'seconds');
                    setTimeout(() => {
                      try {
                        youtubePlayerRef.current?.seekTo(initialVideoPosition, true);
                        console.log('✅ YouTube player seeked to position:', initialVideoPosition);
                      } catch (error) {
                        console.error('❌ Error seeking YouTube player:', error);
                      }
                    }, 500); // המתנה קצרה כדי לוודא שהפלייר מוכן
                  } else {
                    console.log('ℹ️ Not seeking - initialVideoPosition:', initialVideoPosition, 'ref exists:', !!youtubePlayerRef.current);
                  }
                }}
                onProgress={(data: { currentTime: number; duration: number }) => {
                  // מעקב התקדמות - בדומה ל-Vimeo
                  console.log('📊 YouTube onProgress called:', {
                    currentTime: data.currentTime,
                    duration: data.duration,
                    data: JSON.stringify(data)
                  });
                  
                  const currentTime = data.currentTime;
                  const duration = data.duration;
                  
                  if (duration > 0 && currentTime >= 0) {
                    console.log('✅ Updating progress state:', {
                      currentTime,
                      duration,
                      progressPercentage: Math.round((currentTime / duration) * 100)
                    });
                    
                    setProgress(currentTime);
                    setDuration(duration);
                    // עדכון ה-timeline כל הזמן (לצורך תצוגה)
                    const progressPercentage = Math.round((currentTime / duration) * 100);
                    
                    // בדיקה שהפרוגרס תקין ולא קופץ ל-0 (למניעת קפיצות)
                    if (progressPercentage >= 0 && progressPercentage <= 100) {
                      // אם הפרוגרס קופץ ל-0 בעוד שהיה ערך לפני, נשמור את הערך הקודם
                      if (progressPercentage === 0 && lastProgressPercentageRef.current > 0 && currentTime > 1) {
                        // לא נעדכן אם הפרוגרס קופץ ל-0 בעוד שהזמן הנוכחי הוא יותר מ-1 שנייה
                        console.log('⚠️ Skipping progress update - jumped to 0:', { 
                          currentTime, 
                          previousProgress: lastProgressPercentageRef.current 
                        });
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
                      console.log('💾 Saving YouTube progress:', {
                        currentTime: currentTimeInt,
                        duration: Math.floor(duration),
                        percentage: progressPercentage
                      });
                      updateLessonProgress(currentTime, duration);
                    }
                  } else {
                    console.log('⚠️ Duration is 0 or invalid:', { duration, currentTime });
                  }
                }}
                onError={(error: any) => {
                  console.error('YouTube player error:', error);
                  Alert.alert('שגיאה', 'שגיאה בטעינת הסרטון. נסה לפתוח ב-YouTube.');
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
                console.log('WebView loading started');
                setIsLoading(true);
              }}
              onLoadEnd={() => {
                console.log('WebView loading ended');
                setIsLoading(false);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
                Alert.alert('שגיאה', `שגיאה בטעינת הסרטון: ${nativeEvent.description || 'שגיאה לא ידועה'}`);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView HTTP error:', nativeEvent);
              }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  console.log('WebView message:', data);
                  
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
                  console.log('Error parsing message:', error);
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
                      console.log('Opening YouTube URL:', selectedLesson.youtubeUrl);
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
              
              {/* Loading Overlay */}
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <View style={styles.loadingSpinner}>
                    <RefreshCw size={32} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.loadingText}>טוען וידאו...</Text>
                </View>
              )}
            </View>
            </View>
            
          {/* Content Section - פשוט וממוקד */}
          <ScrollView 
            style={styles.contentSection}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {/* Lesson Info - פשוט */}
            <View style={styles.simpleLessonInfo}>
              <Text style={styles.simpleLessonTitle}>{selectedLesson.title}</Text>
              <Text style={styles.simpleLessonDescription}>{selectedLesson.description}</Text>
              
              {/* זמן והתקדמות */}
              <View style={styles.lessonProgressInfo}>
                <View style={styles.progressTimeRow}>
                  <Text style={styles.progressTimeText}>
                    {Math.floor(progress / 60)}:{(progress % 60).toFixed(0).padStart(2, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}
                  </Text>
                  <Text style={styles.progressPercentageText}>{lessonProgress}%</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(Math.max(lessonProgress, 0), 100)}%` }]} />
                </View>
                {selectedLesson.completed && (
                  <View style={styles.completedStatus}>
                    <CheckCircle2 size={16} color={DesignTokens.colors.success.main} strokeWidth={2} />
                    <Text style={styles.completedText}>הושלם</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Navigation Buttons - פשוט */}
            <View style={styles.simpleNavigationButtons}>
                  <TouchableOpacity
                style={[styles.simpleNavButton, { opacity: (() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex >= 0 && currentIndex < lessons.length - 1 ? 1 : 0.5;
                })() }]}
                    onPress={() => {
                      const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                      const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
                    const nextLesson = lessons[currentIndex + 1];
                    handleLessonPress(nextLesson, currentIndex + 1);
                  }
                }}
                disabled={(() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex < 0 || currentIndex >= lessons.length - 1;
                })()}
              >
                <ChevronLeft size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                <Text style={styles.simpleNavButtonText}>שיעור הבא</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.simpleNavButton, { opacity: (() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex > 0 ? 1 : 0.5;
                })() }]}
                onPress={() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  if (currentIndex > 0) {
                    const prevLesson = lessons[currentIndex - 1];
                    handleLessonPress(prevLesson, currentIndex - 1);
                  }
                }}
                disabled={(() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : [];
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex <= 0;
                })()}
              >
                <Text style={styles.simpleNavButtonText}>שיעור קודם</Text>
                <ChevronRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
          </View>
          
            {/* Notes Section - כפתור לפתיחת Bottom Sheet */}
            <TouchableOpacity 
              style={styles.simpleNotesSection}
              onPress={() => setNotesModalVisible(true)}
            >
              <View style={styles.simpleNotesHeader}>
                <Edit3 size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                <Text style={styles.simpleNotesTitle}>הערות אישיות על השיעור</Text>
                <ChevronDown size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  </View>
              <Text style={styles.notesPreview}>
                {userNotes.trim() ? 
                  (userNotes.length > 100 ? userNotes.substring(0, 100) + '...' : userNotes) : 
                  'לחץ לכתיבת הערות...'}
              </Text>
                </TouchableOpacity>
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
          snapPoints={[0.7, 0.9]}
          enablePanDownToClose={!isSaving}
          backdropOpacity={0.5}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.notesSheetContent}
          >
            <View style={styles.notesSheetHeader}>
              <TouchableOpacity
                onPress={() => !isSaving && setNotesModalVisible(false)}
                style={[styles.notesSheetIconButton, isSaving && styles.notesSheetIconButtonDisabled]}
                disabled={isSaving}
              >
                <X size={18} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.notesSheetTitle}>הערות אישיות על השיעור</Text>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedLesson && !isSaving) {
                    try {
                      setIsSaving(true);
                      await saveUserNotes(selectedLesson.id, userNotes);
                      Alert.alert('נשמר!', 'ההערות נשמרו בהצלחה');
                    } catch (error) {
                      console.error('Error saving notes:', error);
                      Alert.alert('שגיאה', 'לא ניתן לשמור את ההערות');
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                style={[styles.notesSheetSaveButton, isSaving && styles.notesSheetSaveButtonDisabled]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RefreshCw size={18} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                ) : (
                  <Text style={styles.notesSheetSaveText}>שמור</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.notesSheetScroll}
              contentContainerStyle={styles.notesSheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.notesSheetInputWrapper}>
                <TextInput
                  ref={textInputRef}
                  style={styles.notesSheetInput}
                  placeholder="כתבו מחשבות, רעיונות ותזכורות מהשיעור..."
                  placeholderTextColor={DesignTokens.colors.text.tertiary}
                  value={userNotes}
                  onChangeText={setUserNotes}
                  multiline
                  autoFocus
                />
              </View>
            </ScrollView>

            <View style={styles.notesSheetFooter}>
              <Text style={styles.notesSheetHint}>
                ההערות נשמרות אוטומטית לחשבון שלך ותמיד זמינות מכל מכשיר
              </Text>
              <TouchableOpacity
                onPress={() => setUserNotes('')}
                disabled={!userNotes.length || isSaving}
                style={[
                  styles.notesSheetClearButton,
                  (!userNotes.length || isSaving) && styles.notesSheetClearButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.notesSheetClearText,
                    (!userNotes.length || isSaving) && styles.notesSheetClearTextDisabled,
                  ]}
                >
                  נקה הכל
                </Text>
              </TouchableOpacity>
            </View>
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
                {['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'].map((color) => (
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
        </SafeAreaView>
      </View>
    );
  }

  // נתוני הקורס להצגה - לא נציג DEMO_COURSE אם עדיין טוען או אם אין courseData
  const displayCourse = courseData;
  const displayCoverUrl = courseData?.cover_url;
  const displayTitle = courseData?.title;
  const displayDescription = courseData?.description;
  const displayInstructorName = courseData?.instructor_name || courseData?.owner?.display_name;
  const displayInstructorAvatar = courseData?.instructor_avatar || courseData?.owner?.avatar_url;

  // אם אין courseData, לא נציג כלום
  if (!courseData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* כותרת הקורס */}
      <View style={styles.courseHeader}>
        <View style={styles.courseImageContainer}>
          {displayCoverUrl ? (
            <Image source={{ uri: displayCoverUrl }} style={styles.courseImage} />
          ) : (
            <View style={[styles.courseImage, { backgroundColor: DesignTokens.colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 48 }}>📚</Text>
            </View>
          )}
        </View>
        
        <View style={styles.courseInfo}>
        <Text style={styles.courseTitle}>{displayTitle}</Text>
        {courseData?.subtitle && (
          <Text style={styles.courseSubtitle}>{courseData.subtitle}</Text>
        )}
        <Text style={styles.courseDescription}>{displayDescription}</Text>
          
          
          {/* מרצה */}
          <View style={styles.instructorContainer}>
            {displayInstructorAvatar ? (
              <Image source={{ uri: displayInstructorAvatar }} style={styles.instructorAvatar} />
            ) : (
              <View style={[styles.instructorAvatar, { backgroundColor: DesignTokens.colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 20, fontWeight: '600' }}>
                  {displayInstructorName.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.instructorInfo}>
              <Text style={styles.instructorName}>{displayInstructorName}</Text>
              <Text style={styles.instructorRole}>
                {courseData?.owner?.bio || 'מנהל הקהילה'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* רשימת השיעורים */}
      <View style={styles.lessonsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>שיעורי הקורס</Text>
          <View style={styles.progressContainer}>
            {(() => {
              const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : [];
              const completedLessons = lessonsToRender.filter(lesson => lesson.completed).length;
              const totalLessons = lessonsToRender.length;
              const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
              
              return (
                <>
                  <Text style={styles.progressText}>{completedLessons}/{totalLessons} הושלמו</Text>
                  <View style={[styles.progressBar, { width: 120, height: 6 }]}>
                    <View style={[styles.progressFill, { 
                      width: `${progressPercentage}%`,
                      backgroundColor: DesignTokens.colors.primary.main,
                      borderRadius: 3
                    }]} />
                  </View>
                </>
              );
            })()}
          </View>
        </View>
        
        {/* פרק 1 - כמה דברים לפני שמתחילים */}
        <View style={styles.chapterSection}>
          <View style={styles.chapterHeader}>
            <Text style={styles.chapterTitle}>פרק 1 - כמה דברים לפני שמתחילים</Text>
          </View>
          <View style={styles.chapterDivider} />
          {(() => {
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : [];
            const chapter1Lessons = lessonsToRender.slice(0, 1); // שיעור ראשון
            return chapter1Lessons.map((lesson, index) => renderLessonCard(lesson, index));
          })()}
        </View>

        {/* פרק 2 - קונספטים ואסטרטגיה */}
        <View style={styles.chapterSection}>
          <View style={styles.chapterHeader}>
            <Text style={styles.chapterTitle}>פרק 2 - קונספטים ואסטרטגיה</Text>
          </View>
          <View style={styles.chapterDivider} />
          {(() => {
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : [];
            const chapter2Lessons = lessonsToRender.slice(1, 8); // שיעורים 2-8
            return chapter2Lessons.map((lesson, index) => renderLessonCard(lesson, index + 1));
          })()}
        </View>

        {/* פרק 3 - כמה דברים לקראת סיום */}
        <View style={styles.chapterSection}>
          <View style={styles.chapterHeader}>
            <Text style={styles.chapterTitle}>פרק 3 - כמה דברים לקראת סיום</Text>
          </View>
          <View style={styles.chapterDivider} />
          {(() => {
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : [];
            const chapter3Lessons = lessonsToRender.slice(8); // שיעור אחרון
            return chapter3Lessons.map((lesson, index) => renderLessonCard(lesson, index + 8));
          })()}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
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
  
  // Lesson Page Styles
  lessonContainer: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  safeAreaContent: {
    flex: 1,
  },
  // New Lesson Header Styles
  newLessonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 50, // Add top padding for status bar
    paddingBottom: 16,
    backgroundColor: tokens.colors.background.secondary,
    borderBottomWidth: 0,
    minHeight: 100,
  },
  newBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  newHeaderContent: {
    flex: 1,
    alignItems: 'flex-end',
    marginTop: 8, // Add margin from top instead of center
  },
  newLessonNumber: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.primary.main,
    marginBottom: 2,
  },
  newLessonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    lineHeight: 24,
    textAlign: 'right',
  },
  lessonCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  lessonDuration: {
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.border.primary,
  },
  lessonMainContent: {
    flex: 1,
  },
  videoSection: {
    backgroundColor: tokens.colors.background.primary,
  },
  videoContainer: {
    aspectRatio: 16/9,
    backgroundColor: tokens.colors.background.primary,
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
    padding: 20,
    paddingBottom: 40,
  },
  
  // Lesson Info Card
  lessonInfoCard: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 28,
  },
  lessonInfoDescription: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: 24,
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
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Progress Cards
  progressCards: {
    gap: 16,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  progressCardPercentage: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 14,
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
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionButtonText: {
    color: tokens.colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionButtonText: {
    color: tokens.colors.primary.main,
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: tokens.colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  
  // Notes Card
  notesCard: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notesCardTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    padding: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.background.tertiary,
  },
  notesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 100,
  },
  notesTextInput: {
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: 24,
    textAlign: 'right',
  },
  notesHint: {
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  
  // Simple Lesson Page Styles
  simpleLessonInfo: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  simpleLessonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 28,
  },
  simpleLessonDescription: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: 24,
  },
  simpleNavigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  simpleNavButton: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simpleNavButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  simpleNotesSection: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
  },
  simpleNotesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  simpleNotesTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  simpleNotesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
  },
  simpleNotesTextInput: {
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: 24,
    textAlign: 'right',
  },
  notesPreview: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    fontStyle: 'italic',
  },

  // Notes bottom sheet
  notesSheetContent: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
  },
  notesSheetHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },
  notesSheetIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSheetIconButtonDisabled: {
    opacity: 0.5,
  },
  notesSheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
  },
  notesSheetSaveButton: {
    minWidth: 88,
    height: 40,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSheetSaveButtonDisabled: {
    opacity: 0.5,
  },
  notesSheetSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  notesSheetScroll: {
    flex: 1,
    marginBottom: tokens.spacing.lg,
  },
  notesSheetScrollContent: {
    paddingBottom: tokens.spacing.lg,
  },
  notesSheetInputWrapper: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: tokens.layout?.borderWidth?.thin || 1,
    borderColor: tokens.colors.border.primary,
    padding: tokens.spacing.lg,
    minHeight: 240,
  },
  notesSheetInput: {
    fontSize: 16,
    color: tokens.colors.text.primary,
    lineHeight: 24,
    textAlign: 'right',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  notesSheetFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  notesSheetHint: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  notesSheetClearButton: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: 20,
    borderWidth: tokens.layout?.borderWidth?.thin || 1,
    borderColor: tokens.colors.border.primary,
  },
  notesSheetClearButtonDisabled: {
    opacity: 0.5,
  },
  notesSheetClearText: {
    fontSize: 14,
    color: tokens.colors.text.primary,
    fontWeight: '500',
  },
  notesSheetClearTextDisabled: {
    color: tokens.colors.text.tertiary,
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
    backgroundColor: tokens.colors.background.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 24,
    textAlignVertical: 'center',
    flex: 1,
    includeFontPadding: false,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
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
    padding: 12,
    borderRadius: 8,
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
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: 24,
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
    borderRadius: 12,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: tokens.colors.primary.main,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 20,
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
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  boldText: {
    fontWeight: 'bold',
  },
  richImageElement: {
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  linkText: {
    color: tokens.colors.primary.main,
    textDecorationLine: 'underline',
  },
  datetimeText: {
    color: tokens.colors.text.secondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  listText: {
    marginLeft: 16,
  },
  placeholderText: {
    fontSize: 16,
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
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    maxHeight: 100,
    marginRight: 8,
  },
  addTextButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 10,
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
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  flowingImage: {
    borderRadius: 8,
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
    fontSize: 16,
    lineHeight: 24,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 8,
    marginTop: 16,
  },
  addNoteText: {
    fontSize: 16,
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
    fontSize: 12,
    color: tokens.colors.primary.main,
    marginLeft: 4,
  },
  
  // Notes-like Styles
  notesLikeContainer: {
    flex: 1,
  },
  notesText: {
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  notesImage: {
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  formatIndicator: {
    marginTop: 4,
  },
  formatText: {
    fontSize: 12,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  
  // Lesson Progress Info
  lessonProgressInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTimeText: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    fontWeight: '500',
  },
  progressPercentageText: {
    fontSize: 14,
    color: tokens.colors.primary.main,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 2,
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 14,
    color: tokens.colors.success.main,
    fontWeight: '500',
  },
  
  // Course Header
  courseHeader: {
    padding: 0,
    backgroundColor: tokens.colors.background.secondary,
  },
  courseImageContainer: {
    position: 'relative',
    marginBottom: 0,
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
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.success.main,
  },
  
  courseInfo: {
    gap: 12,
    padding: 20,
  },
  courseTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    lineHeight: 34,
    textAlign: 'right',
  },
  courseSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: tokens.colors.text.secondary,
    marginBottom: 0,
    textAlign: 'right',
  },
  courseDescription: {
    fontSize: 16,
    color: tokens.colors.text.tertiary,
    lineHeight: 24,
    textAlign: 'right',
  },
  
  // Rating
  ratingContainer: {
    marginTop: 8,
  },
  rating: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  ratingCount: {
    fontSize: 14,
    color: tokens.colors.text.tertiary,
  },
  
  // Instructor
  instructorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  instructorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  instructorRole: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  instructorRating: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  instructorRatingText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  instructorStudents: {
    fontSize: 12,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Meta
  courseMeta: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  metaLabel: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  
  // Lessons Section
  lessonsSection: {
    padding: 20,
    position: 'relative',
  },
  
  // Chapter Sections
  chapterSection: {
    marginBottom: 32,
  },
  chapterHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  chapterDivider: {
    height: 1,
    backgroundColor: tokens.colors.primary.main,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  progressContainer: {
    alignItems: 'flex-start',
  },
  progressText: {
    fontSize: 14,
    textAlign: 'right',
    color: tokens.colors.text.secondary,
    marginBottom: 4,
  },
  progressBar: {
    width: 120,
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  
  // Lesson Cards
  lessonCard: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.lg,
    marginBottom: 16,
    overflow: 'hidden',
  },
  lessonTouchable: {
    flex: 1,
  },
  lessonThumbnail: {
    position: 'relative',
    height: 120,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  thumbnailGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  
  lessonContent: {
    flex: 1,
    padding: 16,
  },
  lessonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lessonNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: {
    color: tokens.colors.background.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonDescription: {
    fontSize: 16,
    color: tokens.colors.text.tertiary,
    lineHeight: 24,
    textAlign: 'right',
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
    fontSize: 16,
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  videoErrorSubtext: {
    color: tokens.colors.text.tertiary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  youtubeButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  youtubeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LearningScreen;

