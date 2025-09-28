# מערכת המדיה של DarkPoolApp

## סקירה כללית
מערכת המדיה החדשה מאפשרת שליחה וקבלה של תמונות, וידאו, אודיו ומסמכים בצ'אט. המערכת משולבת לחלוטין עם Supabase ומשתמשת ב-React Native עם Tailwind CSS.

## רכיבים עיקריים

### 1. MediaService (`services/mediaService.ts`)
שירות מרכזי לניהול כל פעולות המדיה:
- **העלאת קבצים**: תמונות, וידאו, אודיו ומסמכים
- **בחירת מדיה**: גלריה, מצלמה, מסמכים
- **הקלטת אודיו**: הקלטה ישירה מהמיקרופון
- **דחיסה וטיפול**: אופטימיזציה אוטומטית של קבצים

### 2. MediaBubble (`components/chat/MediaBubble.tsx`)
רכיב לתצוגת מדיה בבועות הצ'אט:
- **תמונות**: תצוגה עם אפשרות זום
- **וידאו**: נגן מובנה עם כפתורי בקרה
- **אודיו**: נגן עם progress bar וויזואליזציה
- **מסמכים**: תצוגה עם מידע על הקובץ

### 3. MediaPicker (`components/chat/MediaPicker.tsx`)
ממשק בחירת מדיה משופר:
- **מצלמה**: צילום תמונות ווידאו
- **גלריה**: בחירה מרובה של תמונות/וידאו
- **מסמכים**: בחירת קבצי PDF, DOC וכו'
- **הקלטה**: הקלטת הודעות קוליות
- **מיקום**: שיתוף מיקום (בקרוב)
- **איש קשר**: שיתוף אנשי קשר (בקרוב)

### 4. MediaViewer (`components/chat/MediaViewer.tsx`)
תצוגה במסך מלא של מדיה:
- **תמונות**: זום, סיבוב, ניווט
- **וידאו**: נגן מלא עם פקדים
- **אודיו**: נגן מורחב עם seek
- **מסמכים**: תצוגה והורדה

## שימוש במערכת

### שליחת מדיה
```typescript
// בחירת תמונה מהגלריה
const imageUri = await MediaService.pickImage();
if (imageUri) {
  const { url, metadata } = await MediaService.uploadImage(chatId, imageUri);
  // שלח הודעה עם המדיה
}

// הקלטת אודיו
const audioUri = await MediaService.recordAudio();
if (audioUri) {
  const { url, metadata } = await MediaService.uploadAudio(chatId, audioUri);
  // שלח הודעת אודיו
}
```

### תצוגת מדיה בצ'אט
```typescript
// MediaBubble יוצג אוטומטית עבור הודעות מדיה
<ChatBubble
  message={message}
  isMe={isMe}
  onReply={handleReply}
/>
```

### פתיחת מדיה במסך מלא
```typescript
<MediaViewer
  visible={showViewer}
  media={selectedMedia}
  onClose={() => setShowViewer(false)}
  onShare={handleShare}
  onDownload={handleDownload}
/>
```

## מבנה נתונים

### MediaFile Interface
```typescript
interface MediaFile {
  id: string;
  message_id: string;
  sender_id: string;
  chat_id: string;
  media_type: 'image' | 'video' | 'audio' | 'document' | 'gif' | 'sticker';
  file_url: string;
  thumbnail_url?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  duration?: number;
  width?: number;
  height?: number;
  created_at: string;
}
```

### MediaMetadata Interface
```typescript
interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  thumbnail_url?: string;
}
```

## תמיכה בסוגי קבצים

### תמונות
- **פורמטים**: JPEG, PNG, WebP, GIF
- **גודל מקסימלי**: 10MB
- **דחיסה אוטומטית**: איכות 80%

### וידאו
- **פורמטים**: MP4, WebM, MOV
- **גודל מקסימלי**: 100MB
- **אורך מקסימלי**: 5 דקות
- **Thumbnail אוטומטי**: נוצר בעת העלאה

