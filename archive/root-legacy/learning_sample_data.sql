-- Sample Data for Learning System
-- Insert sample data for testing the learning system

-- Insert sample instructor
INSERT INTO learning.instructors (id, user_id, display_name, bio, avatar_url)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000', -- Replace with actual user ID
  'ד"ר יוסי כהן',
  'מרצה בכיר למדעי המחשב עם ניסיון של 15 שנה בהוראה ופיתוח תוכנה.',
  null
);

-- Insert sample course
INSERT INTO learning.courses (
  id, slug, title, subtitle, description, cover_url, access, language, 
  published, owner_id, preview_enabled, preview_lesson_count, tags
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'react-native-basics',
  'יסודות React Native',
  'קורס מקיף לפיתוח אפליקציות מובייל',
  'קורס זה ילמד אותך את היסודות של פיתוח אפליקציות מובייל עם React Native. נכיר את הרכיבים הבסיסיים, ניווט, עיצוב ופרסום אפליקציות.',
  null,
  'free',
  'he',
  true,
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  2,
  ARRAY['React Native', 'Mobile Development', 'JavaScript', 'Beginner']
);

-- Insert sample modules
INSERT INTO learning.modules (id, course_id, title, description, sort_index)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440002',
    'מבוא ל-React Native',
    'הכרת הסביבה והכלים הבסיסיים',
    1
  ),
  (
    '550e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440002',
    'רכיבים וניווט',
    'למידת רכיבים בסיסיים ומערכת ניווט',
    2
  ),
  (
    '550e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440002',
    'עיצוב וסטיילינג',
    'עיצוב ממשק משתמש ואנימציות',
    3
  );

-- Insert sample lessons
INSERT INTO learning.lessons (id, module_id, title, duration_seconds, is_preview, sort_index)
VALUES 
  -- Module 1 lessons
  (
    '550e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440003',
    'מה זה React Native?',
    300,
    true,
    1
  ),
  (
    '550e8400-e29b-41d4-a716-446655440007',
    '550e8400-e29b-41d4-a716-446655440003',
    'התקנה והגדרה',
    600,
    true,
    2
  ),
  (
    '550e8400-e29b-41d4-a716-446655440008',
    '550e8400-e29b-41d4-a716-446655440003',
    'פרויקט ראשון',
    900,
    false,
    3
  ),
  
  -- Module 2 lessons
  (
    '550e8400-e29b-41d4-a716-446655440009',
    '550e8400-e29b-41d4-a716-446655440004',
    'רכיבים בסיסיים',
    450,
    false,
    1
  ),
  (
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440004',
    'מערכת ניווט',
    750,
    false,
    2
  ),
  
  -- Module 3 lessons
  (
    '550e8400-e29b-41d4-a716-446655440011',
    '550e8400-e29b-41d4-a716-446655440005',
    'StyleSheet ו-Flexbox',
    600,
    false,
    1
  ),
  (
    '550e8400-e29b-41d4-a716-446655440012',
    '550e8400-e29b-41d4-a716-446655440005',
    'אנימציות',
    900,
    false,
    2
  );

-- Insert sample lesson blocks
INSERT INTO learning.lesson_blocks (id, lesson_id, type, sort_index, text_md, video_key, video_poster_url)
VALUES 
  -- Lesson 1 blocks
  (
    '550e8400-e29b-41d4-a716-446655440013',
    '550e8400-e29b-41d4-a716-446655440006',
    'text',
    1,
    '# מה זה React Native?

React Native הוא framework פיתוח אפליקציות מובייל שנוצר על ידי Facebook (Meta). הוא מאפשר לפתח אפליקציות native עבור iOS ו-Android באמצעות JavaScript ו-React.

## יתרונות של React Native:

- **Cross-platform**: קוד אחד עבור שתי הפלטפורמות
- **Performance**: ביצועים דומים לאפליקציות native
- **Hot Reload**: עדכון מהיר של הקוד
- **קהילה גדולה**: הרבה ספריות ותמיכה

## מתי להשתמש ב-React Native?

- פיתוח אפליקציות מובייל
- צוות עם ניסיון ב-React
- צורך בפיתוח מהיר
- תקציב מוגבל'
  ),
  
  -- Lesson 2 blocks
  (
    '550e8400-e29b-41d4-a716-446655440014',
    '550e8400-e29b-41d4-a716-446655440007',
    'video',
    1,
    null,
    'course-media/550e8400-e29b-41d4-a716-446655440002/videos/550e8400-e29b-41d4-a716-446655440007/installation.mp4',
    null
  ),
  
  -- Lesson 3 blocks
  (
    '550e8400-e29b-41d4-a716-446655440015',
    '550e8400-e29b-41d4-a716-446655440008',
    'text',
    1,
    '# פרויקט ראשון

בואו ניצור את הפרויקט הראשון שלנו עם React Native.

## שלבים:

1. **יצירת פרויקט חדש**
   ```bash
   npx create-expo-app MyFirstApp
   cd MyFirstApp
   ```

2. **הפעלת הפרויקט**
   ```bash
   npm start
   ```

3. **עריכת הקוד**
   פתח את הקובץ `App.js` וערוך את התוכן.

## תרגיל:
צור אפליקציה פשוטה שמציגה "שלום עולם" על המסך.'
  ),
  
  -- Lesson 4 blocks
  (
    '550e8400-e29b-41d4-a716-446655440016',
    '550e8400-e29b-41d4-a716-446655440009',
    'video',
    1,
    null,
    'course-media/550e8400-e29b-41d4-a716-446655440002/videos/550e8400-e29b-41d4-a716-446655440009/components.mp4',
    null
  ),
  
  -- Lesson 5 blocks
  (
    '550e8400-e29b-41d4-a716-446655440017',
    '550e8400-e29b-41d4-a716-446655440010',
    'quiz',
    1,
    null,
    null,
    null
  );

