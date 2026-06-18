import { ReactNode } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[]; // e.g. [0.25, 0.5, 0.9] - יחס לגובה המסך
  children?: ReactNode;
  showHandle?: boolean;
  enablePanDownToClose?: boolean;
  backdropOpacity?: number;
  onSnapPointChange?: (index: number) => void;
  useModal?: boolean; // אם false, render כ-View במקום Modal
  /** כש־true: אזור הגרירה צף מעל התוכן — התוכן מתחיל מקצה עליון השיט (למשל תמונה עד הקצה) */
  edgeToEdge?: boolean;
  /** גובה אזור הגסטרה הצף במצב edgeToEdge (בpx). מאפשר להגדיל את אזור הגרירה (למשל מעל תמונה שלמה). */
  dragAreaHeight?: number;
  /** גרדיאנט מסך + שור־דוב (כמו ChatSessionBackdrop). ברירת מחדל: true */
  showBrandBackground?: boolean;
  /** שכבת שור־דוב בלבד — false = גרדיאנט בלי watermark. ברירת מחדל: כמו showBrandBackground */
  showBrandWatermark?: boolean;
  /** פינות עליונות של לוח השיט (ברירת מחדל מ־styles). למשל 28 כמו מודאל טופס */
  topCornerRadius?: number;
  /** כש־true: התוכן לא נמתח לגובה מלא — מתאים לשיטים שגובהם נקבע לפי snapPoints מדודים */
  /** מכפיל גודל שור־דוב בשכבת sheetBottom (1 = רגיל) */
  brandWatermarkScale?: number;
  /** דריסת ריפוד תחתון לתוכן השיט (למשל 0 כשה-footer מטפל ב-safe area בעצמו) */
  contentPaddingBottom?: number;
}






