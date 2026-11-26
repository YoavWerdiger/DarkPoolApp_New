# 🗳️ מערכת הסקרים - Polls System

## 📋 **מבט כללי**

מערכת הסקרים מאפשרת למשתמשים ליצור, להצביע ולצפות בתוצאות סקרים בצ'אטים. המערכת תומכת בבחירה יחידה ובחירה מרובה, עם ניהול הרשאות מתקדם.

## 🏗️ **ארכיטקטורה**

### **מסד הנתונים (Supabase)**

#### **טבלת `polls`**
```sql
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of {id, text, votes_count}
  multiple_choice BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **טבלת `poll_votes`**
```sql
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, user_id, option_id)
);
```

### **שירותי API (`PollService`)**

#### **פונקציות עיקריות:**
- `createPoll()` - יצירת סקר חדש
- `votePoll()` - הצבעה בסקר
- `getPollResults()` - קבלת תוצאות
- `lockPoll()` - נעילת סקר
- `deletePoll()` - מחיקת סקר
- `getChatPolls()` - קבלת כל הסקרים בצ'אט

## 🎨 **קומפוננטות React Native**

### **1. `PollCreationModal.tsx`**
- **תפקיד:** יצירת סקר חדש
- **תכונות:**
  - הזנת שאלה
  - הוספה/הסרה של אפשרויות (2-10)
  - בחירה בין Single/Multiple Choice
  - תצוגה מקדימה
  - ולידציה

### **2. `PollMessage.tsx`**
- **תפקיד:** הצגת הסקר בצ'אט
- **תכונות:**
  - הצגת שאלה ואפשרויות
  - הצבעה (radio/checkbox)
  - כפתורי ניהול (נעילה/מחיקה)
  - מעבר בין מצב הצבעה לתוצאות

### **3. `PollResults.tsx`**
- **תפקיד:** הצגת תוצאות הסקר
- **תכונות:**
  - Progress bars צבעוניים
  - אחוזי הצבעה
  - סימון בחירות המשתמש
  - זיהוי האפשרות הפופולרית ביותר

## 🔐 **מערכת הרשאות (RLS)**

### **מדיניות גישה:**
- **צפייה:** רק חברי הצ'אט
- **יצירה:** רק חברי הצ'אט
- **עריכה/מחיקה:** רק יוצר הסקר
- **הצבעה:** רק חברי הצ'אט (כל עוד הסקר לא נעול)

### **בדיקות אבטחה:**
- מניעת הצבעות כפולות
- בדיקת הרשאות לפני פעולות
- ולידציה של נתונים

## 🚀 **פיצ'רים מתקדמים**

### **בחירה מרובה:**
- תמיכה בבחירת מספר אפשרויות
- ולידציה לפי סוג הסקר
- תצוגה מותאמת (checkbox vs radio)

### **נעילת סקרים:**
- יוצר הסקר יכול לנעול אותו
- לאחר נעילה - אין הצבעות נוספות
- תצוגה ויזואלית של סטטוס נעול

### **תוצאות בזמן אמת:**
- עדכון מיידי של תוצאות
- חישוב אחוזים דינמי
- Progress bars צבעוניים לפי פופולריות

## 📱 **UX/UI Features**

### **תמיכה במובייל:**
- Modal ייעודי להצבעה
- KeyboardAvoidingView
- Touch interactions מותאמות
- Responsive design

### **תצוגה ויזואלית:**
- צבעים דינמיים לפי אחוזי הצבעה
- אייקונים מתאימים לכל מצב
- אנימציות ומעברים חלקים
- תמיכה בעברית (RTL)

## 🔧 **התקנה ושימוש**

### **1. הרצת SQL:**
```bash
# הרץ את הקובץ database_schema.sql
# זה ייצור את הטבלאות והמדיניות הנדרשות
```

### **2. הוספת קומפוננטות:**
```tsx
import PollCreationModal from './components/chat/PollCreationModal';
import PollMessage from './components/chat/PollMessage';
```

### **3. שימוש בשירות:**
```tsx
import { PollService } from './services/pollService';

// יצירת סקר
const poll = await PollService.createPoll(
  chatId,
  'מה דעתך על האפליקציה?',
  ['מעולה!', 'טובה', 'בסדר', 'לא טובה'],
  false // single choice
);

// הצבעה
await PollService.votePoll(poll.id, ['option_1'], userId);
```

## 📊 **דוגמאות שימוש**

### **יצירת סקר פשוט:**
```tsx
const [showPollModal, setShowPollModal] = useState(false);

<TouchableOpacity onPress={() => setShowPollModal(true)}>
  <Text>צור סקר חדש</Text>
</TouchableOpacity>

<PollCreationModal
  visible={showPollModal}
  onClose={() => setShowPollModal(false)}
  chatId={chatId}
  onPollCreated={(poll) => {
    console.log('Poll created:', poll);
    // הוסף למועדון הצ'אט
  }}
/>
```

### **הצגת סקר בצ'אט:**
```tsx
<PollMessage
  poll={pollData}
  chatId={chatId}
  onPollUpdated={(updatedPoll) => {
    // עדכן את הסקר בממשק
    setPoll(updatedPoll);
  }}
  isAdmin={isUserAdmin}
/>
```

## 🧪 **בדיקות ואיכות**

### **ולידציה:**
- בדיקת שאלה לא ריקה
- מינימום 2 אפשרויות
- מקסימום 10 אפשרויות
- בדיקת הרשאות לפני פעולות

### **טיפול בשגיאות:**
- הודעות שגיאה ברורות בעברית
- Fallback למצבים לא צפויים
- Logging מפורט לבדיקות

### **ביצועים:**
- Indexes על שדות מפתח
- עדכון מספרי הצבעות יעיל
- Caching של תוצאות

## 🔮 **פיתוחים עתידיים**

### **תכונות מתוכננות:**
- סקרים עם תמונות
- סקרים עם תאריכי תפוגה
- ניתוח מתקדם של תוצאות
- ייצוא נתונים ל-CSV/Excel
- אינטגרציה עם מערכת התראות

### **שיפורים טכניים:**
- Real-time updates עם WebSockets
- Offline support
- Analytics dashboard
- A/B testing framework

## 📚 **משאבים נוספים**

### **קישורים שימושיים:**
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Modals](https://reactnative.dev/docs/modal)
- [Tailwind CSS](https://tailwindcss.com/)

### **קובצי קוד:**
- `services/pollService.ts` - לוגיקת הסקרים
- `components/chat/PollCreationModal.tsx` - יצירת סקר
- `components/chat/PollMessage.tsx` - הצגת סקר
- `components/chat/PollResults.tsx` - תוצאות

---

**מפתח:** DarkPoolApp Team  
**תאריך:** 2024  
**גרסה:** 1.0.0
