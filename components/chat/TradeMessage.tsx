import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';

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
}

function TradeMessage({ trade, isMe }: TradeMessageProps) {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens, isMe), [DesignTokens, isMe]);

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

  const isProfit = trade.pnl >= 0;
  const directionColor = trade.direction === 'long' 
    ? DesignTokens.colors.primary.main 
    : DesignTokens.colors.text.danger;

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.9}>
      <View style={styles.header}>
        <View style={styles.symbolContainer}>
          <Text style={styles.symbol}>{trade.symbol}</Text>
          <View style={[styles.directionBadge, { backgroundColor: `${directionColor}20` }]}>
            <Text style={[styles.directionText, { color: directionColor }]}>
              {trade.direction === 'long' ? 'Long' : 'Short'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.row}>
          <Text style={styles.label}>כניסה:</Text>
          <Text style={styles.price}>{formatCurrency(trade.entry_price)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>יציאה:</Text>
          <Text style={styles.price}>{formatCurrency(trade.exit_price)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>כמות:</Text>
          <Text style={styles.value}>{trade.quantity}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>תאריך:</Text>
          <Text style={styles.value}>{formatDate(trade.exit_date)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={[styles.pnlContainer, isProfit ? styles.pnlProfit : styles.pnlLoss]}>
            <Ionicons 
              name={isProfit ? 'trending-up' : 'trending-down'} 
              size={16} 
              color={isProfit ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger} 
            />
            <Text style={[
              styles.pnlText,
              isProfit ? styles.pnlTextProfit : styles.pnlTextLoss
            ]}>
              {formatCurrency(trade.pnl)}
            </Text>
          </View>
          {trade.return_percentage !== undefined && trade.return_percentage !== null && (
            <View style={[styles.returnContainer, isProfit ? styles.returnProfit : styles.returnLoss]}>
              <Text style={[
                styles.returnText,
                isProfit ? styles.returnTextProfit : styles.returnTextLoss
              ]}>
                {trade.return_percentage > 0 ? '+' : ''}{trade.return_percentage.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {trade.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText}>{trade.notes}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>, isMe: boolean) => StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    maxWidth: '85%',
    marginVertical: tokens.spacing.xs,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  symbolContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  symbol: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
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
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  price: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'right',
  },
  value: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'right',
  },
  footer: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  footerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  pnlProfit: {
    // Applied conditionally
  },
  pnlLoss: {
    // Applied conditionally
  },
  pnlText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  pnlTextProfit: {
    color: tokens.colors.primary.main,
  },
  pnlTextLoss: {
    color: tokens.colors.text.danger,
  },
  returnContainer: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
  },
  returnProfit: {
    backgroundColor: `${tokens.colors.primary.main}20`,
  },
  returnLoss: {
    backgroundColor: `${tokens.colors.text.danger}20`,
  },
  returnText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  returnTextProfit: {
    color: tokens.colors.primary.main,
  },
  returnTextLoss: {
    color: tokens.colors.text.danger,
  },
  notesContainer: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  notesText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
});

