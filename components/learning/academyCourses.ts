import type { CourseWithProgress } from '../../types/learning';

export const DAVID_TRAINING_COURSE_ID = 'david-training-course';
export const WHALES_COURSE_IDS = ['whales-course-1', 'whales-course'] as const;

export function isWhalesCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return (
    WHALES_COURSE_IDS.includes(course.id as (typeof WHALES_COURSE_IDS)[number]) ||
    course.slug === 'whales-course' ||
    course.title === 'קורס הלוויתנים'
  );
}

export function isDavidTrainingCourse(course: Pick<CourseWithProgress, 'id' | 'title'>): boolean {
  return course.id === DAVID_TRAINING_COURSE_ID || course.title === 'הכשרה של דוד אריאל';
}

/** קורסים שנפתחים ב-LearningScreen (לא CourseDetailScreen) */
export function isNativeLearningCourse(course: Pick<CourseWithProgress, 'id' | 'slug' | 'title'>): boolean {
  return isWhalesCourse(course) || isDavidTrainingCourse(course);
}

export type AcademyCourseTier = 'free' | 'premium';

export function getAcademyCourseTier(
  course: Pick<CourseWithProgress, 'id' | 'slug' | 'title' | 'access'> & { price?: number }
): AcademyCourseTier {
  if (isWhalesCourse(course)) return 'premium';
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