-- Insert sample quiz questions
INSERT INTO learning.quiz_questions (id, block_id, type, prompt, choices, correct_indices, explanation)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440018',
    '550e8400-e29b-41d4-a716-446655440017',
    'single',
    'איזה רכיב משמש לניווט בין מסכים ב-React Native?',
    ARRAY['Navigator', 'NavigationContainer', 'Stack.Screen', 'Router'],
    ARRAY[1],
    'NavigationContainer הוא הרכיב העיקרי שמספק את מערכת הניווט ב-React Navigation.'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440019',
    '550e8400-e29b-41d4-a716-446655440017',
    'multiple',
    'איזה מהרכיבים הבאים הם רכיבי React Native בסיסיים?',
    ARRAY['View', 'Text', 'Image', 'Button', 'div', 'span'],
    ARRAY[0, 1, 2, 3],
    'View, Text, Image ו-Button הם רכיבי React Native בסיסיים. div ו-span הם רכיבי HTML.'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440020',
    '550e8400-e29b-41d4-a716-446655440017',
    'truefalse',
    'React Native מאפשר לפתח אפליקציות עבור iOS ו-Android עם קוד אחד.',
    ARRAY['נכון', 'לא נכון'],
    ARRAY[0],
    'כן, זה אחד היתרונות העיקריים של React Native - קוד אחד עבור שתי הפלטפורמות.'
  );

-- Insert sample course review
INSERT INTO learning.course_reviews (id, course_id, user_id, rating, comment)
VALUES (
  '550e8400-e29b-41d4-a716-446655440021',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000', -- Replace with actual user ID
  5,
  'קורס מעולה! הסברים ברורים ודוגמאות טובות. מומלץ מאוד למתחילים.'
);

-- Insert another sample course
INSERT INTO learning.courses (
  id, slug, title, subtitle, description, cover_url, access, language, 
  published, owner_id, preview_enabled, preview_lesson_count, tags
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440022',
  'javascript-advanced',
  'JavaScript מתקדם',
  'קורס מתקדם לתכנות JavaScript',
  'קורס זה מיועד למפתחים עם ניסיון בסיסי ב-JavaScript שרוצים להעמיק את הידע שלהם.',
  null,
  'registration',
  'he',
  true,
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  1,
  ARRAY['JavaScript', 'Advanced', 'Programming', 'ES6']
);

-- Insert module for second course
INSERT INTO learning.modules (id, course_id, title, description, sort_index)
VALUES (
  '550e8400-e29b-41d4-a716-446655440023',
  '550e8400-e29b-41d4-a716-446655440022',
  'ES6+ Features',
  'למידת תכונות מתקדמות של JavaScript',
  1
);

-- Insert lesson for second course
INSERT INTO learning.lessons (id, module_id, title, duration_seconds, is_preview, sort_index)
VALUES (
  '550e8400-e29b-41d4-a716-446655440024',
  '550e8400-e29b-41d4-a716-446655440023',
  'Arrow Functions ו-Template Literals',
  400,
  true,
  1
);

-- Insert lesson block for second course
INSERT INTO learning.lesson_blocks (id, lesson_id, type, sort_index, text_md)
VALUES (
  '550e8400-e29b-41d4-a716-446655440025',
  '550e8400-e29b-41d4-a716-446655440024',
  'text',
  1,
  '# Arrow Functions ו-Template Literals

## Arrow Functions

Arrow functions הם דרך קצרה יותר לכתיבת פונקציות ב-JavaScript.

```javascript
// פונקציה רגילה
function add(a, b) {
  return a + b;
}

// Arrow function
const add = (a, b) => a + b;
```

## Template Literals

Template literals מאפשרים לשלב משתנים בתוך מחרוזות.

```javascript
const name = "יוסי";
const age = 30;

// שיטה ישנה
const message = "שלום " + name + ", אתה בן " + age;

// Template literal
const message = `שלום ${name}, אתה בן ${age}`;
```'
);

