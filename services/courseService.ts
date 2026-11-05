import i18n from '../lib/i18n';
import { supabase } from './supabase';

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  cover_url?: string;
  instructor_name: string;
  instructor_avatar?: string;
  duration_hours: number;
  level: string;
  rating: number;
  students_count: number;
  price: number;
  original_price?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  order_index: number;
  is_completed: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

class CourseService {
  // קבלת כל הקורסים
  async getAllCourses(): Promise<Course[]> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // קבלת קורס ספציפי
  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .eq('is_active', true)
        .single();

      if (error) {
        // אם אין נתונים, מחזירים null במקום להדפיס שגיאה
        if (error.code === 'PGRST116') {
          return null;
        }
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // קבלת שיעורים של קורס
  async getCourseLessons(courseId: string): Promise<Lesson[]> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // יצירת קורס חדש
  async createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Course | null> {
    try {
      const courseData = { ...course };
      // אם יש id, נשתמש בו, אחרת נשאיר ל-Supabase ליצור
      const insertData = courseData.id 
        ? courseData 
        : Object.fromEntries(Object.entries(courseData).filter(([key]) => key !== 'id'));
      
      const { data, error } = await supabase
        .from('courses')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // יצירת שיעור חדש
  async createLesson(lesson: Omit<Lesson, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Lesson | null> {
    try {
      const lessonData = { ...lesson };
      const insertData = lessonData.id
        ? lessonData
        : Object.fromEntries(Object.entries(lessonData).filter(([key]) => key !== 'id'));
      const { data, error } = await supabase
        .from('lessons')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // עדכון קורס
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // עדכון שיעור
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<Lesson | null> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', lessonId)
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // מחיקת קורס (soft delete)
  async deleteCourse(courseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: false })
        .eq('id', courseId);

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // מחיקת שיעור (soft delete)
  async deleteLesson(lessonId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lessons')
        .update({ is_active: false })
        .eq('id', lessonId);

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // יצירת קורס האורקל (מסחר סווינג באופציות) — ללא שיעורים בשלב ראשון
  async createOracleCourse(): Promise<boolean> {
    try {
      const existing = await this.getCourseById('oracle-course');
      if (existing) return true;

      const coverUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/oracle-course-banner.jpg`;
      const instructorAvatar = `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`;

      const { error } = await supabase.from('courses').insert({
        id: 'oracle-course',
        title: i18n.t('auto.services__courseService.s1'),
        subtitle: i18n.t('auto.services__courseService.s2'),
        description:
          i18n.t('auto.services__courseService.s3'),
        cover_url: coverUrl,
        instructor_name: i18n.t('auto.services__courseService.s4'),
        instructor_avatar: instructorAvatar,
        price: 299,
        original_price: 599,
        is_active: true,
        access: 'free',
      });

      return !error;
    } catch {
      return false;
    }
  }

  // יצירת קורס הלוויתנים עם כל השיעורים
  async createWhalesCourse(): Promise<boolean> {
    try {
      // יצירת הקורס
      const course = await this.createCourse({
        title: i18n.t('auto.services__courseService.s5'),
        subtitle: i18n.t('auto.services__courseService.s6'),
        description:
          i18n.t('auto.services__courseService.s7'),
        cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/whales-course-cover-2026-10.jpg`,
        instructor_name: i18n.t('auto.services__courseService.s4'),
        instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        duration_hours: 8,
        level: i18n.t('auto.services__courseService.s8'),
        rating: 4.8,
        students_count: 1250,
        price: 299,
        original_price: 599,
        is_active: true,
      });

      if (!course) {
        return false;
      }

      // יצירת השיעורים
      const lessons = [
        {
          id: 'lesson-1',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s9'),
          description: i18n.t('auto.services__courseService.s10'),
          duration_minutes: 45,
          order_index: 1,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-2',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s11'),
          description: i18n.t('auto.services__courseService.s12'),
          duration_minutes: 60,
          order_index: 2,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-3',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s13'),
          description: i18n.t('auto.services__courseService.s14'),
          duration_minutes: 40,
          order_index: 3,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-4',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s15'),
          description: i18n.t('auto.services__courseService.s16'),
          duration_minutes: 35,
          order_index: 4,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-5',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s17'),
          description: i18n.t('auto.services__courseService.s18'),
          duration_minutes: 30,
          order_index: 5,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-6',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s19'),
          description: i18n.t('auto.services__courseService.s20'),
          duration_minutes: 50,
          order_index: 6,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-7',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s21'),
          description: i18n.t('auto.services__courseService.s22'),
          duration_minutes: 55,
          order_index: 7,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-8',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s23'),
          description: i18n.t('auto.services__courseService.s24'),
          duration_minutes: 90,
          order_index: 8,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-9',
          course_id: course.id,
          title: i18n.t('auto.services__courseService.s25'),
          description: i18n.t('auto.services__courseService.s26'),
          duration_minutes: 25,
          order_index: 9,
          is_completed: false,
          is_active: true,
        },
      ];

      for (const lesson of lessons) {
        await this.createLesson(lesson);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // תצוגה מקדימה של קורס הכשרה של דוד אריאל
  previewDavidTrainingCourse(youtubeLinks?: string[]): {
    course: Omit<Course, 'created_at' | 'updated_at'> & { id: string };
    lessons: Array<{
      id: string;
      title: string;
      duration: string;
      durationMinutes: number;
      order: number;
      youtubeUrl?: string;
    }>;
    summary: {
      totalLessons: number;
      totalDuration: string;
      lessonsWithLinks: number;
      lessonsWithoutLinks: number;
    };
  } {
    const lessons = [
      { title: i18n.t('auto.services__courseService.s27'), duration: '11:58', order: 1 },
      { title: i18n.t('auto.services__courseService.s28'), duration: '10:18', order: 2 },
      { title: i18n.t('auto.services__courseService.s29'), duration: '6:46', order: 3 },
      { title: i18n.t('auto.services__courseService.s30'), duration: '11:06', order: 4 },
      { title: i18n.t('auto.services__courseService.s31'), duration: '15:07', order: 5 },
      { title: i18n.t('auto.services__courseService.s32'), duration: '20:02', order: 6 },
      { title: i18n.t('auto.services__courseService.s33'), duration: '18:07', order: 7 },
      { title: i18n.t('auto.services__courseService.s34'), duration: '12:48', order: 8 },
      { title: i18n.t('auto.services__courseService.s35'), duration: '14:36', order: 9 },
      { title: i18n.t('auto.services__courseService.s36'), duration: '11:39', order: 10 },
      { title: i18n.t('auto.services__courseService.s37'), duration: '0:54', order: 11 },
      { title: i18n.t('auto.services__courseService.s38'), duration: '29:01', order: 12 },
      { title: i18n.t('auto.services__courseService.s39'), duration: '17:12', order: 13 },
      { title: i18n.t('auto.services__courseService.s40'), duration: '10:29', order: 14 },
      { title: i18n.t('auto.services__courseService.s41'), duration: '16:18', order: 15 },
      { title: i18n.t('auto.services__courseService.s42'), duration: '26:23', order: 16 },
      { title: i18n.t('auto.services__courseService.s43'), duration: '16:32', order: 17 },
      { title: i18n.t('auto.services__courseService.s44'), duration: '12:54', order: 18 },
      { title: i18n.t('auto.services__courseService.s45'), duration: '15:03', order: 19 },
      { title: i18n.t('auto.services__courseService.s46'), duration: '12:38', order: 20 },
      { title: i18n.t('auto.services__courseService.s47'), duration: '10:11', order: 21 },
      { title: i18n.t('auto.services__courseService.s48'), duration: '14:47', order: 22 },
      { title: i18n.t('auto.services__courseService.s49'), duration: '14:02', order: 23 },
      { title: i18n.t('auto.services__courseService.s50'), duration: '15:42', order: 24 },
      { title: i18n.t('auto.services__courseService.s51'), duration: '14:47', order: 25 },
      { title: i18n.t('auto.services__courseService.s52'), duration: '14:34', order: 26 },
      { title: i18n.t('auto.services__courseService.s53'), duration: '12:00', order: 27 },
      { title: i18n.t('auto.services__courseService.s54'), duration: '8:33', order: 28 },
      { title: i18n.t('auto.services__courseService.s55'), duration: '14:13', order: 29 },
      { title: i18n.t('auto.services__courseService.s56'), duration: '7:12', order: 30 },
      { title: i18n.t('auto.services__courseService.s57'), duration: '8:51', order: 31 },
      { title: i18n.t('auto.services__courseService.s58'), duration: '8:48', order: 32 },
      { title: i18n.t('auto.services__courseService.s59'), duration: '9:03', order: 33 },
      { title: i18n.t('auto.services__courseService.s60'), duration: '11:26', order: 34 },
      { title: i18n.t('auto.services__courseService.s61'), duration: '10:24', order: 35 },
      { title: i18n.t('auto.services__courseService.s62'), duration: '15:34', order: 36 },
      { title: i18n.t('auto.services__courseService.s63'), duration: '9:18', order: 37 },
      { title: i18n.t('auto.services__courseService.s64'), duration: '12:02', order: 38 },
      { title: i18n.t('auto.services__courseService.s65'), duration: '11:11', order: 39 },
      { title: i18n.t('auto.services__courseService.s66'), duration: '0', order: 40 },
    ];

    const parseDuration = (duration: string): number => {
      if (!duration || duration === '0') return 0;
      const parts = duration.split(':');
      if (parts.length === 2) {
        // MM:SS → total seconds / 60 = decimal minutes (preserves precision for formatDuration)
        return (parseInt(parts[0]) * 60 + parseInt(parts[1])) / 60;
      }
      return 0;
    };

    const totalMinutes = lessons.reduce((sum, lesson) => sum + parseDuration(lesson.duration), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.round(totalMinutes % 60);
    const totalDuration = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;

    const lessonsWithLinks = youtubeLinks ? youtubeLinks.filter(link => link).length : 0;
    const lessonsWithoutLinks = lessons.length - lessonsWithLinks;

    return {
      course: {
        id: 'david-training-course',
        title: i18n.t('auto.services__courseService.s67'),
        subtitle: i18n.t('auto.services__courseService.s68'),
        description:
          i18n.t('auto.services__courseService.s69'),
        cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        instructor_name: i18n.t('auto.services__courseService.s4'),
        instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        duration_hours: Math.round(totalMinutes / 60),
        level: i18n.t('auto.services__courseService.s70'),
        rating: 0,
        students_count: 0,
        price: 0,
        original_price: 0,
        is_active: true,
      },
      lessons: lessons.map((lesson, index) => ({
        id: `david-training-lesson-${index + 2}`, // מתחיל מ-2 כי השיעור הראשון (ברוכים הבאים) הוסר
        title: lesson.title,
        duration: lesson.duration,
        durationMinutes: Math.round(parseDuration(lesson.duration)),
        order: lesson.order,
        youtubeUrl: youtubeLinks && youtubeLinks[index] ? youtubeLinks[index] : undefined,
      })),
      summary: {
        totalLessons: lessons.length,
        totalDuration: totalDuration,
        lessonsWithLinks,
        lessonsWithoutLinks,
      },
    };
  }

  // יצירת קורס הכשרה של דוד אריאל עם שיעורים מיוטיוב
  async createDavidTrainingCourse(youtubeLinks?: string[]): Promise<boolean> {
    try {
      // בדיקה אם הקורס כבר קיים
      const existingCourse = await this.getCourseById('david-training-course');
      let courseId: string;

      if (existingCourse) {
        courseId = existingCourse.id;
      } else {
        // יצירת הקורס
        const course = await this.createCourse({
          id: 'david-training-course',
          title: i18n.t('auto.services__courseService.s67'),
          subtitle: i18n.t('auto.services__courseService.s68'),
          description:
            i18n.t('auto.services__courseService.s69'),
          cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
          instructor_name: i18n.t('auto.services__courseService.s4'),
          instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
          duration_hours: 6, // יעודכן לפי השיעורים
          level: i18n.t('auto.services__courseService.s70'),
          rating: 0,
          students_count: 0,
          price: 0,
          original_price: 0,
          is_active: true,
        });

        if (!course) {
          return false;
        }

        courseId = course.id;
      }

      // רשימת השיעורים
      const lessons = [
        { title: i18n.t('auto.services__courseService.s27'), duration: '11:58', order: 1 },
        { title: i18n.t('auto.services__courseService.s28'), duration: '10:18', order: 2 },
        { title: i18n.t('auto.services__courseService.s29'), duration: '6:46', order: 3 },
        { title: i18n.t('auto.services__courseService.s30'), duration: '11:06', order: 4 },
        { title: i18n.t('auto.services__courseService.s31'), duration: '15:07', order: 5 },
        { title: i18n.t('auto.services__courseService.s32'), duration: '20:02', order: 6 },
        { title: i18n.t('auto.services__courseService.s33'), duration: '18:07', order: 7 },
        { title: i18n.t('auto.services__courseService.s34'), duration: '12:48', order: 8 },
        { title: i18n.t('auto.services__courseService.s35'), duration: '14:36', order: 9 },
        { title: i18n.t('auto.services__courseService.s36'), duration: '11:39', order: 10 },
        { title: i18n.t('auto.services__courseService.s37'), duration: '0:54', order: 11 },
        { title: i18n.t('auto.services__courseService.s38'), duration: '29:01', order: 12 },
        { title: i18n.t('auto.services__courseService.s39'), duration: '17:12', order: 13 },
        { title: i18n.t('auto.services__courseService.s40'), duration: '10:29', order: 14 },
        { title: i18n.t('auto.services__courseService.s41'), duration: '16:18', order: 15 },
        { title: i18n.t('auto.services__courseService.s42'), duration: '26:23', order: 16 },
        { title: i18n.t('auto.services__courseService.s43'), duration: '16:32', order: 17 },
        { title: i18n.t('auto.services__courseService.s44'), duration: '12:54', order: 18 },
        { title: i18n.t('auto.services__courseService.s45'), duration: '15:03', order: 19 },
        { title: i18n.t('auto.services__courseService.s46'), duration: '12:38', order: 20 },
        { title: i18n.t('auto.services__courseService.s47'), duration: '10:11', order: 21 },
        { title: i18n.t('auto.services__courseService.s48'), duration: '14:47', order: 22 },
        { title: i18n.t('auto.services__courseService.s49'), duration: '14:02', order: 23 },
        { title: i18n.t('auto.services__courseService.s50'), duration: '15:42', order: 24 },
        { title: i18n.t('auto.services__courseService.s51'), duration: '14:47', order: 25 },
        { title: i18n.t('auto.services__courseService.s52'), duration: '14:34', order: 26 },
        { title: i18n.t('auto.services__courseService.s53'), duration: '12:00', order: 27 },
        { title: i18n.t('auto.services__courseService.s54'), duration: '8:33', order: 28 },
        { title: i18n.t('auto.services__courseService.s55'), duration: '14:13', order: 29 },
        { title: i18n.t('auto.services__courseService.s56'), duration: '7:12', order: 30 },
        { title: i18n.t('auto.services__courseService.s57'), duration: '8:51', order: 31 },
        { title: i18n.t('auto.services__courseService.s58'), duration: '8:48', order: 32 },
        { title: i18n.t('auto.services__courseService.s59'), duration: '9:03', order: 33 },
        { title: i18n.t('auto.services__courseService.s60'), duration: '11:26', order: 34 },
        { title: i18n.t('auto.services__courseService.s61'), duration: '10:24', order: 35 },
        { title: i18n.t('auto.services__courseService.s62'), duration: '15:34', order: 36 },
        { title: i18n.t('auto.services__courseService.s63'), duration: '9:18', order: 37 },
        { title: i18n.t('auto.services__courseService.s64'), duration: '12:02', order: 38 },
        { title: i18n.t('auto.services__courseService.s65'), duration: '11:11', order: 39 },
        { title: i18n.t('auto.services__courseService.s66'), duration: '0', order: 40 },
      ];

      // פונקציה להמרת זמן מפורמט MM:SS לדקות (מעוגל כלפי מטה)
      // '11:58' → 11 דקות, '0:54' → 0 דקות (פחות מדקה)
      const parseDuration = (duration: string): number => {
        if (!duration || duration === '0') return 0;
        const parts = duration.split(':');
        if (parts.length === 2) {
          // החזר דקות מדויקות (שניות / 60, לא דקות + שניות/60)
          const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          return totalSeconds / 60; // decimal minutes — formatDuration reconstructs MM:SS correctly
        }
        return 0;
      };

      // יצירת השיעורים
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        // ה-ID מתחיל מ-2 כי השיעור הראשון (ברוכים הבאים) הוסר והיה david-training-lesson-1
        const lessonId = `david-training-lesson-${i + 2}`;
        
        // בדיקה אם השיעור כבר קיים
        const existingLessons = await this.getCourseLessons(courseId);
        const existingLesson = existingLessons.find(l => l.id === lessonId);
        
        if (!existingLesson) {
          const createdLesson = await this.createLesson({
            id: lessonId,
            course_id: courseId,
            title: lesson.title,
            description: i18n.t('auto.services__courseService.s71', { v0: i + 1 }),
            duration_minutes: parseDuration(lesson.duration),
            order_index: lesson.order,
            is_completed: false,
            is_active: true,
          });

          if (createdLesson && youtubeLinks && youtubeLinks[i]) {
            // הוספת קישור יוטיוב דרך mediaService
            const mediaService = (await import('./mediaService')).mediaService;
            await mediaService.createDavidTrainingLessonMedia(
              courseId,
              lessonId,
              lesson.title,
              youtubeLinks[i],
              i18n.t('auto.services__courseService.s71', { v0: i + 1 }),
              parseDuration(lesson.duration)
            );
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

export const courseService = new CourseService();
