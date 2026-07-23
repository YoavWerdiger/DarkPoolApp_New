import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useDesignTokens } from '../ui/DesignTokens';
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

export default function TradeMessage({ trade: tradeRaw, isMe, embeddedInBubble }: TradeMessageProps) {
  const DesignTokens = useDesignTokens();
  const lightOnBubble = !!embeddedInBubble && isMe;
  const styles = useMemo(
    () => createStyles(DesignTokens, !!embeddedInBubble, lightOnBubble),
    [DesignTokens, embeddedInBubble, lightOnBubble]
  );

  const trade = useMemo(() => normalizeTrade(tradeRaw), [tradeRaw]);

  const isProfit = trade.pnl >= 0;
  const directionColor = lightOnBubble
    ? trade.direction === 'long'
      ? '#A7F3A9'
      : '#FCA5A5'
    : trade.direction === 'long'
      ? DesignTokens.colors.primary.main
      : DesignTokens.colors.text.danger;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const returnPct = resolveTradeReturnPercent(trade);
  const pnlLabel = isProfit ? 'רווח נטו' : 'הפסד נטו';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{trade.symbol}</Text>
            <View style={[styles.directionBadge, { backgroundColor: `${directionColor}22` }]}>
              <Text style={[styles.directionText, { color: directionColor }]}>
                {trade.direction === 'long' ? 'Long' : 'Short'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.logoWrap}>
          <TradeSymbolLogo
            symbol={trade.symbol}
            size={44}
            fallbackColor={lightOnBubble ? '#FFFFFF' : DesignTokens.colors.text.primary}
            backgroundColor="rgba(255,255,255,0.1)"
          />
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.row}>
          <Text style={styles.label}>כניסה:{'\u00a0'}</Text>
          <Text style={styles.price}>{formatCurrency(trade.entry_price)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>יציאה:{'\u00a0'}</Text>
          <Text style={styles.price}>{formatCurrency(trade.exit_price)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>כמות:{'\u00a0'}</Text>
          <Text style={styles.value}>{trade.quantity}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>תאריך:{'\u00a0'}</Text>
          <Text style={styles.value}>{formatDate(trade.exit_date)}</Text>
        </View>

        {/* שורה אחת: רווח נטו: $X / הפסד נטו: $X — ערך מ־trade.pnl (מסד) */}
        <View style={styles.row}>
          <Text
            style={[
              styles.label,
              isProfit ? styles.labelProfit : styles.labelLoss,
            ]}
          >
            {pnlLabel}:{'\u00a0'}
          </Text>
          <Text
            style={[
              styles.emphasisValue,
              isProfit ? styles.valueProfit : styles.valueLoss,
            ]}
          >
            {formatCurrency(trade.pnl)}
          </Text>
        </View>

        {/* שורה נפרדת: תשואה: ±X% — קודם מ־return_percentage במסד, אחרת כמו ביומן */}
        <View style={styles.row}>
          <Text style={styles.label}>תשואה:{'\u00a0'}</Text>
          <Text
            style={[
              styles.emphasisValue,
              returnPct >= 0 ? styles.valueProfit : styles.valueLoss,
            ]}
          >
            {returnPct >= 0 ? '+' : ''}
            {returnPct.toFixed(2)}%
          </Text>
        </View>
      </View>

      {trade.notes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText}>{trade.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  embeddedInBubble: boolean,
  lightOnBubble: boolean,
) =>
  StyleSheet.create({
    container: embeddedInBubble
      ? {
          width: '100%',
          maxWidth: 300,
          alignSelf: 'stretch',
          paddingVertical: tokens.spacing.sm,
          paddingHorizontal: tokens.spacing.md,
          marginHorizontal: tokens.spacing.xs,
        }
      : {
          backgroundColor: tokens.colors.background.tertiary,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.lg,
          maxWidth: '90%',
          marginVertical: tokens.spacing.xs,
          marginHorizontal: tokens.spacing.sm,
          borderWidth: 1,
          borderColor: `${tokens.colors.primary.main}28`,
        },
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
      paddingBottom: tokens.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: lightOnBubble ? 'rgba(255,255,255,0.2)' : tokens.colors.border.primary,
    },
    logoWrap: {
      flexShrink: 0,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    symbolRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      flexWrap: 'wrap',
    },
    symbol: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      color: lightOnBubble ? '#FFFFFF' : tokens.colors.text.primary,
      textAlign: 'right',
    },
    directionBadge: {
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: 4,
      borderRadius: tokens.borderRadius.sm,
    },
    directionText: {
      fontSize: tokens.typography.fontSize.xs,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    details: {
      gap: tokens.spacing.sm,
    },
    row: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: tokens.spacing.md,
      width: '100%',
    },
    label: {
      fontSize: tokens.typography.fontSize.sm,
      color: lightOnBubble ? 'rgba(255,255,255,0.75)' : tokens.colors.text.secondary,
      textAlign: 'right',
      flexShrink: 0,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    labelProfit: {
      color: lightOnBubble ? 'rgba(255,255,255,0.9)' : tokens.colors.primary.main,
    },
    labelLoss: {
      color: lightOnBubble ? 'rgba(255,255,255,0.9)' : tokens.colors.text.danger,
    },
    price: {
      fontSize: tokens.typography.fontSize.sm,
      color: lightOnBubble ? '#FFFFFF' : tokens.colors.primary.main,
      fontWeight: tokens.typography.fontWeight.semibold,
      textAlign: 'left',
      writingDirection: 'ltr',
      flex: 1,
    },
    value: {
      fontSize: tokens.typography.fontSize.sm,
      color: lightOnBubble ? '#FFFFFF' : tokens.colors.text.primary,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'left',
      flex: 1,
    },
    emphasisValue: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
      textAlign: 'left',
      writingDirection: 'ltr',
      flex: 1,
    },
    valueProfit: {
      color: lightOnBubble ? '#86EFAC' : tokens.colors.primary.main,
    },
    valueLoss: {
      color: lightOnBubble ? '#FCA5A5' : tokens.colors.text.danger,
    },
    notesContainer: {
      marginTop: tokens.spacing.md,
      paddingTop: tokens.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: lightOnBubble ? 'rgba(255,255,255,0.2)' : tokens.colors.border.primary,
    },
    notesText: {
      fontSize: tokens.typography.fontSize.sm,
      color: lightOnBubble ? 'rgba(255,255,255,0.8)' : tokens.colors.text.secondary,
      fontStyle: 'italic',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
