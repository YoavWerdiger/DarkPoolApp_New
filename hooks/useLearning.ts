import { useState, useEffect } from 'react';

// קורס דמה פשוט
const DEMO_COURSE = {
  id: 'demo-course-1',
  title: 'קורס React Native למתחילים',
  subtitle: 'למד לבנות אפליקציות מובייל עם React Native',
  description: 'קורס מקיף שילמד אותך את כל היסודות של React Native, מהתקנה ועד לפרסום אפליקציה בחנויות.',
  cover_url: 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=React+Native',
  instructor: {
    name: 'יואב וייס',
    avatar: 'https://via.placeholder.com/50x50/10B981/FFFFFF?text=YW'
  },
  duration: '4 שעות',
  level: 'מתחילים',
  lessons: [
    {
      id: 'lesson-1',
      title: 'התקנה והגדרה',
      duration: '45 דקות',
      description: 'איך להתקין את React Native ולהגדיר את הסביבה',
      completed: true,
      type: 'video'
    },
    {
      id: 'lesson-2', 
      title: 'קומפוננטים בסיסיים',
      duration: '60 דקות',
      description: 'למד על View, Text, TouchableOpacity ועוד',
      completed: true,
      type: 'video'
    },
    {
      id: 'lesson-3',
      title: 'ניווט בין מסכים',
      duration: '50 דקות', 
      description: 'איך ליצור ניווט בין מסכים שונים',
      completed: false,
      type: 'video'
    },
    {
      id: 'lesson-4',
      title: 'עבודה עם API',
      duration: '45 דקות',
      description: 'איך לחבר את האפליקציה לשרת',
      completed: false,
      type: 'video'
    }
  ]
};

export function useCourses() {
  const [courses, setCourses] = useState([DEMO_COURSE]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // סימולציה של טעינה
      await new Promise(resolve => setTimeout(resolve, 500));
      setCourses([DEMO_COURSE]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return {
    courses,
    loading,
    error,
    refetch: fetchCourses
  };
}

export function useCourse(courseId: string) {
  const [course, setCourse] = useState(DEMO_COURSE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCourse = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // סימולציה של טעינה
      await new Promise(resolve => setTimeout(resolve, 300));
      setCourse(DEMO_COURSE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchCourse();
    }
  }, [courseId]);

  return {
    course,
    loading,
    error,
    refetch: fetchCourse
  };
}

export function useLesson(lessonId: string) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLesson = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // סימולציה של טעינה
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // מצא את השיעור בקורס הדמה
      const foundLesson = DEMO_COURSE.lessons.find(l => l.id === lessonId);
      setLesson(foundLesson || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lessonId) {
      fetchLesson();
    }
  }, [lessonId]);

  return {
    lesson,
    loading,
    error,
    refetch: fetchLesson
  };
}