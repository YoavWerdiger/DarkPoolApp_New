import type { CourseWithProgress } from '../../types/learning';

export const DAVID_TRAINING_COURSE_ID = 'david-training-course';
export const ORACLE_COURSE_ID = 'oracle-course';
export const WHALES_COURSE_IDS = ['whales-course-1', 'whales-course'] as const;

export function isWhalesCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return (
    WHALES_COURSE_IDS.includes(course.id as (typeof WHALES_COURSE_IDS)[number]) ||
    course.slug === 'whales-course' ||
    course.title === 'הלווייתנים' ||
    course.title === 'קורס הלוויתנים'
  );
}

export function isOracleCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return (
    course.id === ORACLE_COURSE_ID ||
    course.slug === 'oracle-course' ||
    course.title === 'האורקל'
  );
}

/** קורסים שעדיין לא פתוחים — לחיצה מציגה מסך Coming Soon */
export function isComingSoonCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return isOracleCourse(course);
}

export function isDavidTrainingCourse(course: Pick<CourseWithProgress, 'id' | 'title'>): boolean {
  return (
    course.id === DAVID_TRAINING_COURSE_ID ||
    course.title === 'יסודות המסחר' ||
    course.title === 'הכשרה של דוד אריאל'
  );
}

/** כותרת משנה לתצוגה בכרטיס/Coming Soon */
export const WHALES_COURSE_SUBTITLE = 'מסחר יומי במניות ובאופציות';

export function getAcademyCourseSubtitle(
  course: Pick<CourseWithProgress, 'id' | 'slug' | 'title' | 'subtitle'>
): string {
  if (isWhalesCourse(course)) return WHALES_COURSE_SUBTITLE;
  return (course.subtitle || '').trim();
}

/** שורת "למי הקורס מתאים" לתצוגה בכרטיס האקדמיה */
export function getAcademyCourseAudience(
  course: Pick<CourseWithProgress, 'id' | 'slug' | 'title' | 'description'>
): string {
  if (isDavidTrainingCourse(course)) {
    return 'לכל מי שרוצה להתחיל לסחור או להשקיע בשוק ההון, גם ללא ניסיון קודם.';
  }
  if (isOracleCourse(course)) {
    return 'לסוחרים שמכירים את יסודות השוק ורוצים ללמוד מסחר סווינג באופציות.';
  }
  if (isWhalesCourse(course)) {
    return 'לסוחרים שרוצים להתמחות במסחר יומי ולזהות תנועות כסף חכם בשוק.';
  }
  const desc = (course.description || '').trim();
  const match = desc.match(/למי הקורס מתאים\?\s*\n([^\n]+)/);
  return match?.[1]?.trim() || '';
}

/** קורסים שנפתחים ב-LearningScreen (לא CourseDetailScreen) */
export function isNativeLearningCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return isWhalesCourse(course) || isDavidTrainingCourse(course);
}

export type AcademyCourseTier = 'free' | 'premium';

export function getAcademyCourseTier(
  course: Pick<CourseWithProgress, 'id' | 'slug' | 'title' | 'access'> & { price?: number }
): AcademyCourseTier {
  if (isWhalesCourse(course) || isOracleCourse(course)) return 'premium';
  if (course.access === 'paid' || (typeof course.price === 'number' && course.price > 0)) {
    return 'premium';
  }
  return 'free';
}

/** משך בדקות — תומך גם ב-duration_hours מהמסד */
export function getCourseDurationMinutes(course: {
  duration_minutes?: number | null;
  duration_hours?: number | null;
}): number {
  if (typeof course.duration_minutes === 'number' && course.duration_minutes > 0) {
    return course.duration_minutes;
  }
  if (typeof course.duration_hours === 'number' && course.duration_hours > 0) {
    return Math.round(course.duration_hours * 60);
  }
  return 0;
}

/** רוחב אחיד לתג העליון — חינמי (טקסט) ופרמיום (כתר) */
export const ACADEMY_BADGE_MIN_WIDTH = 108;

/** סדר מסלול הלמידה באקדמיה: יסודות → אורקל → לוויתנים */
const ACADEMY_COURSE_ORDER: string[] = [
  DAVID_TRAINING_COURSE_ID,
  ORACLE_COURSE_ID,
  ...WHALES_COURSE_IDS,
];

export function sortAcademyCourses<T extends { id: string }>(courses: T[]): T[] {
  return [...courses].sort((a, b) => {
    const ai = ACADEMY_COURSE_ORDER.indexOf(a.id);
    const bi = ACADEMY_COURSE_ORDER.indexOf(b.id);
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.id.localeCompare(b.id);
  });
}
