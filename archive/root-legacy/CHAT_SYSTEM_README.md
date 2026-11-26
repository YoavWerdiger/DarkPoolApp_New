# 💬 מערכת צ'אט חדשה - DarkPool Chat System

## 📋 תיאור

מערכת צ'אט מלאה ומקצועית בסגנון WhatsApp, שנבנתה מאפס עבור אפליקציית DarkPool. המערכת כוללת קבוצות, הודעות Real-time, מדיה, ריאקציות ועוד.

---

## ✨ תכונות

### 🎯 תכונות עיקריות

- ✅ **קבוצות צ'אט** - יצירה וניהול של קבוצות ללא הגבלה
- ✅ **הודעות Real-time** - שליחה וקבלה בזמן אמת עם Supabase Realtime
- ✅ **מדיה מלאה** - תמיכה בתמונות, סרטונים, הודעות קוליות ומסמכים
- ✅ **ריאקציות** - לייק, אהבה, צחוק ועוד על הודעות
- ✅ **השבה (Reply)** - תשובה להודעות ספציפיות
- ✅ **העברה (Forward)** - העברת הודעות בין קבוצות
- ✅ **עריכה ומחיקה** - עריכת הודעות עד 48 שעות, מחיקה לכולם או רק לי
- ✅ **הודעות מועדפות (Starred)** - סימון הודעות חשובות
- ✅ **אינדיקטור "מקליד..."** - הצגה בזמן אמת של מי מקליד
- ✅ **סטטוס אונליין/אופליין** - מעקב אחר זמינות משתמשים
- ✅ **אישורי קריאה** - V אחד/כפול כמו WhatsApp
- ✅ **חיפוש** - חיפוש הודעות, קבוצות וחברים
- ✅ **ניהול קבוצות** - אדמינים, הוספת/הסרת חברים, הגדרות
- ✅ **הודעות מערכת** - הצטרפות, עזיבה, שינויים בקבוצה
- ✅ **Silent Messages** - שליחת הודעות ללא התראה
- ✅ **דיווח על הודעות** - Report למנהלים

---

## 🏗️ ארכיטקטורה

### 📁 מבנה הפרויקט

```
DarkPoolApp_New-1/
├── database/
│   └── chat_system_schema.sql          # סכמת מסד הנתונים
│
├── types/
│   └── chat.types.ts                   # TypeScript Types
│
├── services/chat/
│   ├── chatGroupService.ts             # ניהול קבוצות
│   ├── chatMessageService.ts           # ניהול הודעות
│   ├── chatMediaService.ts             # העלאת מדיה
│   ├── chatRealtimeService.ts          # Real-time
│   ├── chatSearchService.ts            # חיפוש
│   └── index.ts                        # Export כולל
│
├── context/
│   └── ChatContext.tsx                 # ניהול State גלובלי
│
├── components/chat/
│   ├── ChatMessage.tsx                 # קומפוננטת הודעה
│   ├── ChatInput.tsx                   # שדה הקלדה
│   ├── ChatGroupCard.tsx               # כרטיס קבוצה
│   └── ChatTypingIndicator.tsx         # "מקליד..."
│
└── screens/ChatNew/
    ├── ChatGroupsListScreen.tsx        # רשימת קבוצות
    ├── ChatGroupScreen.tsx             # מסך צ'אט
    └── ChatGroupInfoScreen.tsx         # פרטי קבוצה
```

---

## 🗄️ מסד נתונים

### טבלאות עיקריות

