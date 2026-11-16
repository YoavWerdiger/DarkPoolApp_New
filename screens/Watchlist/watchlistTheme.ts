import type { ViewStyle } from 'react-native';
import { APP_LAYOUT } from '../../components/ui/appLayout';

/** ריפוד אופקי זהה לכותרת ולשורות — ריפוד המסך (הרשימה פרוסה על כל המסך, בלי כרטיס) */
export const ROW_PAD_H = APP_LAYOUT.screenPaddingHorizontal;

/**
 * גריד RTL: סימבול → מחיר → שינוי → שינוי % → ווליום → גרירה
 * בשורה רק לוגו + טיקר (בלי שם חברה) — עמודת הסימבול ברוחב קבוע,
 * ועמודות המספרים מתחלקות בשאר הרוחב (המינימום = הרוחב הקודם) במקום רווח ריק ליד הטיקר.
 */
export const COL_WIDTH = {
  /** לוגו 28 + רווח + טיקר עד 5 תווים */
  symbol: 96,
  last: 58,
  chg: 52,
  chgPct: 54,
  vol: 44,
  drag: 28,
} as const;

export const colSymbol: ViewStyle = {
  width: COL_WIDTH.symbol,
  flexGrow: 0,
  flexShrink: 0,
  minWidth: 0,
  paddingLeft: 4,
  justifyContent: 'center',
};

const numCol = (minWidth: number, grow: number): ViewStyle => ({
  minWidth,
  flexGrow: grow,
  flexShrink: 1,
  flexBasis: minWidth,
  alignItems: 'flex-end',
  justifyContent: 'center',
});

export const colLast: ViewStyle = numCol(COL_WIDTH.last, 1.2);
export const colChg: ViewStyle = numCol(COL_WIDTH.chg, 1);
export const colChgPct: ViewStyle = numCol(COL_WIDTH.chgPct, 1);
export const colVol: ViewStyle = numCol(COL_WIDTH.vol, 1);

export const colDrag: ViewStyle = {
  width: COL_WIDTH.drag,
  flexGrow: 0,
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
};

export const quoteRow: ViewStyle = {
  flexDirection: 'row-reverse',
  flexWrap: 'nowrap',
  alignItems: 'center',
  width: '100%',
  alignSelf: 'stretch',
  paddingHorizontal: ROW_PAD_H,
};