### אודיו
- **פורמטים**: MP3, AAC, WAV, OGG
- **גודל מקסימלי**: 25MB
- **אורך מקסימלי**: 10 דקות

### מסמכים
- **פורמטים**: PDF, DOC, DOCX, TXT, CSV, PPTX, XLSX
- **גודל מקסימלי**: 50MB
- **תצוגה**: תצוגה מקדימה או הורדה

## אבטחה ופרטיות

### הרשאות
- **מצלמה**: נדרשת הרשאת `CAMERA`
- **מיקרופון**: נדרשת הרשאת `RECORD_AUDIO`
- **גלריה**: נדרשת הרשאת `READ_EXTERNAL_STORAGE`

### אבטחת קבצים
- **URLs חתומים**: עם תאריך תפוגה
- **גישה מוגבלת**: רק למשתתפי הצ'אט
- **מחיקה אוטומטית**: קבצים ישנים נמחקים אוטומטית

## ביצועים ואופטימיזציה

### דחיסה
- **תמונות**: דחיסה אוטומטית ל-80% איכות
- **וידאו**: דחיסה ל-720p
- **אודיו**: דחיסה ל-128kbps

### Caching
- **Thumbnails**: נשמרים מקומית
- **קבצים תכופים**: נשמרים במטמון
- **טעינה הדרגתית**: תמונות נטענות בהדרגה

### Offline Support
- **הודעות**: נשמרות מקומית
- **מדיה**: נשמרת במטמון
- **סנכרון**: אוטומטי כשחוזרים לאינטרנט

## פתרון בעיות

### שגיאות נפוצות
1. **הרשאות**: ודאו שהאפליקציה קיבלה הרשאות מצלמה/מיקרופון
2. **גודל קובץ**: בדקו שהקובץ לא חורג מהגודל המקסימלי
3. **חיבור אינטרנט**: ודאו שיש חיבור יציב להעלאה

### לוגים
```typescript
// הפעלת לוגים מפורטים
console.log('Media upload started:', { chatId, mediaType });
console.log('Media upload completed:', { url, metadata });
console.log('Media upload failed:', { error });
```

## פיתוח עתידי

### תכונות מתוכננות
- [ ] **שיתוף מיקום**: עם מפות אינטראקטיביות
- [ ] **שיתוף אנשי קשר**: עם תצוגה מותאמת
- [ ] **Stickers**: חבילות מדבקות מותאמות אישית
- [ ] **GIFs**: תמיכה ב-GIPHY API
- [ ] **עריכה**: עריכת תמונות ווידאו בתוך האפליקציה

### שיפורי ביצועים
- [ ] **WebP אוטומטי**: המרה אוטומטית לתמונות WebP
- [ ] **Lazy Loading**: טעינה הדרגתית של מדיה
- [ ] **Background Upload**: העלאות ברקע
- [ ] **Compression**: דחיסה מתקדמת יותר

## תמיכה טכנית

### דרישות מערכת
- **iOS**: 13.0+
- **Android**: API 21+
- **Expo**: 53.0+

### תלויות
```json
{
  "expo-image-picker": "^16.1.4",
  "expo-document-picker": "^13.1.6",
  "expo-av": "^15.1.7",
  "expo-file-system": "^18.1.10"
}
```

### הגדרות נוספות
```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "האפליקציה מבקשת גישה לתמונות שלך",
          "cameraPermission": "האפליקציה מבקשת גישה למצלמה שלך"
        }
      ]
    ]
  }
}
```

## סיכום

מערכת המדיה החדשה מספקת חוויית משתמש מתקדמת עם:
- **תמיכה מלאה** בכל סוגי המדיה
- **ביצועים מיטביים** עם דחיסה וקאשינג
- **אבטחה גבוהה** עם URLs חתומים
- **ממשק משתמש מודרני** עם אנימציות חלקות
- **אינטגרציה מלאה** עם Supabase

המערכת מוכנה לשימוש מיידי וניתנת להרחבה עתידית בקלות.
