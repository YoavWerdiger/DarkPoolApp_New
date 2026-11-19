/**
 * כרטיס פוזיציה פתוחה (במקום שורת טבלה) — בהשראת כרטיסי פוזיציה בפלטפורמות מסחר:
 * לוגו + סימבול + «100 מניות · LONG», שווי שוק ותגית P&L, שורות מפתח-ערך,
 * ושני כפתורים מעוגלים ברוחב הכרטיס (סגירה / שיתוף). מחיקה — כפתור קטן למעלה.
 * לחיצה על הכרטיס = עריכה.
 */
import i18n from '../../../lib/i18n';
import { UI_DIR } from '../../../lib/i18n/direction';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import UIButton from '../../../components/ui/UIButton';
import { APP_TYPE } from '../../../components/ui/appType';
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
  const hasPrice = lastPrice != null && Number.isFinite(lastPrice);

  let pnlText = '—';
  let pctText: string | null = null;
  let pnlColor: string = tokens.colors.text.secondary;
  let pnlTint: string = tokens.colors.background.tertiary;
  if (hasPrice) {
    const upnl = isLong
      ? (lastPrice! - t.entry_price) * t.quantity * t.leverage
      : (t.entry_price - lastPrice!) * t.quantity * t.leverage;
    const pct = t.entry_price > 0 ? (upnl / (t.entry_price * t.quantity)) * 100 : 0;
    if (upnl !== 0) {
      pnlColor = upnl > 0 ? tokens.colors.primary.main : tokens.colors.text.danger;
      pnlTint = `${pnlColor}1F`;
    }
    pnlText = `${upnl > 0 ? '+' : upnl < 0 ? '−' : ''}${formatCurrency(Math.abs(upnl), t.currency)}`;
    pctText = formatPercent(pct);
  }
  const marketValue = (hasPrice ? lastPrice! : t.entry_price) * t.quantity;

  // שורות מפתח-ערך: כניסה, נוכחי, תאריך פתיחה, SL / TP
  const rows: { label: string; value: string }[] = [
    { label: i18n.t(`${P}.s5`), value: formatCurrency(t.entry_price, t.currency, 2) },
    { label: i18n.t(`${P}.s1`), value: hasPrice ? formatCurrency(lastPrice!, t.currency, 2) : '—' },
    { label: i18n.t(`${P}.s6`), value: formatDateShort(t.entry_date) },
  ];
  if (t.stop_loss != null) rows.push({ label: 'Stop Loss', value: formatCurrency(t.stop_loss, t.currency, 2) });
  if (t.target_price != null) rows.push({ label: 'Take Profit', value: formatCurrency(t.target_price, t.currency, 2) });

  const canEdit = !!onEdit && !readOnly;
  const showClose = !!onClose && !readOnly;

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
      <UICard variant="soft" padding="md" style={styles.card} contentContainerStyle={styles.content}>
        {/* ראש: לוגו, סימבול, כמות + כיוון | שווי שוק ותגית P&L | מחיקה */}
        <View style={styles.head}>
          <TickerLogo symbol={t.symbol} size={40} />
          <View style={styles.titleCol}>
            <View style={styles.titleRow}>
              <Text style={[styles.symbol, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                {t.symbol}
              </Text>
              <View style={[styles.sideTag, { backgroundColor: `${sideColor}1F` }]}>
                <Text style={[styles.side, { color: sideColor }]}>
                  {isLong ? 'LONG' : 'SHORT'}
                  {t.leverage > 1 ? ` ×${t.leverage}` : ''}
                </Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
              {i18n.t(`${P}.s4`, { v0: formatQty(t.quantity) })}
            </Text>
          </View>
          <View style={styles.valueCol}>
            <Text style={[styles.value, { color: tokens.colors.text.primary }]} numberOfLines={1}>
              {formatCurrency(marketValue, t.currency, 2)}
            </Text>
            <View style={[styles.pnlChip, { backgroundColor: pnlTint }]}>
              <Text style={[styles.pnlChipText, { color: pnlColor }]} numberOfLines={1}>
                {pnlText}
                {pctText ? ` (${pctText})` : ''}
              </Text>
            </View>
          </View>
          {onDelete && !readOnly ? (
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                onDelete(t);
              }}
              style={[styles.deleteBtn, { backgroundColor: tokens.colors.background.tertiary }]}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(`${T}.s9`, { v0: t.symbol })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={tokens.colors.text.danger} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* מפתח-ערך */}
        <View style={[styles.kv, { borderTopColor: tokens.colors.border.divider }]}>
          {rows.map((r) => (
            <View key={r.label} style={styles.kvRow}>
              <Text style={[styles.kvLabel, { color: tokens.colors.text.secondary }]}>{r.label}</Text>
              <Text style={[styles.kvValue, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>

        {/* שני כפתורים מעוגלים ברוחב הכרטיס — בלי אייקונים */}
        {showClose || onShare ? (
          <View style={styles.actions}>
            {showClose ? (
              <View style={styles.actionGrow}>
                <UIButton
                  title={i18n.t(`${T}.s11`)}
                  variant="primary"
                  size="sm"
                  fullWidth
                  style={styles.pill}
                  onPress={() => onClose!(t)}
                />
              </View>
            ) : null}
            {onShare ? (
              <View style={styles.actionGrow}>
                <UIButton
                  title={i18n.t(`${P}.s2`)}
                  variant="secondary"
                  size="sm"
                  fullWidth
                  style={{ ...styles.pill, backgroundColor: tokens.colors.background.tertiary }}
                  onPress={() => onShare(t)}
                />
              </View>
            ) : null}
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
  },
  content: {
    gap: APP_LAYOUT.componentGap,
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
  },
  symbol: {
    ...APP_TYPE.cardTitle,
    writingDirection: 'ltr',
  },
  meta: {
    ...APP_TYPE.cardSubtitle,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideTag: {
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    justifyContent: 'center',
  },
  side: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  // שווי — לא בולד כבד: 15 / 600 (הכותרת היא הסימבול)
  value: {
    ...APP_TYPE.cardBody,
    fontWeight: '600',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  pnlChip: {
    marginTop: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  pnlChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kv: {
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kvLabel: {
    ...APP_TYPE.cardSubtitle,
  },
  kvValue: {
    ...APP_TYPE.cardSubtitle,
    fontWeight: '500',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: APP_LAYOUT.stackGapSmall,
  },
  actionGrow: {
    flex: 1,
  },
  pill: {
    borderRadius: 999,
  },
});

export default PositionCard;
