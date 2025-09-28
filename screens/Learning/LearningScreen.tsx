import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Dimensions, Alert, Platform, TextInput, SafeAreaView, KeyboardAvoidingView, PanResponder, TouchableWithoutFeedback, Keyboard, Modal, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { XCircle, CheckCircle2, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Edit3, ChevronUp, Save, X, Type, ImageIcon, Palette, PlusCircle, Star, Clock, TrendingUp, Video as VideoIcon } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { learningProgressService } from '../../services/learningProgressService';
import { courseService } from '../../services/courseService';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lessonProgress, setLessonProgress] = useState(0); // התקדמות השיעור הנוכחי
  const [totalProgress, setTotalProgress] = useState(0); // התקדמות כללית של הקורס
  const [userNotes, setUserNotes] = useState(''); // הערות המשתמש
  const [showNotesBottomSheet, setShowNotesBottomSheet] = useState(false);
  const [bottomSheetTranslateY] = useState(new Animated.Value(0));
  const textInputRef = useRef<TextInput>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [richTextContent, setRichTextContent] = useState<any[]>([]);
  const [currentFormatting, setCurrentFormatting] = useState({
    bold: false,
    color: '#FFFFFF',
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
  const [animatedValues] = useState(() => 
    DEMO_COURSE.lessons.map(() => new Animated.Value(1))
  );

  // PanResponder לגרירת Bottom Sheet
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      return true;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderGrant: () => {
      bottomSheetTranslateY.setOffset(0);
      bottomSheetTranslateY.setValue(0);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy > 0) {
        bottomSheetTranslateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      bottomSheetTranslateY.flattenOffset();
      if (gestureState.dy > 150) {
        // סגירה אם גררו יותר מ-150px
        Animated.timing(bottomSheetTranslateY, {
          toValue: 1000,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowNotesBottomSheet(false);
          bottomSheetTranslateY.setValue(0);
        });
      } else {
        // חזרה למקום
        Animated.spring(bottomSheetTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // טעינת נתונים מהמסד
  useEffect(() => {
    console.log('useEffect triggered, user:', user?.id);
    loadCourseData();
  }, [user]);

  // טעינת נתוני הקורס
  const loadCourseData = async () => {
    console.log('loadCourseData called');
    try {
      // נטען את הקורס מהמסד (או ניצור אותו אם לא קיים)
      const courseId = 'whales-course-1';
      console.log('Getting course by ID:', courseId);
      let course = await courseService.getCourseById(courseId);
      console.log('Course from database:', course);
      
      if (!course) {
        // אם הקורס לא קיים, ניצור אותו
        await courseService.createWhalesCourse();
        course = await courseService.getCourseById(courseId);
        
        // ניצור גם את קישורי המדיה
        if (course) {
          await mediaService.createWhalesCourseMedia(courseId);
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
              
              // חישוב משך הזמן - נשתמש בנתונים האמיתיים מ-DEMO_COURSE
              let duration = '00:00';
              
              // נחפש את השיעור בנתונים האמיתיים
              const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
              console.log(`Lesson ${lesson.id} demo lesson:`, demoLesson);
              if (demoLesson?.duration) {
                duration = demoLesson.duration;
                console.log(`Lesson ${lesson.id} using demo duration:`, duration);
              } else if (media?.duration_minutes) {
                const minutes = media.duration_minutes;
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                duration = hours > 0 ? `${hours}:${remainingMinutes.toString().padStart(2, '0')}` : `${remainingMinutes.toString().padStart(2, '0')}:00`;
              } else if (lesson.duration_minutes) {
                const minutes = lesson.duration_minutes;
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                duration = hours > 0 ? `${hours}:${remainingMinutes.toString().padStart(2, '0')}` : `${remainingMinutes.toString().padStart(2, '0')}:00`;
              }
              
              // נשתמשאמבנייל מ-Vimeo במקום placeholder
              const thumbnailUrl = media?.vimeo_id ? `https://vumbnail.com/${media.vimeo_id}.jpg` : `https://vumbnail.com/${lesson.id}.jpg`;
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
                vimeoId: media?.vimeo_id || lesson.id,
                thumbnail: thumbnailUrl,
                videoUrl: media?.vimeo_url || `https://vimeo.com/${media?.vimeo_id || lesson.id}?share=copy`,
                duration: duration,
                type: 'video'
              };
            })
          );
          console.log('Updated lessons with media:', updatedLessons);
          console.log('Setting lessons data...');
          setLessonsData(updatedLessons);
          console.log('Lessons data set successfully');
          console.log('First lesson thumbnail:', updatedLessons[0]?.thumbnail);
          console.log('First lesson duration:', updatedLessons[0]?.duration);
          console.log('All lessons durations:', updatedLessons.map(l => ({ id: l.id, title: l.title, duration: l.duration })));
        } else {
          // אם אין שיעורים במסד, נשתמש בנתונים הבסיסיים
          console.log('No lessons found in database, using demo data');
          setLessonsData(DEMO_COURSE.lessons);
        }
        
        // נטען את ההתקדמות הכללית
        if (user) {
          const totalProgress = await learningProgressService.calculateUserCourseProgress(user.id, courseId);
          setTotalProgress(totalProgress);
        }
      } else {
        // אם אין קורס במסד, נשתמש בנתונים הבסיסיים
        setCourseData(DEMO_COURSE);
        setLessonsData(DEMO_COURSE.lessons);
        setTotalProgress(0);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      // אם יש שגיאה, נשתמש בנתונים הבסיסיים
      setCourseData(DEMO_COURSE);
      setLessonsData(DEMO_COURSE.lessons);
      setTotalProgress(0);
    }
  };

  // טעינת הערות משתמש
  const loadUserNotes = async (lessonId: string) => {
    if (!user || !courseData) return;
    
    try {
      const notes = await learningProgressService.getUserNotes(user.id, courseData.id, lessonId);
      if (notes) {
        setUserNotes(notes.notes_content || '');
      }
    } catch (error) {
      console.error('Error loading user notes:', error);
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
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const currentText = userNotes;
        const newText = currentText + `\n![תמונה](${imageUri})\n`;
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

  // טעינת הערות כשנפתח השיעור
  useEffect(() => {
    if (selectedLesson) {
      loadExistingNotes(selectedLesson.id);
    }
  }, [selectedLesson]);

  // טעינת הערות כשנפתח הדיאלוג
  useEffect(() => {
    if (showNotesBottomSheet && selectedLesson) {
      loadExistingNotes(selectedLesson.id);
    }
  }, [showNotesBottomSheet, selectedLesson]);

  // עדכון אוטומטי של התוכן (פחות אגרסיבי)
  useEffect(() => {
    if (richTextContent.length > 0) {
      const currentContent = JSON.stringify(richTextContent);
      if (currentContent !== lastSavedContent) {
        // עדכון אוטומטי כל 5 שניות (פחות אגרסיבי)
        const timer = setTimeout(async () => {
          if (selectedLesson) {
            setIsSaving(true);
            try {
              await saveUserNotes(selectedLesson.id, currentContent);
              setLastSavedContent(currentContent);
            } catch (error) {
              console.error('Error auto-saving:', error);
            } finally {
              setIsSaving(false);
            }
          }
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [richTextContent, selectedLesson, lastSavedContent]);

  const renderRichTextElement = (element: any, index: number) => {
    const renderContent = () => {
      switch (element.type) {
        case 'text':
          return (
            <Text
              style={[
                styles.flowingText,
                element.bold && styles.boldText,
                { color: element.color || '#000000' }
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
                    { color: element.color || '#FFFFFF' }
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
    Animated.sequence([
      Animated.timing(animatedValues[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setSelectedLesson(lesson);
    
    // נטען את ההתקדמות הקיימת של המשתמש
    if (user && courseData) {
      const userProgress = await learningProgressService.getUserProgress(user.id, courseData.id, lesson.id);
      if (userProgress) {
        setLessonProgress(userProgress.progress_percentage);
        setProgress(userProgress.current_time_seconds);
        setDuration(userProgress.total_duration_seconds);
      } else {
        setLessonProgress(0);
        setProgress(0);
        setDuration(0);
      }
      
      // נטען את ההערות של המשתמש עבור השיעור הספציפי
      try {
        const notes = await learningProgressService.getUserNotes(user.id, courseData.id, lesson.id);
        setUserNotes(notes?.notes_content || '');
        console.log('Loaded notes for lesson', lesson.id, ':', notes);
      } catch (error) {
        console.error('Error loading user notes:', error);
        setUserNotes('');
      }
    }

    // נטען את קישורי המדיה אם לא קיימים
    if (courseData && (!lesson.vimeoId || !lesson.thumbnail)) {
      console.log(`Loading media for lesson ${lesson.id}`);
      const media = await loadLessonMedia(lesson.id);
      console.log(`Media for lesson ${lesson.id}:`, media);
      if (media) {
        // חישוב משך הזמן - נשתמש בנתונים האמיתיים מ-DEMO_COURSE
        let duration = lesson.duration || '00:00';
        
        // נחפש את השיעור בנתונים האמיתיים
        const demoLesson = DEMO_COURSE.lessons.find(demo => demo.id === lesson.id);
        console.log(`Lesson ${lesson.id} demo lesson in handleLessonPress:`, demoLesson);
        if (demoLesson?.duration) {
          duration = demoLesson.duration;
          console.log(`Lesson ${lesson.id} using demo duration in handleLessonPress:`, duration);
        } else if (media.duration_minutes) {
          const minutes = media.duration_minutes;
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          duration = hours > 0 ? `${hours}:${remainingMinutes.toString().padStart(2, '0')}` : `${remainingMinutes.toString().padStart(2, '0')}:00`;
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
    const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
    const completedLessons = lessons.filter((lesson: any) => lesson.completed).length;
    const totalLessons = lessons.length;
    return Math.round((completedLessons / totalLessons) * 100);
  };

  // עדכון התקדמות השיעור הנוכחי
  const updateLessonProgress = async (currentTime: number, totalTime: number) => {
    if (totalTime > 0) {
      const progress = (currentTime / totalTime) * 100;
      setLessonProgress(Math.round(progress));
      
      // שמירה במסד נתונים
      if (user && courseData && selectedLesson) {
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

  const handleVideoEnd = () => {
    setIsPlaying(false);
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
    return (
    <Animated.View
      key={lesson.id}
      style={[
        styles.lessonCard,
        { transform: [{ scale: animatedValues[index] }] }
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
              onError={(error) => {
              // אם התמונה לא נטענת, נשתמש בצבע רקע
                console.log('Thumbnail failed to load for lesson:', lesson.title, 'URL:', lesson.thumbnail, 'Error:', error);
              }}
              onLoad={() => {
                console.log('Thumbnail loaded successfully for lesson:', lesson.title, 'URL:', lesson.thumbnail);
            }}
          />
          ) : (
            <View style={[styles.thumbnailImage, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: 'white', fontSize: 24 }}>🎥</Text>
            </View>
          )}
          <View style={styles.thumbnailGradient} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{lesson.duration || '00:00'}</Text>
          </View>
          {lesson.completed && (
            <View style={styles.completedBadge}>
              <CheckCircle2 size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
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

  if (selectedLesson) {
    return (
      <View style={styles.lessonContainer}>
        {/* Header - extends to top of screen */}
        <View style={styles.newLessonHeader}>
          <View style={styles.newHeaderContent}>
            <Text style={styles.newLessonNumber}>
              שיעור {(() => {
                const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                return currentIndex + 1;
              })()}
            </Text>
            <Text style={styles.newLessonTitle} numberOfLines={2}>
              {selectedLesson.title}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.newBackButton}
            onPress={() => setSelectedLesson(null)}
          >
            <ArrowRight size={20} color="white" strokeWidth={2} />
          </TouchableOpacity>
        </View>
        
        {/* Safe Area for content */}
        <SafeAreaView style={styles.safeAreaContent}>
          {/* Background Gradient - only between header and content */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contentGradient}
          />
          
          {/* Main Content */}
          <View style={styles.lessonMainContent}>
          {/* Video Section */}
          <View style={styles.videoSection}>
            <View style={styles.videoContainer}>
            <WebView
              source={{ 
                html: `
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
                          src="https://player.vimeo.com/video/${selectedLesson.vimeoId}?badge=0&autopause=0&player_id=0&app_id=58479" 
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
                `
              }}
              style={styles.videoPlayer}
              allowsFullscreenVideo={true}
              mediaPlaybackRequiresUserAction={false}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
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
                  console.log('Error parsing message:', error);
                }
              }}
            />
              
              {/* Loading Overlay */}
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <View style={styles.loadingSpinner}>
                    <RefreshCw size={32} color="white" strokeWidth={2} />
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
                  <View style={[styles.progressBarFill, { width: `${lessonProgress}%` }]} />
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
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex < lessons.length - 1 ? 1 : 0.5;
                })() }]}
                    onPress={() => {
                      const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                      const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  if (currentIndex < lessons.length - 1) {
                    const nextLesson = lessons[currentIndex + 1];
                    handleLessonPress(nextLesson, currentIndex + 1);
                  }
                }}
                disabled={(() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex >= lessons.length - 1;
                })()}
              >
                <ChevronLeft size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                <Text style={styles.simpleNavButtonText}>שיעור הבא</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.simpleNavButton, { opacity: (() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  return currentIndex > 0 ? 1 : 0.5;
                })() }]}
                onPress={() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
                  const currentIndex = lessons.findIndex((l: any) => l.id === selectedLesson.id);
                  if (currentIndex > 0) {
                    const prevLesson = lessons[currentIndex - 1];
                    handleLessonPress(prevLesson, currentIndex - 1);
                  }
                }}
                disabled={(() => {
                  const lessons = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
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
              onPress={() => setShowNotesBottomSheet(true)}
            >
              <View style={styles.simpleNotesHeader}>
                <Edit3 size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                <Text style={styles.simpleNotesTitle}>הערות שלי</Text>
                <ChevronUp size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  </View>
              <Text style={styles.notesPreview}>
                {(() => {
                  if (richTextContent.length === 0) {
                    return 'לחץ לכתיבת הערות...';
                  }
                  
                  const textContent = richTextContent
                    .filter(element => element.type === 'text')
                    .map(element => element.content)
                    .join(' ');
                  
                  return textContent.length > 100 ? 
                    textContent.substring(0, 100) + '...' : 
                    textContent;
                })()}
              </Text>
                </TouchableOpacity>
          </ScrollView>
              </View>
              
        {/* Notes Bottom Sheet */}
        {showNotesBottomSheet && (
          <TouchableOpacity 
            style={styles.bottomSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowNotesBottomSheet(false)}
          >
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'position' : 'height'}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? -50 : 0}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <Animated.View 
                  style={[styles.bottomSheet, { transform: [{ translateY: bottomSheetTranslateY }] }]}
                  {...panResponder.panHandlers}
                >
              <View style={styles.bottomSheetHeader}>
                <View style={styles.dragHandle} />
                <View style={styles.headerContent}>
                  <Text style={styles.bottomSheetTitle}>הערות שלי</Text>
                  {isSaving && (
                    <View style={styles.savingIndicator}>
                      <Save size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                      <Text style={styles.savingText}>שומר...</Text>
                </View>
                  )}
                  {isLoadingNotes && (
                    <View style={styles.savingIndicator}>
                      <RefreshCw size={16} color={DesignTokens.colors.text.secondary} strokeWidth={2} />
                      <Text style={styles.savingText}>טוען הערות...</Text>
                    </View>
                  )}
                  {!isLoadingNotes && !isSaving && (
                    <View style={styles.formatIndicator}>
                      <Text style={styles.formatText}>
                        {currentFormatting.bold ? 'מודגש' : 'רגיל'} • 
                        <Text style={{ color: currentFormatting.color }}> צבע</Text>
                      </Text>
                    </View>
                  )}
              </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowNotesBottomSheet(false)}
                >
                  <X size={24} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              
              {/* Toolbar */}
              <View style={styles.toolbar}>
                    <TouchableOpacity 
                  style={[styles.toolbarButton, currentFormatting.bold && styles.activeToolbarButton]}
                  onPress={toggleBold}
                >
                  <Type size={20} color={currentFormatting.bold ? DesignTokens.colors.primary.main : DesignTokens.colors.text.primary} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                  style={styles.toolbarButton}
                  onPress={addImageElement}
                >
                  <ImageIcon size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.toolbarButton}
                  onPress={addColoredTextElement}
                >
                  <Palette size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
              
              {/* Direct Text Editor */}
              <ScrollView 
                style={styles.flowingTextContainer}
                contentContainerStyle={styles.flowingTextContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity 
                  style={styles.editableTextArea}
                  onPress={startEditing}
                  activeOpacity={0.7}
                >
                  {/* תצוגת התוכן הקיים */}
                  <View style={styles.textAreaContent}>
                    {renderFlowingText()}
                    {richTextContent.length === 0 && !isEditing && (
                      <Text style={styles.placeholderText}>כתוב הערות כאן...</Text>
                    )}
                  </View>
                  
                  {/* אזור עריכה חדש */}
                  {isEditing && (
                    <View style={styles.newTextInputContainer}>
                      <TextInput
                        ref={textInputRef}
                        style={[
                          styles.inlineTextInput,
                          currentFormatting.bold && styles.boldText,
                          { color: currentFormatting.color }
                        ]}
                        placeholder="הוסף הערה חדשה..."
                        placeholderTextColor={DesignTokens.colors.text.tertiary}
                        value={editingText}
                        onChangeText={setEditingText}
                        multiline
                        textAlign="right"
                        textAlignVertical="top"
                        autoFocus
                        onSubmitEditing={finishEditing}
                        onBlur={finishEditing}
                      />
                    </View>
                  )}
                  
                  {/* כפתור הוספת הערה */}
                  {!isEditing && (
                    <View style={styles.addNoteButton}>
                      <PlusCircle size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                      <Text style={styles.addNoteText}>הוסף הערה</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
              
              
              {/* Action Buttons */}
              <View style={styles.bottomSheetActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowNotesBottomSheet(false)}
                >
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={async () => {
                    if (selectedLesson) {
                      try {
                        setIsSaving(true);
                        const content = JSON.stringify(richTextContent);
                        await saveUserNotes(selectedLesson.id, content);
                        setLastSavedContent(content);
                        Alert.alert('נשמר!', 'ההערות נשמרו בהצלחה');
                        // רענון התצוגה
                        await loadExistingNotes(selectedLesson.id);
                      } catch (error) {
                        console.error('Error saving notes:', error);
                        Alert.alert('שגיאה', 'לא ניתן לשמור את ההערות');
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                >
                  <Text style={styles.saveButtonText}>שמור</Text>
                </TouchableOpacity>
              </View>
              </Animated.View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        )}

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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* כותרת הקורס */}
      <View style={styles.courseHeader}>
        <View style={styles.courseImageContainer}>
          <Image source={{ uri: DEMO_COURSE.cover_url }} style={styles.courseImage} />
        </View>
        
        <View style={styles.courseInfo}>
        <Text style={styles.courseTitle}>{DEMO_COURSE.title}</Text>
        <Text style={styles.courseDescription}>{DEMO_COURSE.description}</Text>
          
          {/* דירוג ומידע */}
          <View style={styles.ratingContainer}>
            <View style={styles.rating}>
              <Star size={16} color="#F59E0B" strokeWidth={2} />
              <Text style={styles.ratingText}>{DEMO_COURSE.rating}</Text>
              <Text style={styles.ratingCount}>({DEMO_COURSE.students} תלמידים)</Text>
            </View>
          </View>
          
          {/* מרצה */}
          <View style={styles.instructorContainer}>
            <Image source={{ uri: DEMO_COURSE.instructor.avatar }} style={styles.instructorAvatar} />
            <View style={styles.instructorInfo}>
              <Text style={styles.instructorName}>{DEMO_COURSE.instructor.name}</Text>
              <View style={styles.instructorRating}>
                <Star size={14} color="#F59E0B" strokeWidth={2} />
                <Text style={styles.instructorRatingText}>{DEMO_COURSE.instructor.rating}</Text>
                <Text style={styles.instructorStudents}>({DEMO_COURSE.instructor.students} תלמידים)</Text>
              </View>
            </View>
          </View>
          
          {/* מטא דאטה */}
          <View style={styles.courseMeta}>
            <View style={styles.metaItem}>
              <Clock size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaValue}>{DEMO_COURSE.duration}</Text>
            </View>
            <View style={styles.metaItem}>
              <TrendingUp size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaValue}>{DEMO_COURSE.level}</Text>
            </View>
              <View style={styles.metaItem}>
                <VideoIcon size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                <Text style={styles.metaValue}>{(lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons).length} שיעורים</Text>
              </View>
          </View>
        </View>
      </View>

      {/* רשימת השיעורים */}
      <View style={styles.lessonsSection}>
        {/* Background Gradient - only for lessons section */}
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.04)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lessonsGradient}
        />
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>שיעורי הקורס</Text>
          <View style={styles.progressContainer}>
            {(() => {
              const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
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
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
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
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
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
            const lessonsToRender = lessonsData && lessonsData.length > 0 ? lessonsData : DEMO_COURSE.lessons;
            const chapter3Lessons = lessonsToRender.slice(8); // שיעור אחרון
            return chapter3Lessons.map((lesson, index) => renderLessonCard(lesson, index + 8));
          })()}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background.primary,
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
    backgroundColor: DesignTokens.colors.background.primary,
  },
  safeAreaContent: {
    flex: 1,
  },
  contentGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  // New Lesson Header Styles
  newLessonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 50, // Add top padding for status bar
    paddingBottom: 16,
    backgroundColor: DesignTokens.colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.colors.border.primary,
    minHeight: 100,
  },
  newBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: DesignTokens.colors.primary.main,
    marginBottom: 2,
  },
  newLessonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignTokens.colors.text.primary,
    lineHeight: 24,
    textAlign: 'right',
  },
  lessonCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  lessonDuration: {
    fontSize: 14,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'right',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  lessonMainContent: {
    flex: 1,
  },
  videoSection: {
    backgroundColor: '#000',
  },
  videoContainer: {
    aspectRatio: 16/9,
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
    padding: 20,
    paddingBottom: 40,
  },
  
  // Lesson Info Card
  lessonInfoCard: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...DesignTokens.shadows.md,
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 28,
  },
  lessonInfoDescription: {
    fontSize: 16,
    color: DesignTokens.colors.text.secondary,
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
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Progress Cards
  progressCards: {
    gap: 16,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    ...DesignTokens.shadows.sm,
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  progressCardPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.colors.primary.main,
    textAlign: 'right',
  },
  progressCardBar: {
    height: 8,
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressCardFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.primary.main,
    borderRadius: 4,
  },
  progressCardTime: {
    fontSize: 14,
    color: DesignTokens.colors.text.tertiary,
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
    backgroundColor: DesignTokens.colors.primary.main,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...DesignTokens.shadows.sm,
  },
  primaryActionButtonText: {
    color: 'white',
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
    borderWidth: 2,
    borderColor: DesignTokens.colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionButtonText: {
    color: DesignTokens.colors.primary.main,
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
    backgroundColor: DesignTokens.colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...DesignTokens.shadows.sm,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignTokens.colors.text.primary,
    textAlign: 'center',
  },
  
  // Notes Card
  notesCard: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    ...DesignTokens.shadows.sm,
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
    color: DesignTokens.colors.text.primary,
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
    backgroundColor: DesignTokens.colors.background.tertiary,
  },
  notesInput: {
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 100,
  },
  notesTextInput: {
    fontSize: 16,
    color: DesignTokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: 24,
    textAlign: 'right',
  },
  notesHint: {
    fontSize: 14,
    color: DesignTokens.colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  
  // Simple Lesson Page Styles
  simpleLessonInfo: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...DesignTokens.shadows.sm,
  },
  simpleLessonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 28,
  },
  simpleLessonDescription: {
    fontSize: 16,
    color: DesignTokens.colors.text.secondary,
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
    backgroundColor: DesignTokens.colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...DesignTokens.shadows.sm,
  },
  simpleNavButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignTokens.colors.text.primary,
    textAlign: 'center',
  },
  simpleNotesSection: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...DesignTokens.shadows.sm,
  },
  simpleNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  simpleNotesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
  },
  simpleNotesInput: {
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
  },
  simpleNotesTextInput: {
    fontSize: 16,
    color: DesignTokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: 24,
    textAlign: 'right',
  },
  notesPreview: {
    fontSize: 14,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: DesignTokens.colors.background.secondary,
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
    borderBottomColor: DesignTokens.colors.border.primary,
    minHeight: 60,
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: DesignTokens.colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 24,
    textAlignVertical: 'center',
    flex: 1,
    includeFontPadding: false,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.colors.border.primary,
    gap: 12,
    minHeight: 60,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolbarButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: DesignTokens.colors.text.primary,
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
    backgroundColor: DesignTokens.colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignTokens.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: DesignTokens.colors.primary.main,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: DesignTokens.colors.text.primary,
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
    backgroundColor: DesignTokens.colors.background.tertiary,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: DesignTokens.colors.primary.main,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignTokens.colors.text.secondary,
  },
  modalButtonTextPrimary: {
    color: 'white',
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: DesignTokens.colors.primary.main,
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
    color: DesignTokens.colors.text.primary,
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
    color: DesignTokens.colors.primary.main,
    textDecorationLine: 'underline',
  },
  datetimeText: {
    color: DesignTokens.colors.text.secondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  listText: {
    marginLeft: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
  },
  activeToolbarButton: {
    backgroundColor: DesignTokens.colors.primary.main + '20',
  },
  
  // Text Input Styles
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: DesignTokens.colors.border.primary,
    backgroundColor: DesignTokens.colors.background.tertiary,
  },
  textInput: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    maxHeight: 100,
    marginRight: 8,
  },
  addTextButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignTokens.colors.primary.main,
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
    backgroundColor: DesignTokens.colors.background.secondary,
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
    color: DesignTokens.colors.text.primary,
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  newTextInputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DesignTokens.colors.border.primary,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: DesignTokens.colors.border.primary,
  },
  addNoteText: {
    fontSize: 16,
    color: DesignTokens.colors.primary.main,
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
    color: DesignTokens.colors.primary.main,
    marginLeft: 4,
  },
  
  // Notes-like Styles
  notesLikeContainer: {
    flex: 1,
  },
  notesText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
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
    color: DesignTokens.colors.text.secondary,
    textAlign: 'center',
  },
  
  // Lesson Progress Info
  lessonProgressInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DesignTokens.colors.border.primary,
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTimeText: {
    fontSize: 14,
    color: DesignTokens.colors.text.secondary,
    fontWeight: '500',
  },
  progressPercentageText: {
    fontSize: 14,
    color: DesignTokens.colors.primary.main,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.primary.main,
    borderRadius: 2,
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 14,
    color: DesignTokens.colors.success.main,
    fontWeight: '500',
  },
  
  // Course Header
  courseHeader: {
    padding: 0,
    backgroundColor: DesignTokens.colors.background.secondary,
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
    backgroundColor: 'rgba(0, 216, 74, 0.3)',
  },
  priceContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DesignTokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: DesignTokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.colors.success.main,
  },
  
  courseInfo: {
    gap: 12,
    padding: 20,
  },
  courseTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DesignTokens.colors.text.primary,
    lineHeight: 34,
    textAlign: 'right',
  },
  courseSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: DesignTokens.colors.text.secondary,
    marginBottom: 0,
    textAlign: 'right',
  },
  courseDescription: {
    fontSize: 16,
    color: DesignTokens.colors.text.tertiary,
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
    color: DesignTokens.colors.text.primary,
  },
  ratingCount: {
    fontSize: 14,
    color: DesignTokens.colors.text.tertiary,
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
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
    color: DesignTokens.colors.text.secondary,
    textAlign: 'right',
  },
  instructorStudents: {
    fontSize: 12,
    color: DesignTokens.colors.text.tertiary,
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
  },
  
  // Lessons Section
  lessonsSection: {
    padding: 20,
    position: 'relative',
  },
  lessonsGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
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
    color: '#00D84A',
    textAlign: 'right',
  },
  chapterDivider: {
    height: 1,
    backgroundColor: '#00D84A',
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
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
  },
  progressContainer: {
    alignItems: 'flex-start',
  },
  progressText: {
    fontSize: 14,
    textAlign: 'right',
    color: DesignTokens.colors.text.secondary,
    marginBottom: 4,
  },
  progressBar: {
    width: 120,
    height: 6,
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.primary.main,
    borderRadius: 3,
  },
  
  // Lesson Cards
  lessonCard: {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderRadius: DesignTokens.borderRadius.lg,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...DesignTokens.shadows.md,
  },
  lessonTouchable: {
    flex: 1,
  },
  lessonThumbnail: {
    position: 'relative',
    height: 120,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a', // צבע רקע אם התמונה לא נטענת
  },
  thumbnailGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DesignTokens.borderRadius.sm,
  },
  durationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    backgroundColor: '#00D84A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonDescription: {
    fontSize: 16,
    color: '#6c757d',
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
    backgroundColor: DesignTokens.colors.success.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: DesignTokens.colors.text.tertiary,
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    marginBottom: 12,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LearningScreen;
