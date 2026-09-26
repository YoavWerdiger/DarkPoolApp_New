/**
 * מחוון שינוי P&L — נקודה צבעונית + מספר עם סימן.
 * ירוק/+ חיובי, אדום/− שלילי, נקודה מעומעמת באפס. בלי חצים.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useDesignTokens } from './DesignTokens';

export type ChangeTone = 'positive' | 'negative' | 'neutral';

/** נקודה מלאה 5–6pt — לא חץ ולא caret. */
export const CHANGE_DOT_SIZE = 6;

export function changeToneFromSigned(
  value: number | null | undefined
): ChangeTone {
  if (value == null || !Number.isFinite(value) || value === 0) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
}

export function changeToneColor(
  tone: ChangeTone,
  tokens: {
    colors: {
      primary: { main: string };
      text: { danger: string; tertiary: string };
    };
  }
): string {
  if (tone === 'positive') return tokens.colors.primary.main;
  if (tone === 'negative') return tokens.colors.text.danger;
  return tokens.colors.text.tertiary;
}

/** `+2.21%` / `−1.03%` / `0.00%` — בלי חץ. */
export function formatSignedChangePct(
  pct: number,
  digits = 2
): string {
  if (!Number.isFinite(pct) || pct === 0) return `${(0).toFixed(digits)}%`;
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

export function ChangeDot({
  tone,
  size = CHANGE_DOT_SIZE,
  color,
}: {
  tone: ChangeTone;
  size?: number;
  color?: string;
}) {
  const tokens = useDesignTokens();
  const fill = color ?? changeToneColor(tone, tokens);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fill,
        flexShrink: 0,
      }}
    />
  );
}

/** מספר בודד: `• +2.21%`. לזוג $ + % השתמשו ב-`SignedChangePair`. */
export function SignedChange({
  tone,
  value,
  children,
  style,
  textStyle,
  isolate,
  numberOfLines = 1,
}: {
  tone?: ChangeTone;
  value?: number | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  isolate?: (s: string) => string;
  numberOfLines?: number;
}) {
  const tokens = useDesignTokens();
  const resolved = tone ?? changeToneFromSigned(value);
  const color = changeToneColor(resolved, tokens);
  const text =
    typeof children === 'string' && isolate ? isolate(children) : children;

  return (
    <View style={[styles.row, style]}>
      <ChangeDot tone={resolved} />
      <Text
        style={[styles.text, { color }, textStyle]}
        numberOfLines={numberOfLines}
      >
        {text}
      </Text>
    </View>
  );
}

/** סדר קבוע: שינוי $ ואז נקודה ואז תשואה %. `+$1.06 • +2.21%` */
export function SignedChangePair({
  tone,
  value,
  absText,
  pctText,
  style,
  absTextStyle,
  pctTextStyle,
  textStyle,
  isolate,
}: {
  tone?: ChangeTone;
  value?: number | null;
  absText: string;
  pctText: string;
  style?: StyleProp<ViewStyle>;
  absTextStyle?: StyleProp<TextStyle>;
  pctTextStyle?: StyleProp<TextStyle>;
  textStyle?: StyleProp<TextStyle>;
  isolate?: (s: string) => string;
}) {
  const tokens = useDesignTokens();
  const resolved = tone ?? changeToneFromSigned(value);
  const color = changeToneColor(resolved, tokens);
  const abs = isolate ? isolate(absText) : absText;
  const pct = isolate ? isolate(pctText) : pctText;

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.text, { color }, textStyle, absTextStyle]} numberOfLines={1}>
        {abs}
      </Text>
      <ChangeDot tone={resolved} />
      <Text style={[styles.text, { color }, textStyle, pctTextStyle]} numberOfLines={1}>
        {pct}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  text: {
    direction: 'ltr',
    writingDirection: 'ltr',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
