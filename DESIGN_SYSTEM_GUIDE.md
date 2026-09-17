# מדריך שימוש - Design System של DarkPool

**גרסה:** 1.0  
**עודכן לאחרונה:** 11 בספטמבר 2026

---

## תוכן עניינים

1. [פילוסופיית העיצוב](#פילוסופיית-העיצוב)
2. [שימוש ב-Design Tokens](#שימוש-ב-design-tokens)
3. [קומפוננטות בסיס](#קומפוננטות-בסיס)
4. [דוגמאות מעשיות](#דוגמאות-מעשיות)
5. [Best Practices](#best-practices)
6. [שגיאות נפוצות](#שגיאות-נפוצות)

---

## פילוסופיית העיצוב

### Premium Minimal Fintech

DarkPool עוקבת אחר עיצוב **Apple/iOS-inspired** עם דגש על:

✅ **מינימליזם** - אלמנטים רק כשצריך  
✅ **היררכיה חזקה** - ברור מה חשוב  
✅ **איפוק בצבעים** - 90% נייטרלי, 8% אפור, 2% accent  
✅ **Soft dark mode** - רקע כהה עם glass effects עדינים  
✅ **Consistent spacing** - סקלה ברורה של מרווחים  
✅ **Minimal visual noise** - בלי גלואו/גרדיאנטים מיותרים

---

## שימוש ב-Design Tokens

### ייבוא והגדרה

```typescript
import { useDesignTokens } from '@/components/ui/DesignTokens';

function MyComponent() {
  const tokens = useDesignTokens();
  
  // עכשיו יש לך גישה לכל ה-tokens
  const styles = StyleSheet.create({
    container: {
      padding: tokens.spacing.lg,
      borderRadius: tokens.borderRadius.lg,
      backgroundColor: tokens.colors.background.card,
    }
  });
}
```

---

### Typography - מתי להשתמש בכל גודל

#### כותרות

```typescript
// Display (40px) - כותרת ראשית במסכי onboarding/landing
fontSize: tokens.typography.display.size
fontWeight: tokens.typography.display.weight

// Hero Title (34px) - כותרת hero של מסך
fontSize: tokens.typography.heroTitle.size
fontWeight: tokens.typography.heroTitle.weight

// Title (28px) - כותרת מסך ראשית
fontSize: tokens.typography.title.size
fontWeight: tokens.typography.title.weight

// Title2 (22px) - כותרת section
fontSize: tokens.typography.title2.size
fontWeight: tokens.typography.title2.weight

// Subtitle (18px) - תת-כותרת, כותרת כרטיס גדול
fontSize: tokens.typography.subtitle.size
fontWeight: tokens.typography.subtitle.weight
```

#### טקסט גוף

```typescript
// Body (16px) - טקסט רגיל, תוכן עיקרי
fontSize: tokens.typography.body.size
fontWeight: tokens.typography.body.weight

// Body Medium (16px) - דגש קל
fontSize: tokens.typography.bodyMedium.size
fontWeight: tokens.typography.bodyMedium.weight

// Callout (15px) - טקסט חשוב, הנחיות
fontSize: tokens.typography.callout.size
fontWeight: tokens.typography.callout.weight

// Subhead (14px) - טקסט משני, תוויות
fontSize: tokens.typography.subhead.size
fontWeight: tokens.typography.subhead.weight
```

#### טקסט קטן

```typescript
// Footnote (13px) - הערות שוליים, מטא-דטה
fontSize: tokens.typography.footnote.size
fontWeight: tokens.typography.footnote.weight

// Caption (12px) - תוויות קטנות, timestamps
fontSize: tokens.typography.caption.size
fontWeight: tokens.typography.caption.weight

// Caption2 (11px) - טקסט הקטן ביותר
fontSize: tokens.typography.caption2.size
fontWeight: tokens.typography.caption2.weight
```

#### כפתורים

```typescript
// Button (17px) - כפתורים גדולים
fontSize: tokens.typography.button.size
fontWeight: tokens.typography.button.weight

// Button Small (14px) - כפתורים קטנים
fontSize: tokens.typography.buttonSmall.size
fontWeight: tokens.typography.buttonSmall.weight
```

---

### Spacing - מתי להשתמש בכל ערך

```typescript
// 2xs (2px) - מרווח מיקרו בין badges/chips
marginRight: tokens.spacing['2xs']

// xs (4px) - בין אייקון לטקסט, מרווח מינימלי
gap: tokens.spacing.xs

// sm (8px) - בין אלמנטים קטנים בשורה
gap: tokens.spacing.sm

// md (12px) - מרווח סטנדרטי בין רכיבים
marginBottom: tokens.spacing.md

// base (16px) - מרווח בסיס, padding כרטיסים
padding: tokens.spacing.base

// lg (20px) - padding מסכים (screenPadding)
paddingHorizontal: tokens.spacing.lg

// xl (24px) - מרווח בין sections
marginTop: tokens.spacing.xl

// 2xl (32px) - מרווח גדול בין אזורים
paddingBottom: tokens.spacing['2xl']

// 3xl+ - למקרים מיוחדים בלבד
```

---

### Border Radius - מתי להשתמש בכל ערך

```typescript
// md (12px) - כרטיסים קטנים, inputs
borderRadius: tokens.borderRadius.md

// lg (16px) - **המומלץ לרוב הכרטיסים**
borderRadius: tokens.borderRadius.lg

// xl (20px) - כרטיסים בולטים
borderRadius: tokens.borderRadius.xl

// 2xl (24px) - כרטיסי hero, portrait cards
borderRadius: tokens.borderRadius['2xl']

// 3xl (30px) - כרטיסי feed, modals גדולים
borderRadius: tokens.borderRadius['3xl']

// full/button (9999) - כפתורים, pills, avatars
borderRadius: tokens.borderRadius.button
```

---

### Colors - הנחיות שימוש

#### רקעים

```typescript
// רקע מסך ראשי
backgroundColor: tokens.colors.background.primary

// רקע משני (cards, sections)
backgroundColor: tokens.colors.background.secondary

// כרטיסים עם glass effect
backgroundColor: tokens.colors.background.card

// כרטיסים אטומים
backgroundColor: tokens.colors.background.cardSolid
```

#### טקסט

```typescript
// טקסט ראשי (לבן מלא)
color: tokens.colors.text.primary

// טקסט משני (70% opacity)
color: tokens.colors.text.secondary

// טקסט שלישוני (45% opacity)
color: tokens.colors.text.tertiary

// טקסט muted (30% opacity)
color: tokens.colors.text.muted
```

#### Accent Colors - **להשתמש במשורה!**

```typescript
// ירוק - רק לפעולות buy/positive
color: tokens.colors.primary.main

// אדום - רק לפעולות sell/negative/errors
color: tokens.colors.text.danger

// כחול - info, קישורים
color: tokens.colors.accent.main
```

---

### Borders

```typescript
// בורדר דק סטנדרטי
borderWidth: 1
borderColor: tokens.colors.border.default

// בורדר עדין (glass effects)
borderColor: tokens.colors.border.subtle

// בורדר בולט
borderColor: tokens.colors.border.strong

// בורדר accent (ירוק)
borderColor: tokens.colors.border.accent
```

**חשוב:** לא יותר מבורדר אחד לאלמנט! אם צריך accent border, אל תוסיף glass border גם.

---

## קומפוננטות בסיס

### UICard

הקומפוננטה הבסיסית ביותר לכרטיסים:

```typescript
import UICard from '@/components/ui/UICard';

// כרטיס סטנדרטי
<UICard variant="elevated" padding="md">
  {children}
</UICard>

// כרטיס glass (blur effect)
<UICard variant="glass" glassIntensity="light" padding="lg">
  {children}
</UICard>

// כרטיס עם בורדר accent
<UICard variant="accent" padding="md">
  {children}
</UICard>
```

**Variants:**
- `elevated` - כרטיס אטום עם צל (ברירת מחדל)
- `glass` - כרטיס שקוף עם blur
- `outlined` - רק בורדר, ללא רקע
- `accent` - בורדר ירוק (לדגש)
- `surface` - רקע משני פשוט

**Glass Intensity:**
- `subtle` - blur עדין מאוד
- `light` - blur קל (מומלץ)
- `medium` - blur בינוני
- `strong` - blur חזק

---

### DarkPoolFeedCard

כרטיס ספציפי לפיד (עוטף את UICard):

```typescript
import { DarkPoolFeedCard } from '@/screens/DarkPool/components/DarkPoolFeedCard';

<DarkPoolFeedCard
  onPress={handlePress}
  accent={isHighlighted}  // בורדר ירוק לסיגנל חזק
>
  {content}
</DarkPoolFeedCard>
```

---

## דוגמאות מעשיות

### כרטיס עסקה בסיסי

```typescript
function TradeCard({ trade, onPress }: Props) {
  const tokens = useDesignTokens();
  
  const styles = StyleSheet.create({
    container: {
      padding: tokens.spacing.base,
      borderRadius: tokens.borderRadius.lg,
      backgroundColor: tokens.colors.background.card,
    },
    title: {
      fontSize: tokens.typography.subhead.size,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      marginTop: tokens.spacing.xs,
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
    },
  });
  
  return (
    <Pressable onPress={onPress}>
      <View style={styles.container}>
        <Text style={styles.title}>{trade.ticker}</Text>
        <Text style={styles.subtitle}>{trade.amount}</Text>
      </View>
    </Pressable>
  );
}
```

---

### גריד של כרטיסים

```typescript
<FlatList
  data={items}
  numColumns={2}
  columnWrapperStyle={{
    gap: tokens.spacing.md,
  }}
  contentContainerStyle={{
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  }}
  renderItem={({ item }) => <Card item={item} />}
/>
```

---

### שימוש ב-Glass Effect

```typescript
<UICard 
  variant="glass" 
  glassIntensity="light"
  padding="md"
  style={{
    borderRadius: tokens.borderRadius.xl,
    overflow: 'hidden',
  }}
>
  <LinearGradient
    colors={['transparent', 'rgba(0,0,0,0.6)']}
    style={styles.overlay}
  >
    <Text style={styles.text}>Content</Text>
  </LinearGradient>
</UICard>
```

---

## Best Practices

### ✅ עשה

1. **תמיד השתמש ב-useDesignTokens**
   ```typescript
   const tokens = useDesignTokens();
   fontSize: tokens.typography.body.size
   ```

2. **משפחת משקלים עקבית**
   ```typescript
   fontWeight: tokens.typography.fontWeight.bold  // ✅
   fontWeight: '700'  // ❌
   ```

3. **Spacing מהסקלה**
   ```typescript
   gap: tokens.spacing.md  // ✅
   gap: 12  // ❌
   ```

4. **BorderRadius מהסקלה**
   ```typescript
   borderRadius: tokens.borderRadius.lg  // ✅
   borderRadius: 16  // ❌
   ```

5. **RTL תמיד**
   ```typescript
   textAlign: 'right',
   writingDirection: 'rtl'
   ```

---

### ❌ אל תעשה

1. **לא להשתמש בהקסדצימלי ישירות**
   ```typescript
   color: '#FFFFFF'  // ❌
   color: tokens.colors.text.primary  // ✅
   ```

2. **לא ליצור ערכי spacing חדשים**
   ```typescript
   marginTop: 15  // ❌ - אין 15 בסקלה
   marginTop: tokens.spacing.base  // ✅
   ```

3. **לא להוסיף גרדיאנטים/glow למסכים רגילים**
   ```typescript
   // ❌ גרדיאנט RGB גנרי
   background: 'linear-gradient(45deg, #FF00FF, #00FFFF)'
   
   // ✅ glass effect עדין
   <UICard variant="glass" glassIntensity="light" />
   ```

4. **לא להשתמש ב-accent colors כרקע**
   ```typescript
   backgroundColor: tokens.colors.primary.main  // ❌ מסנוור
   borderColor: tokens.colors.primary.main  // ✅ עדין
   ```

5. **לא יותר מבורדר אחד**
   ```typescript
   // ❌
   <View style={{
     borderWidth: 1,
     borderColor: tokens.colors.border.default,
   }}>
     <View style={{
       borderWidth: 1,
       borderColor: tokens.colors.primary.main,
     }} />
   </View>
   
   // ✅
   <View style={{
     borderWidth: 1.5,
     borderColor: tokens.colors.primary.main,
   }} />
   ```

---

## שגיאות נפוצות

### 1. שכחתי להשתמש ב-useDesignTokens

**בעיה:**
```typescript
const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    color: '#FFFFFF',
  }
});
```

**פתרון:**
```typescript
function MyComponent() {
  const tokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    text: {
      fontSize: tokens.typography.body.size,
      color: tokens.colors.text.primary,
    }
  }), [tokens]);
}
```

---

### 2. השתמשתי בערכי spacing לא קיימים

**בעיה:**
```typescript
marginTop: 18  // אין 18 בסקלה
```

**פתרון:**
```typescript
marginTop: tokens.spacing.lg  // 20px - הקרוב ביותר
// או
marginTop: tokens.spacing.base  // 16px
```

---

### 3. יצרתי borderRadius מותאם אישית

**בעיה:**
```typescript
borderRadius: 36  // לא בסקלה!
```

**פתרון:**
```typescript
borderRadius: tokens.borderRadius['2xl']  // 24px
// או
borderRadius: tokens.borderRadius['3xl']  // 30px
```

---

### 4. שכחתי RTL

**בעיה:**
```typescript
<Text style={{ fontSize: 16, color: '#FFF' }}>
  שלום
</Text>
```

**פתרון:**
```typescript
<Text style={{
  fontSize: tokens.typography.body.size,
  color: tokens.colors.text.primary,
  textAlign: 'right',
  writingDirection: 'rtl',
}}>
  שלום
</Text>
```

**או להשתמש ב-helper:**
```typescript
import { darkPoolTextRtl } from '@/screens/DarkPool/darkPoolLayout';

<Text style={{
  ...darkPoolTextRtl,
  fontSize: tokens.typography.body.size,
  color: tokens.colors.text.primary,
}}>
  שלום
</Text>
```

---

## סיכום

**זכור תמיד:**

1. 🎨 **Premium Minimal Fintech** - פשוט, נקי, מעוצב
2. 📐 **השתמש ב-tokens** - לעולם לא hardcode
3. 🎯 **איפוק בצבעים** - accent רק כשצריך
4. 📏 **סקלה עקבית** - spacing, radius, typography
5. 🪟 **Glass effects עדינים** - לא glow/gradients מוגזמים
6. ✍️ **RTL תמיד** - עברית קודם

---

**לשאלות ובעיות:**  
עיין ב-`DESIGN_AUDIT_REPORT.md` ו-`DESIGN_CHANGES_LOG.md`

**עודכן:** 11 בספטמבר 2026
