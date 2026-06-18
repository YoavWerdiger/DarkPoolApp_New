import type { ViewStyle } from 'react-native';

/**
 * מודול Dark Pool רץ תחת NavigationContainer ב-LTR (מגירה).
 * עוטף/סטיילים אלה מכריחים RTL כמו יומן מסחר / TradeListCard.
 */
export const darkPoolRtlRoot: ViewStyle = {
  flex: 1,
  direction: 'rtl',
};

export const darkPoolRtlContent: ViewStyle = {
  direction: 'rtl',
};

/** בשורה בתוך עץ RTL — השתמש ב-row (לא row-reverse). */
export const darkPoolRow: ViewStyle = {
  flexDirection: 'row',
};

/** טקסט עברי בתוך עץ RTL */
export const darkPoolTextRtl = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};
