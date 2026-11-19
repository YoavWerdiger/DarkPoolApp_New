/**
 * כרטיס פוזיציה פתוחה (במקום שורת טבלה) — לוגו, סימבול וכיוון, P&L חי,
 * רשת נתונים (כמות / כניסה / מחיר נוכחי / תאריך, SL / TP כשיש),
 * וכפתורי סגירה ושיתוף מובנים בתחתית. לחיצה על הכרטיס = עריכה.
 */
import i18n from '../../../lib/i18n';
import { UI_DIR } from '../../../lib/i18n/direction';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import UIButton from '../../../components/ui/UIButton';
import { APP_TYPE, appPhysicalRightText } from '../../../components/ui/appType';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Trade } from '../portfolioTypes';
import { formatCurrency, formatDateShort, formatNumber, formatPercent } from '../utils/format';
import { TickerLogo } from './TickerLogo';

const T = 'auto.screens__Portfolios__components__PortfolioTradesTable';
const P = 'auto.screens__Portfolios__components__PositionCard';

type Props = {
  trade: Trade;
  lastPrice?: number;
  readOnly?: boolean;
  onClose?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onShare?: (trade: Trade) => void;
  onEdit?: (trade: Trade) => void;
};

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : formatNumber(qty, 4);
}

export function PositionCard({ trade: t, lastPrice, readOnly, onClose, onDelete, onShare, onEdit }: Props) {
  const tokens = useDesignTokens();
  const isLong = t.direction === 'long';
  const sideColor = isLong ? tokens.colors.primary.main : tokens.colors.text.danger;

  let pnlText = '—';
  let pctText: string | null = null;
  let pnlColor: string = tokens.colors.text.secondary;
  if (lastPrice != null && Number.isFinite(lastPrice)) {
    const upnl = isLong
      ? (lastPrice - t.entry_price) * t.quantity * t.leverage
      : (t.entry_price - lastPrice) * t.quantity * t.leverage;
    const pct = t.entry_price > 0 ? (upnl / (t.entry_price * t.quantity)) * 100 : 0;
    pnlColor = upnl > 0 ? tokens.colors.primary.main : upnl < 0 ? tokens.colors.text.danger : tokens.colors.text.secondary;
    pnlText = `${upnl > 0 ? '+' : upnl < 0 ? '−' : ''}${formatCurrency(Math.abs(upnl), t.currency)}`;
    pctText = formatPercent(pct);
  }

  const stats: { label: string; value: string }[] = [
    { label: i18n.t(`${T}.s3`), value: formatQty(t.quantity) },
    { label: i18n.t(`${T}.s4`), value: formatCurrency(t.entry_price, t.currency, 2) },
    {
      label: i18n.t(`${P}.s1`),
      value: lastPrice != null && Number.isFinite(lastPrice) ? formatCurrency(lastPrice, t.currency, 2) : '—',
    },
    { label: i18n.t(`${T}.s5`), value: formatDateShort(t.entry_date) },
  ];
  const levels: { label: string; value: string; color: string }[] = [];
  if (t.stop_loss != null) levels.push({ label: 'SL', value: formatCurrency(t.stop_loss, t.currency, 2), color: tokens.colors.text.danger });
  if (t.target_price != null) levels.push({ label: 'TP', value: formatCurrency(t.target_price, t.currency, 2), color: tokens.colors.primary.main });

  const canEdit = !!onEdit && !readOnly;

  return (
    <TouchableOpacity
      activeOpacity={canEdit ? 0.85 : 1}
      disabled={!canEdit}
      onPress={() => {
        void HapticFeedback.selection();
        onEdit?.(t);
      }}
      accessibilityRole={canEdit ? 'button' : undefined}
      accessibilityLabel={canEdit ? i18n.t(`${T}.s7`, { v0: t.symbol }) : undefined}
    >
      <UICard variant="soft" padding="md" style={styles.card}>
        {/* ראש: לוגו + סימבול + כיוון | P&L */}
        <View style={styles.head}>
          <TickerLogo symbol={t.symbol} size={40} />
          <View style={styles.titleCol}>
            <Text style={[styles.symbol, { color: tokens.colors.text.primary }]} numberOfLines={1}>
              {t.symbol}
            </Text>
            <View style={[styles.sidePill, { backgroundColor: sideColor }]}>
              <Ionicons name={isLong ? 'trending-up' : 'trending-down'} size={12} color={tokens.colors.text.inverse} />
              <Text style={[styles.sideText, { color: tokens.colors.text.inverse }]}>
                {isLong ? 'LONG' : 'SHORT'}
                {t.leverage > 1 ? ` ×${t.leverage}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.pnlCol}>
            <Text style={[styles.pnl, { color: pnlColor }]} numberOfLines={1}>
              {pnlText}
            </Text>
            {pctText ? <Text style={[styles.pnlPct, { color: pnlColor }]}>{pctText}</Text> : null}
          </View>
        </View>

        {/* נתונים */}
        <View style={[styles.statsRow, { backgroundColor: tokens.colors.background.tertiary }]}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statLabel, { color: tokens.colors.text.tertiary }]} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={[styles.statValue, { color: tokens.colors.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        {levels.length ? (
          <View style={styles.levelsRow}>
            {levels.map((l) => (
              <View key={l.label} style={[styles.levelChip, { borderColor: tokens.colors.border.divider }]}>
                <Text style={[styles.levelLabel, { color: l.color }]}>{l.label}</Text>
                <Text style={[styles.levelValue, { color: tokens.colors.text.primary }]}>{l.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* פעולות מובנות */}
        {!readOnly && (onClose || onShare || onDelete) ? (
          <View style={styles.actions}>
            {onClose ? (
              <View style={styles.actionGrow}>
                <UIButton
                  title={i18n.t(`${T}.s11`)}
                  icon="checkmark-done"
                  variant="primary"
                  size="sm"
                  fullWidth
                  onPress={() => onClose(t)}
                />
              </View>
            ) : null}
            {onShare ? (
              <View style={styles.actionGrow}>
                <UIButton
                  title={i18n.t(`${P}.s2`)}
                  icon="share-outline"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onPress={() => onShare(t)}
                />
              </View>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.impactLight();
                  onDelete(t);
                }}
                style={[styles.deleteBtn, { backgroundColor: tokens.colors.background.tertiary }]}
                accessibilityRole="button"
                accessibilityLabel={i18n.t(`${T}.s9`, { v0: t.symbol })}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={18} color={tokens.colors.text.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : readOnly && onShare ? (
          <View style={styles.actions}>
            <View style={styles.actionGrow}>
              <UIButton title={i18n.t(`${P}.s2`)} icon="share-outline" variant="secondary" size="sm" fullWidth onPress={() => onShare(t)} />
            </View>
          </View>
        ) : null}
      </UICard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    borderWidth: 0,
    direction: UI_DIR,
    gap: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: 4,
  },
  symbol: {
    ...APP_TYPE.cardTitle,
    writingDirection: 'ltr',
  },
  sidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  sideText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pnlCol: {
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  pnlPct: {
    ...APP_TYPE.cardSubtitle,
    fontWeight: '600',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  statLabel: {
    ...APP_TYPE.caption,
    textAlign: 'center',
  },
  statValue: {
    ...APP_TYPE.cardSubtitle,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  levelsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
  },
  actionGrow: {
    flex: 1,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PositionCard;
