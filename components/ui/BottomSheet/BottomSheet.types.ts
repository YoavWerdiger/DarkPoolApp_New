import { ReactNode } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[]; // e.g. [0.25, 0.5, 0.9] - יחס לגובה המסך
  /**
   * אינדקס בפתיחה לפי סדר `snapPoints` שסופק (לא אחרי מיון).
   * בלי זה נפתחים בסנאפ הגבוה ביותר — תאימות לשיטים הקיימים.
   */
  openSnapIndex?: number;
  /** סנאפ נשלט אחרי פתיחה (למשל הרחבת גלריה בלי לסגור את השיט). */
  snapIndex?: number;
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
  /** גרדיאנט מסך מותגי. ברירת מחדל: false (הכרום הגלובלי הוא זכוכית). */
  showBrandBackground?: boolean;
  /**
   * @deprecated הוסר — שור־דוב כבר לא ברקע. נשאר ל-API תאימות.
   */
  showBrandWatermark?: boolean;
  /** פינות עליונות של לוח השיט (ברירת מחדל מ־styles). למשל 28 כמו מודאל טופס */
  topCornerRadius?: number;
  /** כש־true: התוכן לא נמתח לגובה מלא — השיט מעוגן לתחתית בגובה snapPoints[0] */
  fitContent?: boolean;
  /**
   * @deprecated הוסר — שור־דוב כבר לא ברקע. נשאר ל-API תאימות.
   */
  brandWatermarkScale?: number;
  /** דריסת ריפוד תחתון לתוכן השיט (למשל 0 כשה-footer מטפל ב-safe area בעצמו) */
  contentPaddingBottom?: number;
  /**
   * מילוי אטום של לוח השיט. ברירת מחדל: `background.cardSolid`.
   * העבירו `background.primary` כשהשיט צריך את רקע המסך של ערכת הנושא.
   */
  backgroundColor?: string;
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






