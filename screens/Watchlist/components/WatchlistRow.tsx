import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { WatchlistRowData } from '../../../services/watchlist/watchlistTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  colChg,
  colChgPct,
  colDrag,
  colLast,
  colSymbol,
  colVol,
  quoteRow,
} from '../watchlistTheme';

type Props = {
  row: WatchlistRowData;
  index: number;
  onPress?: () => void;
  onDrag?: () => void;
  isActive?: boolean;
};

function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function formatSigned(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}`;
}

function formatVolume(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function WatchlistRowInner({ row, index, onPress, onDrag, isActive }: Props) {
  const tokens = useDesignTokens();
  const symbol = row?.item?.symbol ?? '';
  const company = row?.item?.company_name?.trim() || '';
  const hasAlert = !!row?.item?.alerts_enabled;
  const up = (row?.changePct ?? 0) > 0.005;
  const down = (row?.changePct ?? 0) < -0.005;
  const tone = up
    ? tokens.colors.primary.main
    : down
      ? tokens.colors.text.danger
      : tokens.colors.text.tertiary;

  const handlePress = useCallback(() => {
    if (isActive) return;
    void HapticFeedback.selection();
    onPress?.();
  }, [isActive, onPress]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // View = מיכל ה-flex (לא Pressable) — אותן עמודות כמו הכותרת
        row: {
          ...quoteRow,
          paddingVertical: 8,
          minHeight: 48,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        rowActive: {
          backgroundColor: 'rgba(0,200,5,0.08)',
          borderRadius: 10,
        },
        rowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
        identity: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          flex: 1,
        },
        logoWrap: {
          width: 30,
          height: 30,
          position: 'relative',
        },
        alertBadge: {
          position: 'absolute',
          left: -3,
          bottom: -3,
          width: 16,
          height: 16,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.primary.main,
          borderWidth: 1.5,
          borderColor: '#0A0E0A',
          zIndex: 2,
        },
        textBlock: {
          flexShrink: 1,
          minWidth: 0,
          gap: 1,
          alignItems: 'flex-end',
        },
        symbol: {
          color: tokens.colors.text.primary,
          fontSize: 14,
          fontWeight: '700',
          letterSpacing: 0.15,
          textAlign: 'right',
        },
        company: {
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          fontWeight: '500',
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        cellHit: {
          width: '100%',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minHeight: 32,
        },
        num: {
          fontSize: 13,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
          color: tokens.colors.text.primary,
        },
        chg: {
          fontSize: 12,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        },
        pct: {
          fontSize: 12,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        },
        vol: {
          fontSize: 11,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
          color: tokens.colors.text.secondary,
        },
        dragHit: {
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 32,
        },
      }),
    [tokens]
  );

  if (!symbol) return null;

  return (
    <View
      style={[
        styles.row,
        index % 2 === 1 && !isActive && styles.rowAlt,
        isActive && styles.rowActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${symbol} ${company} ${formatPrice(row.price)} ${formatSigned(row.change)} ${formatSigned(row.changePct)}%${hasAlert ? ' עם התראה' : ''}`}
    >
      <View style={colSymbol}>
        <Pressable
          onPress={handlePress}
          style={styles.identity}
          accessibilityRole="button"
          accessibilityLabel={symbol}
        >
          <View style={styles.logoWrap}>
            <TickerLogo symbol={symbol} size={30} />
            {hasAlert ? (
              <View style={styles.alertBadge} accessibilityLabel="התראה פעילה">
                <Ionicons name="notifications" size={9} color="#041204" />
              </View>
            ) : null}
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.symbol} numberOfLines={1}>
              {symbol}
            </Text>
            {company ? (
              <Text style={styles.company} numberOfLines={1}>
                {company}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      <View style={colLast}>
        <Pressable onPress={handlePress} style={styles.cellHit}>
          <Text style={styles.num} numberOfLines={1}>
            {formatPrice(row.price)}
          </Text>
        </Pressable>
      </View>

      <View style={colChg}>
        <Pressable onPress={handlePress} style={styles.cellHit}>
          <Text style={[styles.chg, { color: tone }]} numberOfLines={1}>
            {formatSigned(row.change)}
          </Text>
        </Pressable>
      </View>

      <View style={colChgPct}>
        <Pressable onPress={handlePress} style={styles.cellHit}>
          <Text style={[styles.pct, { color: tone }]} numberOfLines={1}>
            {formatSigned(row.changePct)}%
          </Text>
        </Pressable>
      </View>

      <View style={colVol}>
        <Pressable onPress={handlePress} style={styles.cellHit}>
          <Text style={styles.vol} numberOfLines={1}>
            {formatVolume(row.volume)}
          </Text>
        </Pressable>
      </View>

      <View style={colDrag}>
        {onDrag ? (
          <Pressable
            onPress={() => {
              void HapticFeedback.selection();
              onDrag();
            }}
            style={styles.dragHit}
            hitSlop={8}
            accessibilityLabel="סידור מחדש"
            accessibilityRole="button"
          >
            <Ionicons
              name="reorder-three"
              size={20}
              color={tokens.colors.text.tertiary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const WatchlistRow = memo(WatchlistRowInner);