#### `chat_groups` - קבוצות
- שם, תיאור, אווטאר
- מונה חברים והודעות
- הגדרות (מי יכול לשלוח, להצטרף וכו')

#### `chat_group_members` - חברי קבוצה
- תפקיד (admin/member)
- הגדרות אישיות (השתקה, התראות)
- מעקב אחר קריאה (last_read_message_id, unread_count)

#### `chat_messages` - הודעות
- תוכן טקסט ומדיה
- סוג הודעה (text, image, video, audio, document, system)
- השבה והעברה
- תיוגים (@mentions)
- ריאקציות
- עריכה ומחיקה

#### `chat_message_reactions` - ריאקציות
#### `chat_starred_messages` - הודעות מועדפות
#### `chat_message_reads` - אישורי קריאה
#### `chat_typing_indicators` - מי מקליד
#### `chat_message_reports` - דיווחים

### פונקציות מיוחדות

- `get_chat_messages()` - קבלת הודעות עם כל הפרטים
- `search_chat_messages()` - חיפוש מתקדם בעברית
- טריגרים אוטומטיים לעדכון מונים

---

## 🚀 התקנה ושימוש

### 1️⃣ הרצת SQL במסד הנתונים

```bash
# הריצו את הקובץ ב-Supabase SQL Editor
cat database/chat_system_schema.sql | supabase db execute
```

או העתיקו את תוכן הקובץ לממשק הניהול של Supabase.

### 2️⃣ יצירת Storage Bucket

ב-Supabase Storage, צרו bucket בשם `chat-media` עם הגדרות:
- Public: ✅ (כדי שהקבצים יהיו נגישים)
- File Size Limit: 100MB

### 3️⃣ הוספת ChatProvider ל-App

```tsx
// App.tsx
import { ChatProvider } from './context/ChatContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ChatProvider>
          <NavigationContainer>
            {/* Routes */}
          </NavigationContainer>
        </ChatProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### 4️⃣ הוספת מסכים לניווט

```tsx
// navigation/MainNavigator.tsx
import ChatGroupsListScreen from '../screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from '../screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from '../screens/ChatNew/ChatGroupInfoScreen';

// בתוך Stack.Navigator:
<Stack.Screen name="ChatGroupsList" component={ChatGroupsListScreen} />
<Stack.Screen name="ChatGroup" component={ChatGroupScreen} />
<Stack.Screen name="ChatGroupInfo" component={ChatGroupInfoScreen} />
```

---

## 📱 שימוש בקוד

### דוגמה בסיסית - שליחת הודעה

```tsx
import { useChat } from '../context/ChatContext';

function MyComponent() {
  const { sendMessage } = useChat();

  const handleSend = async () => {
    await sendMessage({
      group_id: 'group-uuid',
      content: 'שלום עולם!',
      message_type: ChatMessageType.TEXT,
    });
  };

  return <Button onPress={handleSend} title="שלח" />;
}
```

### שימוש ישיר בשירותים

```tsx
import { chatGroupService } from '../services/chat';

// יצירת קבוצה
const { data: group } = await chatGroupService.createChatGroup({
  name: 'קבוצת המסחר שלנו',
  description: 'קבוצה לדיונים על מניות',
  member_ids: ['user1', 'user2'],
}, currentUserId);

// קבלת הודעות
const { data: messagesResponse } = await chatMessageService.getChatMessages(
  groupId,
  userId,
  { limit: 50, offset: 0 }
);

// העלאת תמונה
const { url } = await chatMediaService.uploadImage(
  imageUri,
  groupId
);
```

---

## 🎨 עיצוב

המערכת משתמשת ב-**DesignTokens** הקיימים באפליקציה:
- צבעים דינמיים (Light/Dark Mode)
- ללא מסגרות וצלליות
- עיצוב נקי ומודרני
- אנימציות חלקות

### התאמה אישית

כל הסטיילים ב-`createStyles(DesignTokens)` ניתנים לשינוי.

---

## 🔔 התראות Push

### הגדרה (TODO - לא מוטמע עדיין)

1. **Expo Notifications**
   ```bash
   npx expo install expo-notifications
   ```

2. **שירות התראות**
   - יצירת `chatNotificationService.ts`
   - הרשמה ל-Device Token
   - שליחת התראות דרך Supabase Edge Functions

3. **Edge Function**
   ```typescript
   // supabase/functions/send-chat-notification/index.ts
   import { createClient } from '@supabase/supabase-js'
   
   Deno.serve(async (req) => {
     const { message, group_id, user_id } = await req.json()
     
     // שליחת Push Notification
     // ...
   })
   ```

---

## 🧪 בדיקות

### בדיקות ידניות מומלצות

- [x] יצירת קבוצה חדשה
- [x] שליחת הודעת טקסט
- [x] שליחת תמונה
- [x] שליחת הודעה קולית
- [x] השבה להודעה
- [x] עריכת הודעה
- [x] מחיקת הודעה
- [x] הוספת ריאקציה
- [x] הוספת הודעה למועדפות
- [x] הקלדת טקסט ואינדיקטור "מקליד..."
- [x] אישורי קריאה (V V)
- [x] עזיבת קבוצה
- [x] הוספת חבר לקבוצה (אדמין)

### בדיקות Real-time

1. פתח את האפליקציה ב-2 מכשירים שונים
2. שלח הודעה ממכשיר אחד
3. ודא שהיא מתקבלת מיד במכשיר השני
4. בדוק אינדיקטור "מקליד..."
5. בדוק סטטוס אונליין/אופליין

---

## 🐛 בעיות נפוצות ופתרונות

### הודעות לא מגיעות בReal-time

**פתרון:**
```sql
-- ודא ש-Realtime מופעל על הטבלאות
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
```

### תמונות לא עולות

**בדוק:**
1. ש-Bucket `chat-media` קיים ב-Storage
2. שההרשאות נכונות (Public או RLS)
3. שה-Anon Key ב-`supabase.ts` תקף

### אינדיקטור "מקליד..." לא נעלם

**פתרון:**
```typescript
// ודא שפונקציית הניקוי רצה
chatRealtimeService.startTypingCleanup();
```

---

## 📈 ביצועים

### אופטימיזציות מובנות

- ✅ **Pagination** - טעינת הודעות בחלקים (50 בכל פעם)
- ✅ **Optimistic UI** - הצגת הודעות מיד לפני שליחה
- ✅ **Indexes** - על כל השדות החשובים ב-DB
- ✅ **Caching** - שמירת State ב-Context
- ✅ **Image Compression** - דחיסת תמונות לפני העלאה
- ✅ **Thumbnails** - יצירת תמונות ממוזערות

### המלצות נוספות

1. **Virtual List** - אם יש יותר מ-1000 הודעות, שקלו להשתמש ב-`@shopify/flash-list`
2. **Image Caching** - `react-native-fast-image` לתמונות
3. **Debounce** - על אינדיקטור ההקלדה

---

## 🔐 אבטחה

### הגנות מובנות

- ✅ **RLS (Row Level Security)** - על כל הטבלאות
- ✅ **Authentication** - רק משתמשים מחוברים יכולים לגשת
- ✅ **Authorization** - בדיקת הרשאות בכל פעולה
- ✅ **Input Validation** - בדיקת קלט בצד השרת
- ✅ **File Size Limits** - הגבלות על גודל קבצים
- ✅ **Content Type Validation** - בדיקת סוג קבצים

---

## 🚧 תכונות עתידיות (TODO)

- [ ] **צ'אטים פרטיים (1-on-1)** - בנוסף לקבוצות
- [ ] **הודעות נעלמות** - Disappearing Messages
- [ ] **הצפנה מקצה לקצה** - E2E Encryption
- [ ] **Video/Voice Calls** - שיחות וידאו/קול
- [ ] **סטיקרים ו-GIFs** - הוספת תמיכה
- [ ] **שיתוף מיקום** - Location Sharing
- [ ] **סטטוס Stories** - כמו WhatsApp Status
- [ ] **גיבוי והעברת צ'אטים** - Export/Import
- [ ] **בוטים** - Bot API למשימות אוטומטיות

---

## 📞 תמיכה

אם נתקלת בבעיות או שיש לך שאלות:

1. בדוק את ה-[בעיות נפוצות](#-בעיות-נפוצות-ופתרונות)
2. עיין ב-Console Logs (`console.log` ברחבי הקוד)
3. בדוק את Supabase Logs בממשק הניהול
4. פנה למפתח הראשי

---

## 📄 רישיון

מערכת זו היא חלק מאפליקציית DarkPool ומיועדת לשימוש פנימי בלבד.

---

## 🙏 תודות

נבנה עם:
- **React Native** - ממשק משתמש
- **Supabase** - Backend ו-Real-time
- **Expo** - פיתוח וניהול
- **TypeScript** - בטיחות טיפוסים
- **date-fns** - עבודה עם תאריכים

---

**גרסה:** 1.0.0  
**תאריך:** דצמבר 2024  
**סטטוס:** ✅ מוכן לפרודקשן

---

## 📊 סטטיסטיקות

- **שורות קוד:** ~5,000
- **קבצים:** 15+
- **טבלאות DB:** 8
- **שירותים:** 5
- **קומפוננטות:** 4+
- **מסכים:** 3

---

**🎉 מערכת הצ'אט מוכנה לשימוש! בהצלחה! 💪**









