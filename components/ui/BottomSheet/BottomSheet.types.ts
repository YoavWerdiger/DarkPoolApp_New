import { ReactNode } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[]; // e.g. [0.25, 0.5, 0.9] - יחס לגובה המסך
  children?: ReactNode;
  showHandle?: boolean;
  /** צבע מילוי ל-handle (אופציונלי). ברירת מחדל: זכוכית שקופה מהסגנון הגלובלי. */
  handleColor?: string;
  enablePanDownToClose?: boolean;
  backdropOpacity?: number;
  onSnapPointChange?: (index: number) => void;
  useModal?: boolean; // אם false, render כ-View במקום Modal
  /** כש־true: אזור הגרירה צף מעל התוכן — התוכן מתחיל מקצה עליון השיט (למשל תמונה עד הקצה) */
  edgeToEdge?: boolean;
  /** גובה אזור הגסטרה הצף במצב edgeToEdge (בpx). מאפשר להגדיל את אזור הגרירה (למשל מעל תמונה שלמה). */
  dragAreaHeight?: number;
  /** גרדיאנט מסך + שור־דוב. ברירת מחדל: false (הכרום הגלובלי הוא זכוכית). */
  showBrandBackground?: boolean;
  /** שכבת שור־דוב בלבד — false = גרדיאנט בלי watermark. ברירת מחדל: כמו showBrandBackground */
  showBrandWatermark?: boolean;
  /** פינות עליונות של לוח השיט (ברירת מחדל מ־styles). למשל 28 כמו מודאל טופס */
  topCornerRadius?: number;
  /** כש־true: התוכן לא נמתח לגובה מלא — השיט מעוגן לתחתית בגובה snapPoints[0] */
  fitContent?: boolean;
  /** מכפיל גודל שור־דוב בשכבת sheetBottom (1 = רגיל) */
  brandWatermarkScale?: number;
  /** דריסת ריפוד תחתון לתוכן השיט (למשל 0 כשה-footer מטפל ב-safe area בעצמו) */
  contentPaddingBottom?: number;
  /**
   * ברירת מחדל: true. רקע זכוכית כהה כמו UICard / Action sheet —
   * BlurView (iOS) + overlay לבן עדין (`sheetGlass`). העברה false מחזירה
   * לרקע מותגי/משני. כשפעיל — `showBrandBackground` מתעלמים ממנו.
   */
  useGlassBackground?: boolean;
  /** עוצמת הטשטוש (0–100). ברירת מחדל: SHEET_GLASS_INTENSITY (UICard light). */
  glassIntensity?: number;
  /**
   * שכבת overlay עדינה מעל ה-BlurView.
   * ברירת מחדל: SHEET_GLASS_OVERLAY (UICard dark light — לבן עדין מעל Blur).
   */
  glassOverlayColor?: string;
  /**
   * כשtrue (וגם `useModal=true`): השיט יוזזו מעלה אוטומטית כשהמקלדת עולה,
   * כך שהכפתורים וה-input נשארים גלויים. מתאים ל-fitContent sheets עם TextInput.
   */
  avoidKeyboard?: boolean;
}






