import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';

/** תואם ללוגיקה ב־TradesListTab — קודם מהמסד, אחרת חישוב ממחירים */
export function resolveTradeReturnPercent(trade: {
  return_percentage?: number | null;
  entry_price: number;
  exit_price: number;
  direction: 'long' | 'short';
}): number {
  if (trade.return_percentage !== undefined && trade.return_percentage !== null) {
    const r = Number(trade.return_percentage);
    return Number.isFinite(r) ? r : 0;
  }
  const entry = Number(trade.entry_price);
  if (entry > 0) {
    const exit = Number(trade.exit_price);
    if (trade.direction === 'long') {
      return ((exit - entry) / entry) * 100;
    }
    return ((entry - exit) / entry) * 100;
  }
  return 0;
}

function normalizeTrade(raw: TradeMessageProps['trade']): TradeMessageProps['trade'] {
  return {
    ...raw,
    entry_price: Number(raw.entry_price),
    exit_price: Number(raw.exit_price),
    quantity: Number(raw.quantity),
    pnl: Number(raw.pnl),
    return_percentage:
      raw.return_percentage === undefined || raw.return_percentage === null
        ? undefined
        : Number(raw.return_percentage),
  };
}

interface TradeMessageProps {
  trade: {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    entry_price: number;
    exit_price: number;
    quantity: number;
    entry_date: string;
    exit_date: string;
    pnl: number;
    return_percentage?: number;
    notes?: string;
  };
  isMe: boolean;
  embeddedInBubble?: boolean;
}

function TradeSymbolLogo({
  symbol,
  size,
  fallbackColor,
  backgroundColor,
}: {
  symbol: string;
  size: number;
  fallbackColor: string;
  backgroundColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;
  const initials = symbol.trim().slice(0, 4).toUpperCase() || '—';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          recyclingKey={symbol}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            fontSize: Math.max(10, size * 0.26),
            fontWeight: '700',
            color: fallbackColor,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

/** תואם לכרטיס הקישור — רוחב קבוע: לבועה אין רוחב משלה */
const CARD_W = 264;

export default function TradeMessage({ trade: tradeRaw, isMe }: TradeMessageProps) {
  const tokens = useDesignTokens();
  const trade = useMemo(() => normalizeTrade(tradeRaw), [tradeRaw]);

  // צבעים מצבע הטקסט של הבועה — עובד בבועה שלי ושל אחר, בבהיר ובכהה
  const ink = isMe ? tokens.colors.bubbleMeText : tokens.colors.text.primary;
  const secondary = isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.secondary;
  const up = tokens.colors.primary.main;
  const down = tokens.colors.danger.main;

  const isLong = trade.direction === 'long';
  const returnPct = resolveTradeReturnPercent(trade);
  const positive = trade.pnl >= 0;
  const resultColor = positive ? up : down;

  const money = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  const date = (d: string) =>
    new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const metrics: Array<{ icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }> = [
    { icon: 'enter-outline', label: 'כניסה', value: money(trade.entry_price) },
    { icon: 'exit-outline', label: 'יציאה', value: money(trade.exit_price) },
    { icon: 'layers-outline', label: 'כמות', value: String(trade.quantity) },
    { icon: 'calendar-outline', label: 'נסגר', value: date(trade.exit_date) },
  ];

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: 0.06 }]} />

      {/* כותרת: לוגו + סימבול + כיוון | תשואה ורווח */}
      <View style={styles.header}>
        <TradeSymbolLogo
          symbol={trade.symbol}
          size={40}
          fallbackColor={ink}
          backgroundColor="rgba(127,127,127,0.18)"
        />
        <View style={styles.headerText}>
          <Text style={[styles.symbol, { color: ink }]} numberOfLines={1}>
            {trade.symbol}
          </Text>
          <View style={[styles.sideChip, { backgroundColor: isLong ? up : down }]}>
            <Ionicons name={isLong ? 'trending-up' : 'trending-down'} size={11} color="#FFFFFF" />
            <Text style={styles.sideText}>{isLong ? 'Long' : 'Short'}</Text>
          </View>
        </View>
        <View style={styles.result}>
          <Text style={[styles.resultPct, { color: resultColor }]}>
            {returnPct >= 0 ? '+' : ''}
            {returnPct.toFixed(2)}%
          </Text>
          <Text style={[styles.resultPnl, { color: resultColor }]}>{money(trade.pnl)}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: ink }]} />

      {/* 2×2: כניסה / יציאה / כמות / תאריך */}
      <View style={styles.grid}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metric}>
            <View style={styles.metricLabelRow}>
              <Ionicons name={m.icon} size={13} color={secondary} />
              <Text style={[styles.metricLabel, { color: secondary }]}>{m.label}</Text>
            </View>
            <Text style={[styles.metricValue, { color: ink }]} numberOfLines={1}>
              {m.value}
            </Text>
          </View>
        ))}
      </View>

      {trade.notes ? (
        <>
          <View style={[styles.divider, { backgroundColor: ink }]} />
          <View style={styles.notesRow}>
            <Ionicons name="chatbox-ellipses-outline" size={14} color={secondary} />
            <Text style={[styles.notes, { color: secondary }]} numberOfLines={4}>
              {trade.notes}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 2,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 4,
  },
  symbol: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'ltr',
  },
  sideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sideText: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  result: {
    alignItems: 'flex-start',
  },
  resultPct: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  resultPnl: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.18,
    marginHorizontal: 12,
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    rowGap: 10,
  },
  metric: {
    width: '50%',
    alignItems: 'flex-end',
    gap: 2,
  },
  metricLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: APP_TYPE.caption.fontWeight,
  },
  metricValue: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  notesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: {
    flex: 1,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
