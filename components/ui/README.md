# UI Kit - מערכת עיצוב אחידה

## 🎯 מטרה
מערכת עיצוב אחידה ומקצועית לכל האפליקציה, בהשפעת WhatsApp עם עיצוב מודרני וחדשני.

## 🧩 קומפוננטים זמינים

### UIButton
כפתור בסיסי עם וריאנטים שונים:
```tsx
import { UIButton } from '../ui';

// כפתור ראשי
<UIButton 
  title="שלח הודעה" 
  variant="primary" 
  onPress={handleSend} 
/>

// כפתור עם אייקון
<UIButton 
  title="מצלמה" 
  icon="camera" 
  variant="secondary" 
  onPress={openCamera} 
/>

// כפתור מעומעם
<UIButton 
  title="בטל" 
  variant="ghost" 
  onPress={onCancel} 
/>
```

### UIModal
מודל אחיד עם אנימציות:
```tsx
import { UIModal } from '../ui';

<UIModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  animationType="fade"
>
  <Text>תוכן המודל</Text>
</UIModal>
```

### UIBottomSheet
פאנל תחתון כמו WhatsApp:
```tsx
import { UIBottomSheet } from '../ui';

<UIBottomSheet
  visible={showSheet}
  onClose={() => setShowSheet(false)}
  dragToClose={true}
>
  <Text>תוכן הפאנל</Text>
</UIBottomSheet>
```

### UIAlert
התראה מותאמת אישית:
```tsx
import { UIAlert } from '../ui';

<UIAlert
  visible={showAlert}
  title="אישור מחיקה"
  message="האם אתה בטוח שברצונך למחוק?"
  type="warning"
  buttons={[
    { text: 'בטל', style: 'cancel' },
    { text: 'מחק', style: 'destructive', onPress: handleDelete }
  ]}
  onClose={() => setShowAlert(false)}
/>
```

### UICard
כרטיסייה לקבוצת תוכן:
```tsx
import { UICard } from '../ui';

<UICard variant="elevated" padding="lg">
  <Text>תוכן הכרטיסייה</Text>
</UICard>
```

### UIInput
שדה קלט מעוצב:
```tsx
import { UIInput } from '../ui';

<UIInput
  label="שם משתמש"
  placeholder="הזן שם משתמש"
  leftIcon="person"
  value={username}
  onChangeText={setUsername}
/>
```

## 🎨 Design Tokens
כל ערכי העיצוב מרוכזים ב-`DesignTokens.ts`:

```tsx
import DesignTokens from '../ui/DesignTokens';

const { colors, typography, spacing } = DesignTokens;

// שימוש בצבעים
backgroundColor: colors.primary
color: colors.textPrimary

// שימוש בטיפוגרפיה
fontSize: typography.fontSize.lg
fontWeight: typography.fontWeight.semibold

// שימוש במרווחים
padding: spacing.lg
margin: spacing.xl
```

## 🔄 החלפת קומפוננטים קיימים

### במקום Alert מערכת:
```tsx
// ❌ לפני
Alert.alert('שגיאה', 'משהו השתבש');

// ✅ אחרי
<UIAlert
  visible={showAlert}
  title="שגיאה"
  message="משהו השתבש"
  type="error"
  onClose={() => setShowAlert(false)}
/>
```

### במקום Modal רגיל:
```tsx
// ❌ לפני
<Modal visible={visible} animationType="slide">
  <View style={{ backgroundColor: '#1a1a1a', padding: 20 }}>
    {children}
  </View>
</Modal>

// ✅ אחרי
<UIModal visible={visible} animationType="slide">
  {children}
</UIModal>
```

### במקום Pressable עם עיצוב מותאם:
```tsx
// ❌ לפני
<Pressable 
  style={{ 
    backgroundColor: '#00D84A', 
    padding: 12, 
    borderRadius: 16 
  }}
  onPress={onPress}
>
  <Text style={{ color: '#000', textAlign: 'center' }}>
    לחץ כאן
  </Text>
</Pressable>

// ✅ אחרי
<UIButton 
  title="לחץ כאן" 
  variant="primary" 
  onPress={onPress} 
/>
```

## 🚀 יתרונות
- **עקביות** - כל הקומפוננטים עם אותו עיצוב
- **נגישות** - טיפול בנגישות בכל הקומפוננטים
- **ביצועים** - אנימציות מותאמות וחלקות
- **תחזוקה** - שינוי בעיצוב במקום אחד משפיע על הכל
- **מהירות פיתוח** - פחות קוד מותאם אישית

## 📱 WhatsApp Style
העיצוב מושפע מ-WhatsApp:
- צבעים כהים ומודרניים
- אנימציות חלקות
- Bottom Sheets עם גרירה
- כפתורים עגולים ונקיים
- טיפוגרפיה ברורה ונעימה

