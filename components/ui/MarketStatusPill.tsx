import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from './DesignTokens';
import { formatUntil, getMarketSession, type MarketPhase } from '../../utils/marketSession';

const SHORT: Record<MarketPhase, string> = { pre: 'Pre', open: 'פתוח', after: 'After', closed: 'סגור' };
const NEXT: Record<MarketPhase, string> = { pre: 'נפתח', open: 'נסגר', after: 'מסתיים', closed: 'Pre' };

/** חיווי מצב שוק לכותרות: נקודה + «פתוח · נסגר בעוד 2:15 שע׳» (שעון ניו יורק, מוצג בשעון ישראל). */
export default function MarketStatusPill({ compact = false }: { compact?: boolean }) {
  const tokens = useDesignTokens();
  const [s, setS] = useState(() => getMarketSession());
  useEffect(() => {
    const id = setInterval(() => setS(getMarketSession()), 30_000);
    return () => clearInterval(id);
  }, []);
  const c = tokens.colors;
  const color = s.phase === 'open' ? c.success.main : s.phase === 'closed' ? c.text.tertiary : c.warning?.main ?? c.text.secondary;
  return (
    <View
      style={[styles.pill, { backgroundColor: c.background.cardSolid }]}
      accessibilityLabel={`השוק ${SHORT[s.phase]}, ${NEXT[s.phase]} ${formatUntil(s.nextChangeAt - Date.now())}`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color: c.text.primary }]} numberOfLines={1}>
        {SHORT[s.phase]}
        {compact ? '' : ` · ${NEXT[s.phase]} ${formatUntil(s.nextChangeAt - Date.now())}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});
