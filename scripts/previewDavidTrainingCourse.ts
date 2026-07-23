// סקריפט לתצוגה מקדימה של קורס הכשרה של דוד אריאל
// להרצה: npx ts-node scripts/previewDavidTrainingCourse.ts

interface LessonPreview {
  order: number;
  title: string;
  duration: string;
  durationMinutes: number;
  youtubeUrl?: string;
}

interface CoursePreview {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  instructor: string;
  totalLessons: number;
  totalDuration: string;
  lessons: LessonPreview[];
}

function previewDavidTrainingCourse(youtubeLinks?: string[]): CoursePreview {
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

  // פונקציה להמרת זמן מפורמט MM:SS לדקות
  const parseDuration = (duration: string): number => {
    if (!duration || duration === '0') return 0;
    const parts = duration.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) + parseInt(parts[1]) / 60;
    }
    return 0;
  };

  // חישוב סך כל הדקות
  const totalMinutes = lessons.reduce((sum, lesson) => sum + parseDuration(lesson.duration), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.round(totalMinutes % 60);
  const totalDuration = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;

  // יצירת רשימת שיעורים עם קישורי יוטיוב
  const lessonsWithLinks: LessonPreview[] = lessons.map((lesson, index) => ({
    order: lesson.order,
    title: lesson.title,
    duration: lesson.duration,
    durationMinutes: Math.round(parseDuration(lesson.duration)),
    youtubeUrl: youtubeLinks && youtubeLinks[index] ? youtubeLinks[index] : undefined,
  }));

  const preview: CoursePreview = {
    id: 'david-training-course',
    title: 'הכשרה של דוד אריאל',
    subtitle: 'קורס הכשרה מקצועי',
    description: 'ההכשרה הינו קורס מסחר מלא בשוק ההון של דוד אריאל מערוץ היוטיוב של ״הפריצה לשוק ההון״, לימוד פורה ומעשיר!',
    instructor: 'דוד אריאל',
    totalLessons: lessons.length,
    totalDuration: totalDuration,
    lessons: lessonsWithLinks,
  };

  return preview;
}

// הצגת התצוגה המקדימה
function displayPreview(preview: CoursePreview) {
  console.log('\n' + '='.repeat(80));
  console.log('📚 תצוגה מקדימה: קורס הכשרה של דוד אריאל');
  console.log('='.repeat(80));
  console.log(`\n📖 כותרת: ${preview.title}`);
  console.log(`📝 תת-כותרת: ${preview.subtitle}`);
  console.log(`👤 מדריך: ${preview.instructor}`);
  console.log(`📊 סה"כ שיעורים: ${preview.totalLessons}`);
  console.log(`⏱️  סה"כ משך זמן: ${preview.totalDuration} שעות`);
  console.log(`\n📋 רשימת שיעורים:\n`);

  preview.lessons.forEach((lesson, index) => {
    console.log(`${index + 1}. ${lesson.title}`);
    console.log(`   ⏱️  משך: ${lesson.duration} (${lesson.durationMinutes} דקות)`);
    if (lesson.youtubeUrl) {
      console.log(`   🔗 קישור: ${lesson.youtubeUrl}`);
    } else {
      console.log(`   ⚠️  קישור יוטיוב: לא זמין`);
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`\n✅ סה"כ ${preview.totalLessons} שיעורים`);
  console.log(`⏱️  סה"כ ${preview.totalDuration} שעות לימוד`);
  
  const lessonsWithLinks = preview.lessons.filter(l => l.youtubeUrl).length;
  const lessonsWithoutLinks = preview.lessons.length - lessonsWithLinks;
  
  if (lessonsWithoutLinks > 0) {
    console.log(`\n⚠️  שיעורים ללא קישור יוטיוב: ${lessonsWithoutLinks}`);
  } else {
    console.log(`\n✅ כל השיעורים כוללים קישורי יוטיוב`);
  }
  
  console.log('='.repeat(80) + '\n');
}

// הרצה
const preview = previewDavidTrainingCourse();
displayPreview(preview);

// אפשר גם להעביר קישורי יוטיוב
// const youtubeLinks = [
//   'https://youtube.com/watch?v=...',
//   'https://youtube.com/watch?v=...',
//   // ... וכך הלאה
// ];
// const previewWithLinks = previewDavidTrainingCourse(youtubeLinks);
// displayPreview(previewWithLinks);

export { previewDavidTrainingCourse, displayPreview };

