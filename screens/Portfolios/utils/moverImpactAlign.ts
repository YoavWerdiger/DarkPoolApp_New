import type { TextStyle, ViewStyle } from 'react-native';
import { journalPhysicalRightText } from '../../Journal/journalLayout';

/**
 * שורת «השפעה על התיק» — טיקר / מחיר / תשואה חולקים את הקצה הימני.
 * עץ RTL + row (בלי row-reverse). עמודת הטקסט = תיבת LTR + textAlign right (כמו Explore).
 */
export const moverImpactRow: ViewStyle = {
  direction: 'rtl',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
};

export const moverImpactTextCol: ViewStyle = {
  flex: 1,
  minWidth: 0,
  direction: 'ltr',
  alignItems: 'stretch',
};

export const moverImpactTicker: TextStyle = {
  width: '100%',
  direction: 'ltr',
  writingDirection: 'ltr',
  textAlign: 'right',
};

export const moverImpactValueLine: TextStyle = {
  width: '100%',
  direction: 'ltr',
  writingDirection: 'ltr',
  textAlign: 'right',
};

export const moverImpactReturnLine: TextStyle = {
  width: '100%',
  ...journalPhysicalRightText,
};
