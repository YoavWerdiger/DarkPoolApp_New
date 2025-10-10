# 💬 Message Grouping (הודעות מצומדות)

## מה זה? 🤔

בדיוק כמו בווטסאפ - כשמשתמש שולח כמה הודעות רצופות תוך פחות מ-2 דקות, הן מוצגות כ"קבוצה":
- רק ההודעה **האחרונה** בקבוצה מראה תמונת פרופיל
- ההודעות האחרות מוצמדות אליה **בלי** תמונת פרופיל
- הריווח בין הודעות בקבוצה **קטן יותר** (mb-1 במקום mb-3)

---

## איך זה עובד? ⚙️

### 1. חישוב Grouping

ב-`ChatRoomScreen.tsx`, כשמרנדרים הודעה:

```typescript
// בדוק אם ההודעה הבאה (בזמן) היא מאותו משתמש
const nextMessage = messagesWithDividers[nextIndex];
const timeDiff = Math.abs(
  new Date(currentMessage.created_at).getTime() - 
  new Date(nextMessage.created_at).getTime()
) / 1000 / 60; // בדקות

if (nextMessage.sender_id === currentMessage.sender_id && timeDiff < 2) {
  isGrouped = true;
}
```

### 2. Props שעוברים ל-ChatBubble

```typescript
<ChatBubble
  message={currentMessage}
  isGrouped={isGrouped}      // האם ההודעה חלק מקבוצה
  isGroupStart={isGroupStart}  // האם זו ההודעה הראשונה בקבוצה
  isGroupEnd={isGroupEnd}      // האם זו ההודעה האחרונה בקבוצה
/>
```

### 3. תצוגה ב-ChatBubble

```typescript
// ריווח מופחת בין הודעות בקבוצה
className={`w-full ${isGrouped && !isGroupEnd ? 'mb-1' : 'mb-3'}`}

// תמונת פרופיל רק בסוף הקבוצה
{!isMe && (
  <View style={{ width: 28 }}> 
    {(!isGrouped || isGroupEnd) && (
      <Image source={{ uri: profilePicture }} />
    )}
  </View>
)}
```

---

## דוגמה 📝

```
[10:00:00] יוסי: "היי"              ← isGroupStart=true, isGroupEnd=true (תמונה)
                                         mb-3 (ריווח רגיל)

[10:00:05] יוסי: "מה קורה?"          ← isGroupStart=true, isGroupEnd=false (ללא תמונה)
[10:00:10] יוסי: "אתה פה?"           ← isGrouped=true (ללא תמונה)
[10:00:15] יוסי: "עונה לי?"          ← isGroupEnd=true (עם תמונה!)
                                         mb-1 (ריווח קטן בין כולן)

[10:03:00] דנה: "כן אני כאן"         ← הודעה חדשה, mb-3 (ריווח רגיל)
```

---

## הגדרות ⚙️

### 1. זמן הקבוצה (כמה זמן בין הודעות)

ב-`ChatRoomScreen.tsx`, שורה ~1268:

```typescript
if (nextMessage.sender_id === currentMessage.sender_id && timeDiff < 2) {
  //                                                              ↑
  //                                                     שנה כאן (בדקות)
  isGrouped = true;
}
```

**אופציות:**
- `1` = דקה אחת (קפדני)
- `2` = שתי דקות (מומלץ - כמו ווטסאפ)
- `3` = 3 דקות (מתירני)
- `5` = 5 דקות (מאוד מתירני)

### 2. ריווח בין הודעות

ב-`ChatBubble.tsx`, שורה ~1239:

```typescript
className={`w-full ${isGrouped && !isGroupEnd ? 'mb-1' : 'mb-3'}`}
//                                                  ↑        ↑
//                                              קבוצה    רגיל
```

**אופציות:**
- `mb-0.5` = צמוד מאוד
- `mb-1` = צמוד (מומלץ)
- `mb-2` = קצת רווח
- `mb-3` = רווח רגיל (ברירת מחדל)

---

## הלוגיקה המלאה 🧠

### תנאים ל-Grouping:

1. ✅ **אותו משתמש**: `sender_id === sender_id`
2. ✅ **זמן קצר**: `timeDiff < 2 דקות`
3. ✅ **לא divider ביניהם**: הודעות רגילות בלבד

### תוצאות:

```typescript
isGroupStart = true  → יש הודעה אחריה מאותו משתמש
isGroupEnd = true    → יש הודעה לפניה מאותו משתמש
isGrouped = isGroupStart || isGroupEnd

// דוגמאות:
הודעה יחידה:     isGrouped=false
הודעה ראשונה:    isGroupStart=true, isGroupEnd=false
הודעה אמצעית:    isGroupStart=true, isGroupEnd=true
הודעה אחרונה:    isGroupStart=false, isGroupEnd=true
```

---

## למה שמרנו את הרוחב (width: 28)? 🤔

```typescript
<View style={{ width: 28 }}> 
  {(!isGrouped || isGroupEnd) && (
    <Image ... />
  )}
</View>
```

**ללא width קבוע:**
```
[תמונה] הודעה 1
        הודעה 2  ← זז ימינה!
        הודעה 3
[תמונה] הודעה 4
```

**עם width קבוע:**
```
[תמונה] הודעה 1
[      ] הודעה 2  ← ישר!
[      ] הודעה 3
[תמונה] הודעה 4
```

המרווח נשמר = הבועות מיושרות יפה!

---

## זהירות! ⚠️

### FlatList הפוך!

ה-FlatList הוא `inverted`, כך ש:
- `index 0` = **ההודעה החדשה ביותר** (למטה)
- `index + 1` = **הודעה ישנה יותר** (למעלה)

לכן:
```typescript
const nextIndex = index + 1;  // הודעה הבאה (למעלה בזמן)
const prevIndex = index - 1;  // הודעה קודמת (למטה בזמן)
```

---

## בדיקה 🧪

1. **פתח צ'אט**
2. **שלח 3 הודעות רצופות** (תוך פחות מ-2 דקות)
3. **בדוק:**
   - רק ההודעה האחרונה יש לה תמונת פרופיל ✅
   - ההודעות קרובות יותר (mb-1) ✅
   - יש מרווח (width: 28) שמיישר הכל ✅

4. **שלח הודעה אחרי 3 דקות**
5. **בדוק:**
   - יש ריווח גדול (mb-3) ✅
   - יש תמונת פרופיל ✅

---

## קבצים ששונו 📁

- ✅ `components/chat/ChatBubble.tsx` - הוספת props ותנאי תצוגה
- ✅ `screens/Chat/ChatRoomScreen.tsx` - חישוב grouping logic
- ✅ `MESSAGE_GROUPING_README.md` - המדריך הזה

---

**עכשיו יש לך הודעות מצומדות בדיוק כמו בווטסאפ!** 💬✨
