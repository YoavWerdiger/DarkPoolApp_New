# מערכת הלמידה - Learning System

מערכת למידה מקיפה לאפליקציית React Native עם Supabase, הכוללת קורסים, מודולים, שיעורים, התקדמות, חידונים ועוד.

## 🚀 תכונות עיקריות

### 📚 ניהול קורסים
- **קורסים**: יצירה, עריכה ופרסום קורסים
- **מודולים**: ארגון תוכן הקורס למודולים
- **שיעורים**: שיעורים עם סוגי תוכן שונים (וידאו, טקסט, PDF, חידונים)
- **הרשמה**: הרשמה לקורסים (חינם, הרשמה, בתשלום)

### 🎯 מעקב התקדמות
- **התקדמות שיעורים**: מעקב אחר השלמת שיעורים
- **התקדמות קורסים**: אחוזי השלמה לכל קורס
- **המשכת למידה**: חזרה לנקודה האחרונה שנעצרה

### 🎥 נגן מדיה
- **נגן וידאו**: נגן וידאו עם בקרות מלאות
- **תצוגת טקסט**: תצוגת תוכן טקסטואלי
- **תצוגת PDF**: תצוגת מסמכי PDF
- **חידונים**: מערכת חידונים אינטראקטיבית

### 🔐 אבטחה וגישה
- **RLS Policies**: מדיניות אבטחה ברמת השורה
- **Signed URLs**: גישה מאובטחת לקבצי מדיה
- **הרשאות**: בקרת גישה לפי הרשמה וסוג קורס

## 📁 מבנה הקבצים

```
├── learning_schema.sql              # סכמת מסד הנתונים
├── learning_rls_policies.sql       # מדיניות RLS
├── learning_storage_policies.sql   # מדיניות Storage
├── supabase/functions/             # Edge Functions
│   ├── get-signed-media-url/       # קבלת URL חתום
│   └── finalize-quiz/              # סיום חידון
├── types/learning.ts               # TypeScript types
├── services/learningService.ts     # שירותי API
├── hooks/useLearning.ts            # React Query hooks
├── components/learning/            # קומפוננטים
│   ├── CourseCard.tsx
│   ├── ProgressRing.tsx
│   ├── AccessBadge.tsx
│   ├── ModuleSection.tsx
│   └── LessonRow.tsx
├── screens/Learning/               # מסכים
│   ├── CoursesScreen.tsx
│   ├── CourseDetailScreen.tsx
│   ├── LessonPlayerScreen.tsx
│   └── MyLearningScreen.tsx
└── navigation/LearningStack.tsx    # ניווט
```

## 🛠️ התקנה והגדרה

### 1. מסד הנתונים

הפעל את הקבצים הבאים בסדר הבא ב-Supabase SQL Editor:

```sql
-- 1. צור את הסכמה והטבלאות
\i learning_schema.sql

-- 2. הפעל את מדיניות ה-RLS
\i learning_rls_policies.sql

-- 3. הפעל את מדיניות ה-Storage
\i learning_storage_policies.sql
```

### 2. Edge Functions

העלה את ה-Edge Functions ל-Supabase:

```bash
# התקן Supabase CLI
npm install -g supabase

# התחבר לפרויקט
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# העלה את ה-Functions
supabase functions deploy get-signed-media-url
supabase functions deploy finalize-quiz
```

### 3. Storage Buckets

צור את ה-buckets הבאים ב-Supabase Storage:

- `course-media` (private) - קבצי וידאו ו-PDF
- `course-covers` (public) - תמונות כיסוי

### 4. תלויות

הוסף את התלויות הבאות לפרויקט:

```bash
npm install @tanstack/react-query
npm install expo-av
npm install expo-file-system
npm install react-native-svg
npm install react-native-pager-view
```

## 📊 מודל הנתונים

### טבלאות עיקריות

- **learning.courses** - קורסים
- **learning.modules** - מודולים בתוך קורס
- **learning.lessons** - שיעורים בתוך מודול
- **learning.lesson_blocks** - בלוקי תוכן בתוך שיעור
- **learning.enrollments** - הרשמות לקורסים
- **learning.lesson_progress** - התקדמות שיעורים
- **learning.quiz_attempts** - ניסיונות חידונים

### סוגי תוכן

- **video** - קבצי וידאו
- **text** - תוכן טקסטואלי (Markdown)
- **pdf** - מסמכי PDF
- **quiz** - חידונים

## 🎨 עיצוב ו-UI

המערכת משתמשת ב-Design System הקיים של האפליקציה:

