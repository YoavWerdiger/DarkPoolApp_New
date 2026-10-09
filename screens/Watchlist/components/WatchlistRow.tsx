import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE } from '../../../components/ui/appType';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
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

export const LOGO_SIZE = 28;

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

function WatchlistRowInner({ row, onPress, onDrag, isActive }: Props) {
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
          paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
          minHeight: 52,
        },
        rowActive: {
          backgroundColor: tokens.colors.background.cardSolid,
          borderRadius: APP_LAYOUT.cardPadding,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        identity: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
        },
        logoWrap: {
          width: LOGO_SIZE,
          height: LOGO_SIZE,
          marginLeft: 12,
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
          zIndex: 2,
        },
        textBlock: {
          flexShrink: 1,
          minWidth: 0,
          alignItems: 'flex-end',
        },
        symbol: {
          ...APP_TYPE.cardSubtitle,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          textAlign: 'right',
          writingDirection: 'ltr',
          color: tokens.colors.text.primary,
        },
        company: {
          ...APP_TYPE.caption2,
          textAlign: 'right',
          color: tokens.colors.text.secondary,
        },
        cellHit: {
          width: '100%',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minHeight: 32,
        },
        num: {
          ...APP_TYPE.cardSubtitle,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          writingDirection: 'ltr',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
          color: tokens.colors.text.primary,
        },
        chg: {
          ...APP_TYPE.caption,
          writingDirection: 'ltr',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        pct: {
          ...APP_TYPE.caption,
          writingDirection: 'ltr',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        vol: {
          ...APP_TYPE.caption,
          writingDirection: 'ltr',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
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
      style={[styles.row, isActive && styles.rowActive]}
      accessibilityRole="button"
      accessibilityLabel={`${symbol} ${company} ${formatPrice(row.price)} ${formatSigned(row.change)} ${formatSigned(row.changePct)}%${hasAlert ? ' עם התראה' : ''}`}
    >
      <View style={colSymbol}>
        <Pressable
          onPress={handlePress}
          onLongPress={onDrag}
          delayLongPress={300}
          style={styles.identity}
          accessibilityRole="button"
          accessibilityLabel={symbol}
        >
          <View style={styles.logoWrap}>
            <TickerLogo symbol={symbol} size={LOGO_SIZE} />
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
        <Pressable
          onPress={handlePress}
          onLongPress={onDrag}
          delayLongPress={300}
          style={styles.cellHit}
        >
          <AnimatedNumber
            key={symbol}
            text={formatPrice(row.price)}
            value={row.price}
            flash
            style={styles.num}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          />
        </Pressable>
      </View>

      <View style={colChg}>
        <Pressable
          onPress={handlePress}
          onLongPress={onDrag}
          delayLongPress={300}
          style={styles.cellHit}
        >
          <AnimatedNumber
            key={symbol}
            text={formatSigned(row.change)}
            value={row.change}
            style={[styles.chg, { color: tone }]}
            numberOfLines={1}
          />
        </Pressable>
      </View>

      <View style={colChgPct}>
        <Pressable
          onPress={handlePress}
          onLongPress={onDrag}
          delayLongPress={300}
          style={styles.cellHit}
        >
          <AnimatedNumber
            key={symbol}
            text={`${formatSigned(row.changePct)}%`}
            value={row.changePct}
            style={[styles.pct, { color: tone }]}
            numberOfLines={1}
          />
        </Pressable>
      </View>

      <View style={colVol}>
        <Pressable
          onPress={handlePress}
          onLongPress={onDrag}
          delayLongPress={300}
          style={styles.cellHit}
        >
          <Text style={styles.vol} numberOfLines={1}>
            {formatVolume(row.volume)}
          </Text>
        </Pressable>
      </View>

      <View style={colDrag}>
        {onDrag ? (
          <Pressable
            onPressIn={onDrag}
            delayLongPress={120}
            style={styles.dragHit}
            hitSlop={8}
            accessibilityLabel="סידור מחדש"
            accessibilityRole="button"
          >
            <Ionicons
              name="reorder-three"
              size={20}
              color={tokens.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const WatchlistRow = memo(WatchlistRowInner);
