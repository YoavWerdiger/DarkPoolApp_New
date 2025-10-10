# ✍️ מדריך Typing Indicator ("מקליד...")

## מה זה? 🤔

פיצ'ר "מקליד..." בדיוק כמו בווטסאפ - כשמישהו מקליד בצ'אט, זה מופיע בheader של הקבוצה במקום כמות המשתתפים.

---

## איך זה עובד? ⚙️

### 1. **Typing Service** (`services/typingService.ts`)
- משתמש ב-**Supabase Presence API** לסנכרון בזמן אמת
- כל משתמש שמקליד שולח presence update
- כל המשתמשים האחרים מקבלים את העדכון בזמן אמת

### 2. **Chat Context** (`context/ChatContext.tsx`)
- מנהל את רשימת המשתמשים שמקלידים (`typingUsers`)
- מספק פונקציות `startTyping()` ו-`stopTyping()`
- מאזין לשינויים דרך `TypingService`

### 3. **Message Input Bar** (`components/chat/MessageInputBar.tsx`)
- מזהה כשמשתמש מתחיל להקליד
- קורא ל-`startTyping()` כשמתחילים
- קורא ל-`stopTyping()` כשמפסיקים או שולחים הודעה
- timeout אוטומטי של 3 שניות אם לא מקלידים

### 4. **Chat Room Screen** (`screens/Chat/ChatRoomScreen.tsx`)
- מציג את המשתמשים שמקלידים ב-header
- משנה צבע ל-ירוק (#00E654) כשמישהו מקליד
- טקסטים שונים לפי מספר המקלידים:
  - 1 משתמש: "יוסי מקליד..."
  - 2 משתמשים: "יוסי ו-דנה מקלידים..."
  - 3+: "3 משתמשים מקלידים..."

---

## איך להשתמש? 🎮

זה אוטומטי לגמרי! פשוט תתחיל להקליד והמשתמשים האחרים יראו את זה.

---

## מה קורה "מתחת למכסה"? 🔧

### זרימת המידע:

```
1. משתמש מתחיל להקליד
   ↓
2. MessageInputBar קורא ל-startTyping()
   ↓
3. ChatContext קורא ל-TypingService.startTyping()
   ↓
4. TypingService שולח presence update ל-Supabase
   ↓
5. Supabase מפיץ את העדכון לכל המשתמשים האחרים
   ↓
6. TypingService מקבל את העדכון
   ↓
7. ChatContext מעדכן את typingUsers
   ↓
8. ChatRoomScreen מציג "מקליד..." בheader
```

### Timeout אוטומטי:

```javascript
// אחרי 3 שניות בלי הקלדה, הסטטוס מתאפס אוטומטית
setTimeout(() => {
  this.stopTyping(channelId, userId);
}, 3000);
```

---

## הגדרות והתאמות ⚙️

### שינוי זמן ה-Timeout:

ב-`services/typingService.ts`, שורה ~96:

```typescript
// שנה מ-3000 לזמן אחר (במילישניות)
const timeout = setTimeout(() => {
  this.stopTyping(channelId, userId);
}, 3000); // <-- שנה כאן
```

### שינוי טקסט התצוגה:

ב-`screens/Chat/ChatRoomScreen.tsx`, שורות ~1047-1054:

```typescript
{typingUsers.length > 0 
  ? typingUsers.length === 1
    ? `${typingUsers[0].userName} מקליד...` // <-- שנה כאן
    : typingUsers.length === 2
      ? `${typingUsers[0].userName} ו-${typingUsers[1].userName} מקלידים...` // <-- וכאן
      : `${typingUsers.length} משתמשים מקלידים...` // <-- וכאן
  : (currentChat?.description || `${membersCount ?? 0} משתתפים`)
}
```

### שינוי צבע:

ב-`screens/Chat/ChatRoomScreen.tsx`, שורה ~1045:

```typescript
color: typingUsers.length > 0 ? '#00E654' : '#ccc',
//                                 ^^^^^^^^ <-- שנה כאן
```

---

## דיבוג 🐛

### לוגים לבדיקה:

```
✍️ MessageInputBar: User started typing
✍️ ChatContext: User started typing
👀 TypingService: Subscribing to typing events
✅ TypingService: Successfully subscribed
✍️ TypingService: User started typing
👥 TypingService: Presence synced
✍️ ChatContext: Typing users updated: [...]
```

### אם זה לא עובד:

1. **בדוק את הקונסול** - צריך לראות את הלוגים למעלה
2. **ודא שהמשתמש יש לו full_name** ב-DB
3. **בדוק ש-Presence מופעל** ב-Supabase
4. **נסה לאתחל את האפליקציה**

---

## ביצועים 🚀

- **קל מאוד על הרשת** - רק presence updates קטנים
- **ללא polling** - רק real-time events
- **Timeout אוטומטי** - לא נשארים "מקלידים" לנצח
- **מינימום טראפיק** - רק כשבאמת מקלידים

---

## קבצים שנוספו/שונו 📁

### נוספו:
- ✅ `services/typingService.ts` - השירות הראשי
- ✅ `TYPING_INDICATOR_README.md` - המדריך הזה

### שונו:
- ✅ `context/ChatContext.tsx` - הוספת typing state ופונקציות
- ✅ `components/chat/MessageInputBar.tsx` - הוספת startTyping/stopTyping
- ✅ `screens/Chat/ChatRoomScreen.tsx` - תצוגת "מקליד..." בheader

---

## תודה! 🎉

עכשיו יש לך פיצ'ר "מקליד..." בדיוק כמו בווטסאפ!

תהנה! 😊

