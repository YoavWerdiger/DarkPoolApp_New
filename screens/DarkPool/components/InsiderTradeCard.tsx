/**
 * InsiderTradeCard.tsx
 * -----------------------------------------------------------------------------
 * הכרטיס הראשי של "LATEST TRADES" — מציג רכישה/מכירה של בכיר מ-Form4Api
 * בסגנון InsiderWave, בשפה העיצובית של האפליקציה (UICard glass + RTL).
 *
 * מבנה (RTL):
 *   ┌──────────────────────────────────────────────┐
 *   │ ⊙ Avatar │ insider_name · לפני 1 ימים          │
 *   │          │ קנה 50 מניות NVDA ב-$198.87         │
 *   │  ┌────────────────────────────────────────┐  │
 *   │  │ logo │ NVDA          מחיר נוכחי        │  │
 *   │  │      │ NVIDIA Corp   $235.73           │  │
 *   │  │      │               Since +18.53%     │  │
 *   │  └────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────┘
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { formatRelativeTime } from '../utils/darkPoolFormat';
import type { InsiderTradeFeedItem } from '../utils/insiderFeedCalc';

interface InsiderTradeCardProps {
  item: InsiderTradeFeedItem;
  onPress?: (ticker: string) => void;
}

const TRANSACTION_LABEL: Record<string, string> = {
  P: 'רכש',
  S: 'מכר',
  A: 'קיבל',
  M: 'מימש',
  G: 'העניק',
  F: 'שילם מס',
  O: 'מימש אופציה',
  D: 'מימוש דיספוזיציה',
};

export function InsiderTradeCard({ item, onPress }: InsiderTradeCardProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { trade, quote, sinceTradePct } = item;

  const insiderInitials = useMemo(() => {
    const name = trade.insider_name?.trim() || '';
    if (!name) return '·';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [trade.insider_name]);

  const txLabel = TRANSACTION_LABEL[trade.transaction_type] || 'בוצעה עסקה';
  const sharesText = formatShares(trade.shares);
  const tradePriceText = `$${formatPriceShort(trade.price)}`;

  const sinceColor =
    sinceTradePct == null
      ? tokens.colors.text.tertiary
      : sinceTradePct >= 0
        ? tokens.colors.primary.main
        : tokens.colors.text.danger;
  const sinceText =
    sinceTradePct == null
      ? '—'
      : `${sinceTradePct >= 0 ? '+' : ''}${(sinceTradePct * 100).toFixed(2)}%`;
  const currentPriceText =
    quote?.price != null ? `$${formatPriceShort(quote.price)}` : '—';

  return (
    <Pressable
      onPress={() => onPress?.(trade.ticker)}
      style={styles.outer}
      accessibilityRole="button"
      accessibilityLabel={`${trade.insider_name || 'בכיר'} ${txLabel} ${sharesText} מניות ${trade.ticker}`}
    >
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{insiderInitials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.insiderName} numberOfLines={1}>
                {trade.insider_name || 'בכיר'}
              </Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.time}>
                {formatRelativeTime(trade.filed_at)}
              </Text>
            </View>
            <Text style={styles.description} numberOfLines={2}>
              <Text style={styles.descAction}>{txLabel} </Text>
              <Text style={styles.descShares}>{sharesText}</Text>
              <Text style={styles.descAction}> מניות </Text>
              <Text style={styles.descTicker}>{trade.ticker}</Text>
              <Text style={styles.descAction}> ב-</Text>
              <Text style={styles.descShares}>{tradePriceText}</Text>
              <Text style={styles.descAction}>/מניה</Text>
            </Text>
          </View>
        </View>

        <View style={styles.stockCard}>
          <View style={styles.stockLeft}>
            <TickerLogo symbol={trade.ticker} size={42} borderRadius={10} />
            <View style={styles.stockLabels}>
              <Text style={styles.stockTicker}>{trade.ticker}</Text>
              <Text style={styles.stockCompany} numberOfLines={1}>
                {sourceLabel(trade.source)}
              </Text>
            </View>
          </View>
          <View style={styles.stockRight}>
            <Text style={styles.priceLabel}>מחיר נוכחי</Text>
            <Text style={styles.priceValue}>{currentPriceText}</Text>
            <View style={styles.sinceRow}>
              <Ionicons
                name={
                  sinceTradePct == null
                    ? 'remove'
                    : sinceTradePct >= 0
                      ? 'trending-up'
                      : 'trending-down'
                }
                size={12}
                color={sinceColor}
              />
              <Text style={[styles.sinceText, { color: sinceColor }]}>
                Since {sinceText}
              </Text>
            </View>
          </View>
        </View>
      </UICard>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers (exported only as internal — used inside the component)
// ---------------------------------------------------------------------------

function formatShares(shares: number | null | undefined): string {
  if (shares == null || !Number.isFinite(shares)) return '—';
  const n = Math.abs(shares);
  if (n >= 1_000_000) return `${(shares / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return Number(shares).toLocaleString('en-US');
  return String(Math.round(shares));
}

function formatPriceShort(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Form 4';
  if (source === 'form4api') return 'Form 4 · Form4API';
  if (source === 'quiverquant') return 'Form 4 · Quiver';
  if (source === 'sec_direct') return 'Form 4 · SEC';
  return 'Form 4';
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    outer: { marginBottom: tokens.spacing.sm },
    card: {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      gap: tokens.spacing.sm,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: tokens.colors.primary.dim,
      borderWidth: 1,
      borderColor: tokens.colors.border.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '900',
      color: tokens.colors.primary.main,
      letterSpacing: 0.5,
    },
    headerInfo: { flex: 1, minWidth: 0 },
    nameRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
    },
    insiderName: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'rtl',
      textAlign: 'right',
      flexShrink: 1,
    },
    dot: {
      fontSize: 14,
      color: tokens.colors.text.tertiary,
    },
    time: {
      fontSize: 12,
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    description: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 19,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    descAction: { color: tokens.colors.text.secondary },
    descShares: {
      color: tokens.colors.text.primary,
      fontWeight: '800',
    },
    descTicker: {
      color: tokens.colors.text.primary,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    stockCard: {
      marginTop: tokens.spacing.sm,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: tokens.spacing.sm,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stockLeft: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    stockLabels: { flexShrink: 1, alignItems: 'flex-end' },
    stockTicker: {
      fontSize: 16,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
      writingDirection: 'ltr',
    },
    stockCompany: {
      marginTop: 2,
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    stockRight: {
      alignItems: 'flex-start',
      minWidth: 110,
    },
    priceLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
      letterSpacing: 0.5,
      textAlign: 'left',
    },
    priceValue: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
    },
    sinceRow: {
      marginTop: 4,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 4,
    },
    sinceText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
  });
}
