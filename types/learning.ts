// Learning System TypeScript Types

export type AccessLevel = 'free' | 'registration' | 'paid';
export type BlockType = 'video' | 'text' | 'pdf' | 'quiz';
export type QuizType = 'single' | 'multiple' | 'truefalse';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

// Base interfaces
export interface Instructor {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_url?: string;
  access: AccessLevel;
  language: string;
  published: boolean;
  owner_id: string;
  preview_enabled: boolean;
  preview_lesson_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Relations
  owner?: Instructor;
  modules?: Module[];
  enrollment?: Enrollment;
  progress?: CourseProgress;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
  // Relations
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  duration_seconds?: number;
  is_preview: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
  // Relations
  blocks?: LessonBlock[];
  progress?: LessonProgress;
}

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: BlockType;
  sort_index: number;
  text_md?: string;
  pdf_url?: string;
  video_key?: string;
  video_poster_url?: string;
  created_at: string;
  updated_at: string;
  // Relations
  quiz_questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  block_id: string;
  type: QuizType;
  prompt: string;
  choices: string[];
  correct_indices: number[];
  explanation?: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'refunded' | 'banned';
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  status: ProgressStatus;
  last_position_seconds: number;
  completed_at?: string;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  block_id: string;
  answers: number[];
  is_correct?: boolean;
  score?: number;
  created_at: string;
}

export interface CourseReview {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// Aggregated types for UI
export interface CourseProgress {
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  last_lesson_id?: string;
  last_position_seconds?: number;
}

export interface CourseWithProgress extends Course {
  progress: CourseProgress;
  enrollment: Enrollment;
}

export interface LessonWithProgress extends Lesson {
  progress: LessonProgress;
  blocks: LessonBlock[];
}

export interface ModuleWithLessons extends Module {
  lessons: LessonWithProgress[];
}

export interface CourseWithModules extends Course {
  modules: ModuleWithLessons[];
  enrollment?: Enrollment;
}

// API request/response types
export interface CourseFilters {
  search?: string;
  tags?: string[];
  access?: AccessLevel[];
  language?: string;
  instructor_id?: string;
  enrolled_only?: boolean;
}

export interface CourseListParams {
  page?: number;
  limit?: number;
  filters?: CourseFilters;
  sort_by?: 'created_at' | 'title' | 'rating';
  sort_order?: 'asc' | 'desc';
}

export interface CourseListResponse {
  courses: CourseWithProgress[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface EnrollRequest {
  course_id: string;
}

export interface ProgressUpdateRequest {
  lesson_id: string;
  status: ProgressStatus;
  last_position_seconds?: number;
}

export interface QuizAttemptRequest {
  block_id: string;
  answers: number[];
}

export interface QuizAttemptResponse {
  attempt_id: string;
  score?: number;
  is_passing?: boolean;
  correct_answers: number;
  total_questions: number;
  question_results: QuestionResult[];
}

export interface QuestionResult {
  question_id: string;
  is_correct: boolean;
  user_answer: number | number[];
  correct_answer: number[];
}

export interface SignedUrlRequest {
  path: string;
  expires_in?: number;
}

export interface SignedUrlResponse {
  signed_url: string;
  expires_at: string;
}

// UI component props
export interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
}

export interface ModuleSectionProps {
  module: ModuleWithLessons;
  isExpanded: boolean;
  onToggle: () => void;
  onLessonPress: (lesson: LessonWithProgress) => void;
  enrollment?: Enrollment;
}

export interface LessonRowProps {
  lesson: LessonWithProgress;
  onPress: (lesson: LessonWithProgress) => void;
  enrollment?: Enrollment;
  isLocked?: boolean;
}

export interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export interface AccessBadgeProps {
  access: AccessLevel;
}

export interface VideoPlayerProps {
  videoKey: string;
  posterUrl?: string;
  onProgress: (position: number) => void;
  onComplete: () => void;
  initialPosition?: number;
}

export interface QuizRendererProps {
  questions: QuizQuestion[];
  onSubmit: (answers: number[]) => void;
  initialAnswers?: number[];
}

// Error types
export interface LearningError {
  code: string;
  message: string;
  details?: any;
}

export class LearningError extends Error {
  code: string;
  details?: any;

  constructor(params: { code: string; message: string; details?: any }) {
    super(params.message);
    this.name = 'LearningError';
    this.code = params.code;
    this.details = params.details;
  }
}

// Navigation types
export type LearningStackParamList = {
  CoursesScreen: undefined;
  CourseDetailScreen: { courseId: string };
  LessonPlayerScreen: { lessonId: string; initialBlockIndex?: number };
  QuizScreen: { blockId: string; attemptId?: string };
  MyLearningScreen: undefined;
  CreatorStudio: undefined;
};

// Realtime event types
export interface LearningRealtimeEvent {
  type: 'lesson_published' | 'course_updated' | 'progress_updated';
  payload: any;
}

