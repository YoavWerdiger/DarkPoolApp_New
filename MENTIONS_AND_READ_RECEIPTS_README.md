# Mentions, Read Receipts ו-Day Dividers - הוראות התקנה

## סקירה כללית

הוספנו שלושה פיצ'רים חדשים לאפליקציית הצ'אט:

1. **Mentions** - הזכרת משתמשים עם @
2. **Read Receipts** - אישור קריאה של הודעות
3. **Day Dividers** - הפרדה בין ימים ברשימת ההודעות

## התקנה

### 1. הרצת SQL

הרץ את הקובץ `add_mentions_column.sql` במסד הנתונים שלך:

```sql
-- Add mentions column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS mentions JSONB NULL;

-- Add index for mentions column
CREATE INDEX IF NOT EXISTS idx_messages_mentions ON public.messages USING GIN (mentions);
```

### 2. התקנת חבילות

וודא שהחבילות הבאות מותקנות:

```bash
npm install date-fns
```

## פיצ'רים

### Mentions

- **הפעלה**: הקלד @ בטקסט כדי לפתוח את MentionPicker
- **בחירת משתמש**: בחר משתמש מהרשימה
- **הצגה**: הזכרות מוצגות עם רקע כחול, הזכרות של המשתמש הנוכחי מודגשות בירוק
- **שליחה**: הזכרות נשמרות עם טווחי טקסט מדויקים

### Read Receipts

- **הודעות אישיות**: ✓ = נשלח, ✓✓ = נקרא
- **קבוצות**: לחיצה ארוכה על ✓✓ מציגה "נראה על ידי X"
- **עדכון אוטומטי**: סטטוס מתעדכן בזמן אמת

### Day Dividers

- **הפרדה אוטומטית**: מופיע בין ימים שונים
- **תמיכה בעברית**: "היום", "אתמול", תאריכים מלאים
- **ביצועים**: מוזרקים לרשימה ללא השפעה על ביצועים

## קומפוננטות חדשות

### MentionPicker.tsx
- רשימת משתמשים עם חיפוש
- תמיכה ב-RTL
- עיצוב תואם לאפליקציה

### SeenBySheet.tsx
- רשימת קוראי הודעה
- תמונות פרופיל ושמות
- זמני קריאה יחסיים

### DayDivider.tsx
- הפרדה ויזואלית בין ימים
- תמיכה בעברית
- עיצוב מינימליסטי

## Hooks חדשים

### useMentions.ts
- ניהול הזכרות בטקסט
- טיפול במיקום הסמן
- עדכון אוטומטי של UI

## Utilities חדשים

### textRanges.ts
- חישוב טווחי טקסט
- מיזוג טווחים חופפים
- חילוץ קטעי טקסט

## שינויים בקומפוננטות קיימות

### MessageInputBar.tsx
- תמיכה בהזכרות
- MentionPicker מופעל אוטומטית
- שליחת הזכרות עם הודעות

### ChatBubble.tsx
- הצגת הזכרות עם הדגשה
- כפתורי read receipts
- תמיכה ב-SeenBySheet

### ChatRoomScreen.tsx
- Day Dividers מוזרקים אוטומטית
- טעינת חברי ערוץ ל-read receipts
- תמיכה בהזכרות

## בדיקות

### Mentions
- [ ] @ פותח MentionPicker
- [ ] בחירת משתמש מוסיפה הזכרה
- [ ] הזכרות נשמרות נכון
- [ ] הזכרות מוצגות עם הדגשה

### Read Receipts
- [ ] ✓ מופיע אחרי שליחה
- [ ] ✓✓ מופיע אחרי קריאה
- [ ] "נראה על ידי" עובד בקבוצות
- [ ] עדכונים בזמן אמת

### Day Dividers
- [ ] הפרדה בין ימים שונים
- [ ] תמיכה בעברית
- [ ] ביצועים טובים

## פתרון בעיות

### Mentions לא עובדות
- וודא שעמודת `mentions` נוספה למסד הנתונים
- בדוק שה-RLS policies מאפשרות כתיבה

### Read Receipts לא מתעדכנים
- וודא שה-Realtime subscriptions פעילים
- בדוק שה-`read_by` מעודכן נכון

### Day Dividers לא מופיעים
- וודא שה-`date-fns` מותקן
- בדוק שה-`messagesWithDividers` נוצר נכון

## תמיכה טכנית

אם יש בעיות, בדוק:
1. Console logs בקוד
2. Network requests ב-DevTools
3. מסד הנתונים ישירות
4. RLS policies

## עתיד

פיצ'רים עתידיים אפשריים:
- Push notifications להזכרות
- הזכרות מותאמות אישית
- סטטיסטיקות קריאה מתקדמות
- תמיכה בהזכרות של קבוצות