- **צבעים**: ירוק ראשי (#00D84A), רקע כהה (#0A0A0A)
- **טיפוגרפיה**: פונטים מערכתיים עם תמיכה בעברית
- **מרווחים**: סולם מרווחים עקבי
- **RTL**: תמיכה מלאה בכיוון ימין לשמאל

## 🔧 שימוש ב-API

### React Query Hooks

```typescript
// קבלת רשימת קורסים
const { data: courses } = useCourses({
  filters: { search: 'react', access: ['free'] }
});

// קבלת קורס ספציפי
const { data: course } = useCourse(courseId);

// הרשמה לקורס
const enrollMutation = useEnrollInCourse();
await enrollMutation.mutateAsync(courseId);

// שמירת התקדמות
const saveProgressMutation = useSaveProgress();
await saveProgressMutation.mutateAsync({
  lesson_id: lessonId,
  status: 'completed'
});
```

### שירותי API

```typescript
// קבלת URL חתום לוידאו
const { signed_url } = await LearningService.getSignedUrl({
  path: 'course-media/courseId/videos/lessonId/video.mp4'
});

// סיום חידון
const result = await LearningService.finalizeQuiz(attemptId);
```

## 🚦 זרימות משתמש

### הרשמה לקורס

1. משתמש בוחר קורס
2. לוחץ על "הירשם"
3. המערכת בודקת הרשאות
4. יוצר רשומה ב-`enrollments`
5. מעדכן UI

### צפייה בשיעור

1. משתמש נכנס לשיעור
2. המערכת בודקת הרשאות גישה
3. טוען URL חתום לוידאו
4. מתחיל נגן
5. שומר התקדמות כל 5 שניות

### השלמת חידון

1. משתמש עונה על שאלות
2. שולח תשובות ל-API
3. Edge Function מחשב ציון
4. מעדכן התקדמות אם עבר
5. מציג תוצאות

## 🔒 אבטחה

### RLS Policies

- משתמשים יכולים לראות רק קורסים שפורסמו
- בעלי קורסים יכולים לערוך את הקורסים שלהם
- משתמשים יכולים לראות רק את ההתקדמות שלהם

### Storage Security

- קבצי מדיה זמינים רק למשתמשים רשומים
- שיעורי תצוגה מקדימה זמינים לכולם
- URLs חתומים עם תאריך תפוגה

## 📱 ניווט

המערכת משתמשת ב-React Navigation עם:

- **Tab Navigation** - ניווט בין קטגוריות
- **Stack Navigation** - ניווט בין מסכי הלמידה
- **Deep Linking** - קישורים ישירים לשיעורים

## 🧪 בדיקות

### בדיקות ידניות

1. **הרשמה לקורס**: בדוק הרשמה לקורס חינם
2. **צפייה בשיעור**: בדוק נגן וידאו
3. **התקדמות**: בדוק שמירת התקדמות
4. **חידונים**: בדוק מערכת חידונים
5. **RTL**: בדוק תמיכה בעברית

### בדיקות אוטומטיות

```bash
# הרץ בדיקות
npm test

# בדיקות E2E
npm run test:e2e
```

## 🚀 פריסה

### Development

```bash
npm start
```

### Production

```bash
npm run build
expo build:android
expo build:ios
```

## 📈 ביצועים

### אופטימיזציות

- **React Query**: cache חכם לנתונים
- **Lazy Loading**: טעינה עצלה של תמונות
- **Signed URLs**: URLs עם תאריך תפוגה
- **Progress Tracking**: שמירת התקדמות מקומית

### מוניטורינג

- מעקב אחר שגיאות עם Sentry
- אנליטיקס עם Firebase Analytics
- ביצועים עם React Native Performance

## 🔮 תכונות עתידיות

- [ ] הורדות לא מקוון
- [ ] תמיכה ב-Stripe לתשלומים
- [ ] מערכת הערות
- [ ] צ'אט עם מרצים
- [ ] תעודות השלמה
- [ ] אנליטיקס מתקדם

## 🆘 פתרון בעיות

### בעיות נפוצות

1. **וידאו לא נטען**: בדוק חיבור לאינטרנט ו-URL חתום
2. **התקדמות לא נשמרת**: בדוק הרשאות RLS
3. **חידון לא עובד**: בדוק Edge Function

### לוגים

```bash
# לוגים של Supabase
supabase logs

# לוגים של האפליקציה
npx react-native log-android
npx react-native log-ios
```

## 📞 תמיכה

לשאלות ותמיכה:
- 📧 Email: support@example.com
- 💬 Discord: [קישור]
- 📖 Documentation: [קישור]

---

**נוצר על ידי**: צוות הפיתוח  
**תאריך**: 2024  
**גרסה**: 1.0.0

