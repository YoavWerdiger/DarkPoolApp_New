# 🚀 התחלה מהירה - מערכת צ'אט

## צעדים ראשונים (5 דקות)

### 1️⃣ הרצת SQL במסד הנתונים

העתק והדבק את כל התוכן מהקובץ:
```
database/chat_system_schema.sql
```

לתוך **Supabase SQL Editor** והרץ.

זה ייצור:
- 8 טבלאות
- טריגרים אוטומטיים
- פונקציות מיוחדות
- RLS Policies
- Indexes

---

### 2️⃣ יצירת Storage Bucket

1. היכנס ל-**Supabase Dashboard**
2. לך ל-**Storage**
3. לחץ **New Bucket**
4. שם: `chat-media`
5. Public: ✅
6. שמור

---

### 3️⃣ הוספת Provider

ב-`App.tsx`:

```tsx
import { ChatProvider } from './context/ChatContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ChatProvider>  {/* הוסף כאן */}
          <NavigationContainer>
            {/* ... */}
          </NavigationContainer>
        </ChatProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

---

### 4️⃣ הוספת Routes

הוסף למסכים שלך:

```tsx
import ChatGroupsListScreen from './screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from './screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from './screens/ChatNew/ChatGroupInfoScreen';

// בתוך Navigator:
<Stack.Screen 
  name="ChatGroupsList" 
  component={ChatGroupsListScreen}
  options={{ title: 'קבוצות' }}
/>
<Stack.Screen 
  name="ChatGroup" 
  component={ChatGroupScreen}
  options={{ title: 'צ'אט' }}
/>
<Stack.Screen 
  name="ChatGroupInfo" 
  component={ChatGroupInfoScreen}
  options={{ title: 'פרטי קבוצה' }}
/>
```

---

### 5️⃣ בדיקה ראשונית

1. הרץ את האפליקציה
2. נווט ל-`ChatGroupsList`
3. צור קבוצה חדשה
4. שלח הודעה
5. בדוק ש-Real-time עובד!

---

## 🎯 שימוש בסיסי

### יצירת קבוצה

```tsx
import { useChat } from '../context/ChatContext';

function CreateGroupButton() {
  const { createGroup } = useChat();

  const handleCreate = async () => {
    const { success, groupId } = await createGroup({
      name: 'קבוצה חדשה',
      description: 'תיאור',
      member_ids: ['user1', 'user2'],
    });

    if (success) {
      console.log('קבוצה נוצרה:', groupId);
    }
  };

  return <Button onPress={handleCreate} title="צור קבוצה" />;
}
```

### שליחת הודעה

```tsx
const { sendMessage } = useChat();

await sendMessage({
  group_id: 'group-id',
  content: 'הודעה',
  message_type: ChatMessageType.TEXT,
});
```

### העלאת תמונה

```tsx
const { sendMessage } = useChat();
const { uploadImage } = chatMediaService;

const { url } = await uploadImage(imageUri, groupId);

await sendMessage({
  group_id: groupId,
  content: '',
  message_type: ChatMessageType.IMAGE,
  media_url: url,
});
```

---

## ✅ סיימת!

עכשיו יש לך מערכת צ'אט מלאה ומקצועית! 🎉

למידע מפורט: `CHAT_SYSTEM_README.md`









