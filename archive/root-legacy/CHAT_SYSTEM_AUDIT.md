# סריקה מקיפה – מערכת הצ'אטים

## 1. ביצועים (Performance)

### 1.1 FlatList ו־renderItem
- **`renderMessage` לא עטוף ב־`useCallback`** (`ChatGroupScreen.tsx` ~698)  
  הפונקציה נוצרת מחדש בכל רינדור, ולכן ה־FlatList עלול לחשב מחדש פריטים. **המלצה:** לעטוף ב־`useCallback` עם תלויות: `messages`, `user`, `highlightedMessageId`, `initialUnreadInfo`, וכל ה־handlers הרלוונטיים.
- **אין `getItemLayout`**  
  בלי זה ה־FlatList לא יודע גובה פריטים מראש, ופעולות כמו `scrollToIndex` דורשות חישוב. **המלצה:** אם גובה הודעות קבוע/מחושב (למשל לפי סוג הודעה), להוסיף `getItemLayout` לשיפור גלילה ו־scroll-to-message.
- **`maintainVisibleContentPosition`**  
  מוגדר – טוב ליציבות בעת הוספת הודעות מלמעלה (inverted list).
- **`initialNumToRender={15}`, `maxToRenderPerBatch={8}`, `windowSize={11}`**  
  מוגדרים – סביר. אפשר לנסות `windowSize={9}` אם יש הרבה הודעות כבדות (תמונות/וידאו).

