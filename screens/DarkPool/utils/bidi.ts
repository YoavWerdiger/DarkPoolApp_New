import type { TextStyle, ViewStyle } from 'react-native';

const LRI = '\u2066';
const PDI = '\u2069';

export const hebrewText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'right',
};

export const dataText: TextStyle = {
  writingDirection: 'ltr',
  textAlign: 'left',
  fontVariant: ['tabular-nums'],
};

export const rowMixed: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
};

export function toDataIsland(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return `${LRI}${text}${PDI}`;
}
