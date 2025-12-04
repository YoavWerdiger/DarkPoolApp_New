# BottomSheet Component

Bottom Sheet מקצועי עם Reanimated + Gesture Handler, כולל תמיכה ב-snap points ואנימציות חלקות.

## תכונות

- ✅ **Snap Points** - תמיכה בנקודות סנאפ מרובות (0.25, 0.5, 0.9 וכו')
- ✅ **Spring Animation** - אנימציות חלקות עם spring physics
- ✅ **Pan Gesture** - גרירה למטה לסגירה או מעבר בין snap points
- ✅ **Backdrop** - רקע דימינג עם אנימציה
- ✅ **DesignTokens** - תמיכה מלאה ב-DesignTokens (Dark/Light mode)
- ✅ **Safe Area** - תמיכה ב-safe area insets
- ✅ **TypeScript** - טייפים מלאים

## שימוש בסיסי

```tsx
import BottomSheet from '@/components/ui/BottomSheet';
import { useState } from 'react';

const MyScreen = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button title="פתח Bottom Sheet" onPress={() => setIsOpen(true)} />
      
      <BottomSheet 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        snapPoints={[0.5, 0.9]}
      >
        <Text>תוכן ה-Bottom Sheet</Text>
      </BottomSheet>
    </>
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | האם ה-Bottom Sheet פתוח |
| `onClose` | `() => void` | - | Callback לסגירה |
| `snapPoints` | `number[]` | `[0.5]` | נקודות סנאפ (0-1, יחס לגובה המסך) |
| `children` | `ReactNode` | - | תוכן ה-Bottom Sheet |
| `showHandle` | `boolean` | `true` | האם להציג handle |
| `enablePanDownToClose` | `boolean` | `true` | האם לאפשר סגירה בגרירה למטה |
| `backdropOpacity` | `number` | `0.4` | שקיפות הרקע |
| `onSnapPointChange` | `(index: number) => void` | - | Callback כשמשתנה נקודת הסנאפ |

## דוגמאות

### Bottom Sheet עם מספר snap points

```tsx
<BottomSheet 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  snapPoints={[0.25, 0.5, 0.9]}
  onSnapPointChange={(index) => {
    console.log(`נקודת סנאפ: ${index}`);
  }}
>
  <Text>תוכן</Text>
</BottomSheet>
```

### Bottom Sheet ללא handle

```tsx
<BottomSheet 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  showHandle={false}
>
  <Text>תוכן</Text>
</BottomSheet>
```

### Bottom Sheet ללא סגירה בגרירה

```tsx
<BottomSheet 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  enablePanDownToClose={false}
>
  <Text>תוכן - לא ניתן לסגור בגרירה</Text>
</BottomSheet>
```

## מבנה קבצים

```
/components/ui/BottomSheet/
  ├── BottomSheet.tsx          # הקומפוננטה הראשית
  ├── BottomSheet.types.ts     # טייפים
  ├── BottomSheet.styles.ts    # סטיילים
  ├── index.ts                 # Export
  └── README.md                # תיעוד
```

## טכנולוגיות

- `react-native-reanimated` - אנימציות
- `react-native-gesture-handler` - מחוות
- `react-native-safe-area-context` - Safe area
- `DesignTokens` - עיצוב דינמי







