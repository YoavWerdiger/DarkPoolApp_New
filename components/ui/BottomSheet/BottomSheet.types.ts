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
  /** פינות עליונות של לוח השיט (ברירת מחדל מ־styles). למשל 28 כמו מודאל טופס */
  topCornerRadius?: number;
}






