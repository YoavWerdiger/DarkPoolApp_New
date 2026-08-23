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
        title: 'האורקל',
        subtitle: 'קורס הדגל של DarkPool למסחר סווינג באופציות',
        description:
          'למי הקורס מתאים?\nלסוחרים שכבר מכירים את יסודות שוק ההון ורוצים ללמוד כיצד לסחור באופציות בצורה מקצועית, מדויקת ושיטתית.\n\nמה תלמדו בקורס?\nבקורס תלמדו כיצד לאתר עסקאות סווינג איכותיות באופציות, לבצע ניתוח טכני מתקדם, לזהות אזורי כניסה ויציאה בעלי הסתברות גבוהה, להבין כיצד האופציות מתנהגות בפועל, לנהל סיכונים בצורה נכונה ולבנות אסטרטגיית מסחר עקבית לטווח הארוך.\n\nהמטרה היא להעניק לכם שיטה ברורה ומסודרת שתאפשר לכם לקבל החלטות מבוססות נתונים, במקום לפעול מתוך רגש או ניחוש.',
        cover_url: coverUrl,
        instructor_name: 'דוד אריאל',
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
        title: 'הלווייתנים',
        subtitle: 'מסחר יומי לפי זרימות מוסדיות ונזילות',
        description:
          'למי הקורס מתאים?\nלסוחרים שרוצים להעמיק במסחר יומי ולהבין כיצד לזהות זרימות גדולות ונזילות בשוק.\n\nמה תלמדו בקורס?\nבקורס תלמדו כלים לניתוח מבנה שוק ונזילות — כולל מושגים מעולם ה־Smart Money Concepts (Order Blocks, FVG, Premium & Discount ועוד) — ואיך ליישם אותם במסחר יומי במניות ובאופציות.\n\nבנוסף תלמדו כיצד לבנות תוכנית עבודה יומית, לנהל עסקאות בזמן אמת ולשלב בין ניתוח זרימות לבין ניהול סיכונים מסודר.',
        cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/whales-course-banner.jpg`,
        instructor_name: 'דוד אריאל',
        instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        duration_hours: 8,
        level: 'מתקדם',
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
          title: 'הכירות עם הקורס',
          description: 'הכרות עם הקורס והנושאים שילמדו בו',
          duration_minutes: 45,
          order_index: 1,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-2',
          course_id: course.id,
          title: 'מה זה - Price Action',
          description: 'הבנת מושגי ה-Price Action והשימוש בהם',
          duration_minutes: 60,
          order_index: 2,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-3',
          course_id: course.id,
          title: 'מה זה - Liquidity',
          description: 'הבנת מושג הנזילות והשפעתו על השוק',
          duration_minutes: 40,
          order_index: 3,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-4',
          course_id: course.id,
          title: 'מה זה - FVG',
          description: 'הבנת Fair Value Gaps וזיהוי הזדמנויות',
          duration_minutes: 35,
          order_index: 4,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-5',
          course_id: course.id,
          title: 'מה זה - IFVG',
          description: 'הבנת Imbalanced Fair Value Gaps',
          duration_minutes: 30,
          order_index: 5,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-6',
          course_id: course.id,
          title: 'אסטרטגיית - מודל PO3',
          description: 'לימוד מודל PO3 ואסטרטגיות מסחר',
          duration_minutes: 50,
          order_index: 6,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-7',
          course_id: course.id,
          title: 'אסטרטגיית - Golden Zone + FVG',
          description: 'שילוב Golden Zone עם Fair Value Gaps',
          duration_minutes: 55,
          order_index: 7,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-8',
          course_id: course.id,
          title: 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)',
          description: 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה',
          duration_minutes: 90,
          order_index: 8,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-9',
          course_id: course.id,
          title: 'הלוויתנים מקנאים בכם!',
          description: 'הבנת התנהגות הלוויתנים והשפעתם על השוק',
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
      { title: 'שיעור 1 - מהו שוק ההון?', duration: '11:58', order: 1 },
      { title: 'שיעור 2 - בורסה ומניות - כל מה שרציתם לדעת', duration: '10:18', order: 2 },
      { title: 'שיעור 3 - מהי הנפקה בבורסה וסימול מניה?', duration: '6:46', order: 3 },
      { title: 'שיעור 4 - מה הן עסקאות לונג?', duration: '11:06', order: 4 },
      { title: 'שיעור 5 - 🔴 מה הן עסקאות שורט? (איך להרוויח מירידה)', duration: '15:07', order: 5 },
      { title: 'שיעור 6 - 📊 השחקנים בשוק ההון/ההבדלים בין סוגי המסחר/תכונות רצויות לסוחר', duration: '20:02', order: 6 },
      { title: 'שיעור 7 - 🛑פקודת - סטופ לוס - כל מה שרציתם לדעת!', duration: '18:07', order: 7 },
      { title: 'שיעור 8 - 💵פקודת - טייק פרופיט - הסרטון היחיד שתצטרכו!', duration: '12:48', order: 8 },
      { title: 'שיעור 9 - פקודות מסחר מארקט, לימיט, וסטופ', duration: '14:36', order: 9 },
      { title: 'שיעור 10 - נרות יפניים - הסרטון היחיד שתצטרכו!', duration: '11:39', order: 10 },
      { title: 'שיעור 11 - ווליום מסחר - כל מה שרציתם לדעת!', duration: '0:54', order: 11 },
      { title: '🏆הסבר על קהילת הסוחרים שלנו - DARKPOOL', duration: '29:01', order: 12 },
      { title: 'שיעור 12 - הדרכת אתר טריידינגוויו - Tradingview (חלק א׳)', duration: '17:12', order: 13 },
      { title: 'שיעור 13 - הדרכת אתר טריידינגוויו - Tradingview (חלק ב׳)', duration: '10:29', order: 14 },
      { title: 'שיעור 14 - 📱 הדרכת - TradingView מהטלפון', duration: '16:18', order: 15 },
      { title: 'שיעור 15 - מגמות בגרף - מה שרציתם לדעת!', duration: '26:23', order: 16 },
      { title: 'שיעור 16 - רמות תמיכה והתנגדות', duration: '16:32', order: 17 },
      { title: 'שיעור 17 - ״פריצה ובדיקה״ - אסטרטגיית מסחר!', duration: '12:54', order: 18 },
      { title: 'שיעור 18 - גאפים בגרף (פערים)', duration: '15:03', order: 19 },
      { title: 'שיעור 19 - ניהול סיכונים במסחר - (חובה לכל סוחר!)', duration: '12:38', order: 20 },
      { title: 'שיעור 20 - מה הם אינדיקטורים + שימוש ב-EMA', duration: '10:11', order: 21 },
      { title: 'שיעור 21 - תיקון פיבונאצ׳י - אסטרטגיית מסחר מוכחת!', duration: '14:47', order: 22 },
      { title: 'שיעור 22 - 📈 נרות היפוך וסיפורו של הנר', duration: '14:02', order: 23 },
      { title: 'שיעור 23 - תבניות היפוך (סווינג) כל מה שרציתם לדעת!💸', duration: '15:42', order: 24 },
      { title: 'שיעור 24 - 🚩 אסטרטגיית התכנסויות דגלים ודגלונים', duration: '14:47', order: 25 },
      { title: 'שיעור 25 - איך לזהות עסקת סווינג מקצועית', duration: '14:34', order: 26 },
      { title: 'שיעור 26 - איך להציב סטופ לוס כמו סוחר מקצועי! 🛑🫵', duration: '12:00', order: 27 },
      { title: 'שיעור 27 - סקטורים בשוק ההון', duration: '8:33', order: 28 },
      { title: 'שיעור 28 - תתי סקטורים', duration: '14:13', order: 29 },
      { title: 'שיעור 29 - הדרכת אתר Finviz (סורק מניות)', duration: '7:12', order: 30 },
      { title: 'שיעור 30 - מתכוננים לשבוע מסחר', duration: '8:51', order: 31 },
      { title: 'שיעור 31 - מסחר בדמו + כללים', duration: '8:48', order: 32 },
      { title: 'שיעור 32 - יומן מסחר ויתרונתיו + יומן מקצועי', duration: '9:03', order: 33 },
      { title: 'שיעור 33 - פתיחת חשבון מסחר (סרטון חובה לפני שבוחרים ברוקר!)', duration: '11:26', order: 34 },
      { title: 'שיעור 34 - הדרכת קולמקס פרו מהטלפון', duration: '10:24', order: 35 },
      { title: 'שיעור 35 - ספליט במניות', duration: '15:34', order: 36 },
      { title: 'שיעור 36 - מה זה מינוף בשוק ההון', duration: '9:18', order: 37 },
      { title: 'שיעור 37 - מה זה מיצוע (DCA)', duration: '12:02', order: 38 },
      { title: 'שיעור 38 - שורט סקוויז? ואיך זה קשור למניית GME', duration: '11:11', order: 39 },
      { title: 'שיעור 39 - עונת הדוחות בבורסה🔥', duration: '0', order: 40 },
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
        title: 'יסודות המסחר',
        subtitle: 'הצעד הראשון שלכם לעולם שוק ההון',
        description:
          'למי הקורס מתאים?\nלכל מי שרוצה להתחיל לסחור או להשקיע בשוק ההון, גם ללא ניסיון או ידע קודם.\n\nמה תלמדו בקורס?\nקורס יסודות המסחר נבנה כדי להעניק לכם בסיס מקצועי וחזק בעולם שוק ההון. במהלך הקורס תלמדו כיצד שוק ההון פועל, מהם סוגי הנכסים השונים, כיצד פותחים חשבון מסחר, איך קוראים גרפים, כיצד מזהים מגמות, מהם עקרונות הניתוח הטכני, כיצד מנהלים סיכונים בצורה נכונה ואיך בונים תוכנית מסחר מסודרת.\n\nבסיום הקורס תהיה לכם הבנה רחבה של עולם המסחר וכל הכלים הדרושים כדי להתקדם בביטחון לשלב הבא.',
        cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        instructor_name: 'דוד אריאל',
        instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
        duration_hours: Math.round(totalMinutes / 60),
        level: 'מתחיל',
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
          title: 'יסודות המסחר',
          subtitle: 'הצעד הראשון שלכם לעולם שוק ההון',
          description:
            'למי הקורס מתאים?\nלכל מי שרוצה להתחיל לסחור או להשקיע בשוק ההון, גם ללא ניסיון או ידע קודם.\n\nמה תלמדו בקורס?\nקורס יסודות המסחר נבנה כדי להעניק לכם בסיס מקצועי וחזק בעולם שוק ההון. במהלך הקורס תלמדו כיצד שוק ההון פועל, מהם סוגי הנכסים השונים, כיצד פותחים חשבון מסחר, איך קוראים גרפים, כיצד מזהים מגמות, מהם עקרונות הניתוח הטכני, כיצד מנהלים סיכונים בצורה נכונה ואיך בונים תוכנית מסחר מסודרת.\n\nבסיום הקורס תהיה לכם הבנה רחבה של עולם המסחר וכל הכלים הדרושים כדי להתקדם בביטחון לשלב הבא.',
          cover_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
          instructor_name: 'דוד אריאל',
          instructor_avatar: `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/course_media/channels4_profile.jpg`,
          duration_hours: 6, // יעודכן לפי השיעורים
          level: 'מתחיל',
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
        { title: 'שיעור 1 - מהו שוק ההון?', duration: '11:58', order: 1 },
        { title: 'שיעור 2 - בורסה ומניות - כל מה שרציתם לדעת', duration: '10:18', order: 2 },
        { title: 'שיעור 3 - מהי הנפקה בבורסה וסימול מניה?', duration: '6:46', order: 3 },
        { title: 'שיעור 4 - מה הן עסקאות לונג?', duration: '11:06', order: 4 },
        { title: 'שיעור 5 - 🔴 מה הן עסקאות שורט? (איך להרוויח מירידה)', duration: '15:07', order: 5 },
        { title: 'שיעור 6 - 📊 השחקנים בשוק ההון/ההבדלים בין סוגי המסחר/תכונות רצויות לסוחר', duration: '20:02', order: 6 },
        { title: 'שיעור 7 - 🛑פקודת - סטופ לוס - כל מה שרציתם לדעת!', duration: '18:07', order: 7 },
        { title: 'שיעור 8 - 💵פקודת - טייק פרופיט - הסרטון היחיד שתצטרכו!', duration: '12:48', order: 8 },
        { title: 'שיעור 9 - פקודות מסחר מארקט, לימיט, וסטופ', duration: '14:36', order: 9 },
        { title: 'שיעור 10 - נרות יפניים - הסרטון היחיד שתצטרכו!', duration: '11:39', order: 10 },
        { title: 'שיעור 11 - ווליום מסחר - כל מה שרציתם לדעת!', duration: '0:54', order: 11 },
        { title: '🏆הסבר על קהילת הסוחרים שלנו - DARKPOOL', duration: '29:01', order: 12 },
        { title: 'שיעור 12 - הדרכת אתר טריידינגוויו - Tradingview (חלק א׳)', duration: '17:12', order: 13 },
        { title: 'שיעור 13 - הדרכת אתר טריידינגוויו - Tradingview (חלק ב׳)', duration: '10:29', order: 14 },
        { title: 'שיעור 14 - 📱 הדרכת - TradingView מהטלפון', duration: '16:18', order: 15 },
        { title: 'שיעור 15 - מגמות בגרף - מה שרציתם לדעת!', duration: '26:23', order: 16 },
        { title: 'שיעור 16 - רמות תמיכה והתנגדות', duration: '16:32', order: 17 },
        { title: 'שיעור 17 - ״פריצה ובדיקה״ - אסטרטגיית מסחר!', duration: '12:54', order: 18 },
        { title: 'שיעור 18 - גאפים בגרף (פערים)', duration: '15:03', order: 19 },
        { title: 'שיעור 19 - ניהול סיכונים במסחר - (חובה לכל סוחר!)', duration: '12:38', order: 20 },
        { title: 'שיעור 20 - מה הם אינדיקטורים + שימוש ב-EMA', duration: '10:11', order: 21 },
        { title: 'שיעור 21 - תיקון פיבונאצ׳י - אסטרטגיית מסחר מוכחת!', duration: '14:47', order: 22 },
        { title: 'שיעור 22 - 📈 נרות היפוך וסיפורו של הנר', duration: '14:02', order: 23 },
        { title: 'שיעור 23 - תבניות היפוך (סווינג) כל מה שרציתם לדעת!💸', duration: '15:42', order: 24 },
        { title: 'שיעור 24 - 🚩 אסטרטגיית התכנסויות דגלים ודגלונים', duration: '14:47', order: 25 },
        { title: 'שיעור 25 - איך לזהות עסקת סווינג מקצועית', duration: '14:34', order: 26 },
        { title: 'שיעור 26 - איך להציב סטופ לוס כמו סוחר מקצועי! 🛑🫵', duration: '12:00', order: 27 },
        { title: 'שיעור 27 - סקטורים בשוק ההון', duration: '8:33', order: 28 },
        { title: 'שיעור 28 - תתי סקטורים', duration: '14:13', order: 29 },
        { title: 'שיעור 29 - הדרכת אתר Finviz (סורק מניות)', duration: '7:12', order: 30 },
        { title: 'שיעור 30 - מתכוננים לשבוע מסחר', duration: '8:51', order: 31 },
        { title: 'שיעור 31 - מסחר בדמו + כללים', duration: '8:48', order: 32 },
        { title: 'שיעור 32 - יומן מסחר ויתרונתיו + יומן מקצועי', duration: '9:03', order: 33 },
        { title: 'שיעור 33 - פתיחת חשבון מסחר (סרטון חובה לפני שבוחרים ברוקר!)', duration: '11:26', order: 34 },
        { title: 'שיעור 34 - הדרכת קולמקס פרו מהטלפון', duration: '10:24', order: 35 },
        { title: 'שיעור 35 - ספליט במניות', duration: '15:34', order: 36 },
        { title: 'שיעור 36 - מה זה מינוף בשוק ההון', duration: '9:18', order: 37 },
        { title: 'שיעור 37 - מה זה מיצוע (DCA)', duration: '12:02', order: 38 },
        { title: 'שיעור 38 - שורט סקוויז? ואיך זה קשור למניית GME', duration: '11:11', order: 39 },
        { title: 'שיעור 39 - עונת הדוחות בבורסה🔥', duration: '0', order: 40 },
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
            description: `שיעור ${i + 1} בקורס הכשרה של דוד אריאל`,
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
              `שיעור ${i + 1} בקורס הכשרה של דוד אריאל`,
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
