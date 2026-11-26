import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../../lib/i18n';
import { useDesignTokens } from '../ui/useDesignTokens';

/**
 * Welcome screen's one rich moment: three dark-pool prints the way the app shows them.
 * Illustrative rows (not live data) — the newest one carries the accent.
 */
const PRINTS = [
  { ticker: 'NVDA', size: '1.2M', price: '142.30', time: '09:41' },
  { ticker: 'AAPL', size: '640K', price: '231.05', time: '09:38' },
  { ticker: 'TSLA', size: '890K', price: '338.12', time: '09:36' },
];

/** `rows`: how many prints to show — 3 on welcome, 1 on the sign-in form */
export function WelcomePrints({ rows = 3 }: { rows?: number }) {
  const { colors } = useDesignTokens();
  const accent = colors.text.accent;

  return (
    <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.border.divider }]}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.label, { color: colors.text.secondary }]}>
          {i18n.t('auto.screens__Auth__LoginScreen.printsLabel')}
        </Text>
      </View>

      {PRINTS.slice(0, rows).map((p, i) => {
        const newest = i === 0;
        return (
          <View
            key={p.ticker}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.divider },
            ]}
          >
            <Text style={[styles.ticker, { color: colors.text.primary }]}>{p.ticker}</Text>
            <Text style={[styles.num, styles.size, { color: colors.text.secondary }]}>{p.size}</Text>
            <Text style={[styles.num, styles.price, { color: newest ? accent : colors.text.primary }]}>${p.price}</Text>
            <Text style={[styles.num, styles.time, { color: colors.text.tertiary }]}>{p.time}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 13, fontWeight: '500' },
  // Tickers and figures read left-to-right in every language
  row: { flexDirection: 'row', alignItems: 'center', direction: 'ltr', paddingVertical: 12 },
  ticker: { fontSize: 15, fontWeight: '600', width: 64, textAlign: 'left' },
  num: { fontSize: 15, fontVariant: ['tabular-nums'], fontFamily: 'Menlo' },
  size: { flex: 1, textAlign: 'left' },
  price: { width: 92, textAlign: 'right' },
  time: { width: 56, textAlign: 'right', fontSize: 13 },
});
