import type { ViewStyle } from 'react-native';

/** ריפוד אופקי זהה לכותרת ולשורות */
export const ROW_PAD_H = 10;

/**
 * גריד RTL: סימבול → מחיר → שינוי → שינוי % → ווליום → גרירה
 */
export const COL_WIDTH = {
  last: 58,
  chg: 52,
  chgPct: 54,
  vol: 44,
  drag: 28,
} as const;

export const colSymbol: ViewStyle = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
  paddingLeft: 4,
  justifyContent: 'center',
};

export const colLast: ViewStyle = {
  width: COL_WIDTH.last,
  flexGrow: 0,
  flexShrink: 0,
  alignItems: 'flex-end',
  justifyContent: 'center',
};

export const colChg: ViewStyle = {
  width: COL_WIDTH.chg,
  flexGrow: 0,
  flexShrink: 0,
  alignItems: 'flex-end',
  justifyContent: 'center',
};

export const colChgPct: ViewStyle = {
  width: COL_WIDTH.chgPct,
  flexGrow: 0,
  flexShrink: 0,
  alignItems: 'flex-end',
  justifyContent: 'center',
};

export const colVol: ViewStyle = {
  width: COL_WIDTH.vol,
  flexGrow: 0,
  flexShrink: 0,
  alignItems: 'flex-end',
  justifyContent: 'center',
};

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