### 1.2 Memo ב־ChatMessage
- **`ChatMessage` עטוף ב־`memo` עם custom comparator** – טוב.
- **חסר בהשוואה:** ב־comparator לא משווים `isHighlighted` (ושינוי ב־`onLongPress` וכו' לא משפיע על reference). highlight משתנה, ההודעה עלולה לא להתעדכן. **המלצה:** להוסיף `prevProps.isHighlighted === nextProps.isHighlighted` (ואם יש – גם השוואת פונקציות או יצירתן יציבה) כדי שה־highlight יתעדכן.

### 1.3 ChatInput
- **לא עטוף ב־`React.memo`**  
  כל רינדור של ה־Screen מרענן גם את ה־Input. **המלצה:** לעטוף ב־`memo` אם ה־props יציבים יחסית (למשל `onSendMessage` מ־useCallback).
- **`createStyles` ב־`useMemo`** – קיים, טוב.

### 1.4 ChatContext
- **עדכוני state גדולים**  
  `setMessages` עם מערך מלא על כל הודעה חדשה/עריכה עלול לגרום לרינדורים רבים. **המלצה:** לשקול עדכונים אינקרמנטליים (למשל merge לפי `id`) או שימוש ב־immer/מבנה שיאפשר עדכון ממוקד.
- **Realtime**  
  חיבור וניהול subscriptions נראים סבירים; לוודא ניקוי subscription ב־unmount.

---

## 2. נראות ו־UX

### 2.1 עקביות עיצוב
- **צבעים:** `COLORS` מוגדרים ב־`ChatGroupScreen`; ב־`ChatMessage` יש `MSG_COLORS` נפרד. **המלצה:** לרכז ב־DesignTokens או בקובץ צבעים אחד כדי למנוע חריגות.
- **סגנונות inline**  
  יש שימוש ב־`style={{ flex: 1 }}`, `paddingTop: 0` וכו' בתוך ה־JSX. **המלצה:** להעביר לסגנונות ב־StyleSheet (או ל־styles מוכנים) לשינוי קל ולעקביות.

### 2.2 ריווח וטקסט
- **Header**  
  לאחר השינויים האחרונים הריווח סביב השם וכמות החברים מאוזן; אם תרצה להקטין/להגדיל – לשנות רק את ה־padding/margin הרלוונטיים ב־styles של ה־header.
- **הודעות**  
  לוודא ש־line-height ו־font size אחידים בין הודעות טקסט, תמונה ומדיה אחרת.

### 2.3 נגישות
- **כפתורים ואייקונים**  
  לוודא שיש `accessibilityLabel` (ו־`accessibilityRole` במקום מתאים) לכפתורי חזרה, שליחה, תגובות, וכו'.
- **הודעות**  
  אפשר להוסיף `accessibilityLabel` שמסכם "הודעה מ־[שם], [תוכן מקוצר]".

---

## 3. אופטימיזציות מומלצות

### 3.1 עדיפות גבוהה
1. **`useCallback` ל־`renderMessage`**  
   עם תלויות מלאות כדי למנוע יצירת פונקציה חדשה בכל רינדור.
2. **תיקון ה־memo של `ChatMessage`**  
   לכלול `isHighlighted` (ו־props רלוונטיים נוספים) ב־comparator.
3. **הסרת/הקטנת `console.log`**  
   יש עשרות קריאות ב־ChatInput, ChatBubble, MediaPreviewModal וכו'. **המלצה:** להסיר או לעטוף ב־`__DEV__` כדי שלא יופעלו ב־production.

### 3.2 עדיפות בינונית
4. **`getItemLayout` ל־FlatList**  
   אם יש מודל גובה להודעה (למשל לפי סוג: טקסט/תמונה/קול), חישוב אופטימלי יזרז גלילה ו־scroll-to-message.
5. **טעינת תמונות**  
   לוודא ש־expo-image (או רכיב דומה) עם cache ו־placeholder משמש לתמונות בהודעות ובאווטארים – כבר בשימוש בחלק מהמקומות; להרחיב לכל מקום רלוונטי.
6. **ChatInput – memo**  
   לעטוף ב־`React.memo` אם ה־parent מרבה לרינדר (למשל בגלל הודעות/typing).

### 3.3 עדיפות נמוכה
7. **FlashList**  
   לשקול החלפת FlatList ב־FlashList (@shopify/flash-list) לרשימות ארוכות – שיפור FPS ברוב המקרים.
8. **ריכוז צבעים**  
   COLORS / MSG_COLORS → DesignTokens או קובץ משותף.
9. **Lazy load מודלים**  
   ReactionPicker, ForwardMessageModal וכו' – לטעון רק כשנפתחים (אם עדיין לא).

---

## 4. חלקות (Smoothness)

### 4.1 קיימים
- **Keyboard:** שימוש ב־`useReanimatedKeyboardAnimation` ו־`animatedContainerStyle` – סנכרון טוב עם המקלדת.
- **FlatList:** `removeClippedSubviews`, `scrollEventThrottle={100}`, `updateCellsBatchingPeriod={100}` – מתאימים לחלקות.

### 4.2 שיפורים אפשריים
- **אנימציות כניסה להודעה**  
  אפשר להוסיף אנימציית fade/slide קצרה ל־ChatMessage (למשל עם Reanimated או LayoutAnimation) כדי שההודעות לא "יקפצו".
- **צילום רשימה**  
  אם יש אפקטים כבדים (blur, shadow) על כל בועה – לשקול `renderToHardwareTextureAndroid` או הפחתת אפקטים על פריטים שלא בח viewport.

---

## 5. סיכום פעולות מומלצות (לפי סדר עדיפות)

| # | פעולה | קובץ/אזור | השפעה |
|---|--------|-----------|--------|
| 1 | עטיפת `renderMessage` ב־`useCallback` | ChatGroupScreen | ביצועים – פחות רינדורים מיותרים ב־FlatList |
| 2 | הוספת `isHighlighted` ל־memo comparator של ChatMessage | ChatMessage.tsx | תיקון – highlight יעבוד תמיד |
| 3 | הסרת/הגבלת console.log ל־__DEV__ | ChatInput, ChatBubble, ועוד | ביצועים + ניקיון |
| 4 | ריכוז צבעים (COLORS / MSG_COLORS) | DesignTokens או theme | עקביות נראות |
| 5 | הוספת `getItemLayout` (אם אפשרי) | ChatGroupScreen FlatList | גלילה ו־scroll-to-message חלקים יותר |
| 6 | `React.memo(ChatInput)` | ChatInput.tsx | פחות רינדורים ל־Input |
| 7 | העברת inline styles ל־StyleSheet | ChatGroupScreen (ועוד) | תחזוקה ועקביות |

אם תרצה, אפשר ליישם צעד־צעד את הפריטים 1–3 (useCallback ל־renderMessage, תיקון memo, והסרת logs) ישירות בקוד.

---

## 6. סקלביליות – ~1000 משתמשים, עשרות מקבילים

מטרה: תמיכה ב־**כ־1,000 משתמשים** רשומים, עם **עשרות משתמשים מקבילים** (20–50+ מחוברים ופעילים בו־זמנית).

### 6.1 קליינט (אפליקציה)

| נושא | סטטוס | המלצה |
|------|--------|--------|
| **ריענון רשימת הודעות** | `renderMessage` לא ב־useCallback | חובה: לעטוף ב־useCallback כדי להפחית רינדורים מיותרים כש־20+ מקבילים גוללים וכותבים. |
| **Virtualization** | FlatList עם initialNumToRender 15, windowSize 11 | טוב. לשקול FlashList אם רשימות הודעות ארוכות מאוד (מאות). |
| **מנוי Realtime** | מנוי ל־**כל** הודעות (`chat_messages` בלי פילטר) + סינון ב־JS לפי קבוצות המשתמש | עובד, אבל כל הודעה חדשה במערכת מגיעה לכל קליינט. עם עשרות מקבילים – עדיין סביר. עם מאות מקבילים – לשקול מעבר ל־channel per group או פילטר בצד שרת. |
| **מנוי לקבוצה הנוכחית** | `subscribeToGroup(groupId)` רק כשנכנסים לצ'אט | טוב – לא פותחים עשרות channels במקביל. |
| **Typing** | timeout 2 שניות; אין throttle על **שליחת** typing | מומלץ: להגביל שליחת "מקליד" ל־למשל פעם ב־1–2 שניות (throttle) כדי לא להציף כשהרבה מקבילים מקלידים. |
| **טעינת הודעות** | limit 50, pagination (loadMore) | טוב. לא לטעון יותר מ־50–100 הודעות בהתחלה. |
| **קבוצות** | טעינת כל הקבוצות של המשתמש | אם למשתמש יש עשרות קבוצות – לשקול pagination או lazy load לרשימת הקבוצות. |

### 6.2 שרת / Supabase

| נושא | סטטוס | המלצה |
|------|--------|--------|
| **Rate limit** | 30 הודעות/דקה, 10 מדיה/דקה (ב־chatValidation) | טוב. לוודא שהבדיקה רצה בצד שרת (RPC/Edge Function) ולא רק בקליינט, כדי שלא לעקוף. |
| **אינדקסים** | מוגדרים ב־`database/chat_system_schema.sql` | קיימים: `idx_chat_messages_group_id (group_id, created_at DESC)`, `idx_chat_group_members_user_id`, `idx_chat_group_members_group_id`. **לוודא** שהמיגרציה רצה ב־production. |
| **Realtime connections** | Supabase – תלוי בתוכנית | בתוכניות הסטנדרטיות יש מגבלת חיבורי Realtime (למשל 200–500). עם עשרות מקבילים – בדרך כלל בסדר. עם 100+ מקבילים – לבדוק את המגבלה ו־Realtime best practices. |
| **RLS** | יש policies | לוודא שאין שאילתות כבדות (למשל join מיותר) ב־policies של `chat_messages` ו־`chat_group_members`. |

### 6.3 Realtime – פירוט

- **`subscribeToAllUserGroups`:** channel אחד per user, מאזין ל־**כל** ה־INSERT ב־`chat_messages`. כל הודעה חדשה במערכת נשלחת לכל המנויים; כל קליינט מסנן לפי `userGroupsCache`. עם 30–50 מקבילים זה בדרך כלל מקובל. אם תגדילו ל־100+ מקבילים פעילים – לשקול:
  - מעבר ל־channel נפרד per group (יותר channels, פחות תעבורה לכל channel), או
  - שימוש ב־Supabase Realtime filters אם יתמכו ב־`group_id=in.(...)` וכד'.
- **ניקוי:** `unsubscribeAll()` ב־unmount – קיים. לוודא שאין דליפות (לא להשאיר channels פתוחים).

### 6.4 סיכום פעולות לסקלביליות (עשרות מקבילים)

1. **חובה (קליינט):** useCallback ל־`renderMessage`, תיקון memo ל־ChatMessage, הסרת/הגבלת console.log.
2. **מומלץ (קליינט):** Throttle לשליחת typing (למשל 1–2 שניות).
3. **חובה (DB):** לוודא אינדקסים על `chat_messages` (group_id, created_at) ו־`chat_group_members` (user_id, group_id).
4. **מומלץ (שרת):** Rate limit גם ב־RPC/Edge Function (לא רק בקליינט).
5. **מעקב:** עם גדילה ל־100+ מקבילים – למדוד עומס Realtime ולשקול פיצול מנויים (per group או פילטר בצד שרת).
