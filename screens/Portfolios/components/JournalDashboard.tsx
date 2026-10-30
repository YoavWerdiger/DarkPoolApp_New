/**
 * לוח הבקרה של יומן המסחר (בסקירה, סביב הגרף וחלוקת הנכסים):
 * • היום — רווח/הפסד חי, פוזיציות פתוחות, כמה מהתיק בשוק
 * • פוזיציות פתוחות — המובילות לפי רווח/הפסד לא ממומש, חי
 * • עסקאות אחרונות — חמש האחרונות שנסגרו
 * • מה עובד — המניות הרווחיות/המפסידות, רצף נוכחי, העסקה הטובה והגרועה
 * הכל מנתונים שהסקירה כבר טוענת (פוזיציות + מחירים חיים, עסקאות סגורות) — בלי קריאות שרת נוספות.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from './TickerLogo';
import { formatCurrency, formatPercent } from '../utils/format';
import { toDataIsland } from '../../DarkPool/utils/bidi';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardTitleStyle,
  journalPhysicalRightText,
} from '../../Journal/journalLayout';
import type { PortfolioHolding, Trade } from '../portfolioTypes';

type Tokens = ReturnType<typeof useDesignTokens>;

const signed = (v: number, currency: string) => `${v >= 0 ? '+' : ''}${formatCurrency(v, currency)}`;
const toneColor = (v: number, t: Tokens) =>
  v > 0 ? t.colors.primary.main : v < 0 ? t.colors.text.danger : t.colors.text.secondary;
const shortDate = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('.') : '';

/* ── היום ── */
export function JournalTodayCard({
  dailyGain,
  totalValue,
  holdings,
  currency,
}: {
  dailyGain: number | null;
  totalValue: number | null;
  holdings: PortfolioHolding[];
  currency: string;
}) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const invested = holdings.reduce((sum, h) => sum + Math.abs(h.invested), 0);
  const exposure = totalValue && totalValue > 0 ? Math.min(100, (invested / totalValue) * 100) : null;
  const base = totalValue != null && dailyGain != null ? totalValue - dailyGain : null;
  const dailyPct = base && base > 0 && dailyGain != null ? (dailyGain / base) * 100 : null;
  return (
    <UICard variant="soft" padding="md" style={s.section}>
      <Text style={s.title}>היום</Text>
      <View style={s.cells}>
        <Cell
          s={s}
          label="רווח / הפסד"
          value={dailyGain != null ? signed(dailyGain, currency) : '—'}
          sub={dailyPct != null ? formatPercent(dailyPct) : 'אין פוזיציות פתוחות'}
          color={dailyGain != null ? toneColor(dailyGain, t) : t.colors.text.primary}
        />
        <Cell s={s} label="פוזיציות פתוחות" value={String(holdings.length)} color={t.colors.text.primary} />
        <Cell
          s={s}
          label="בשוק"
          value={exposure != null ? `${exposure.toFixed(0)}%` : '—'}
          sub="מהתיק"
          color={t.colors.text.primary}
        />
      </View>
    </UICard>
  );
}

function Cell({
  s,
  label,
  value,
  sub,
  color,
}: {
  s: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <View style={s.cell}>
      <Text style={s.cellLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.cellValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {toDataIsland(value)}
      </Text>
      {sub ? <Text style={s.cellSub} numberOfLines={1}>{toDataIsland(sub)}</Text> : null}
    </View>
  );
}

/* ── פוזיציות פתוחות ── */
export function JournalOpenPositionsCard({ holdings, currency }: { holdings: PortfolioHolding[]; currency: string }) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const top = useMemo(
    () => [...holdings].sort((a, b) => Math.abs(b.unrealized_gain) - Math.abs(a.unrealized_gain)).slice(0, 5),
    [holdings]
  );
  if (!top.length) return null;
  return (
    <UICard variant="soft" padding="md" style={s.section}>
      <Text style={s.title}>פוזיציות פתוחות</Text>
      {top.map((h, i) => (
        <Row
          key={h.symbol}
          s={s}
          last={i === top.length - 1}
          symbol={h.symbol}
          sub={`${Math.round(h.quantity).toLocaleString('en-US')} יח׳ · ${formatCurrency(h.last_price, currency)}`}
          value={signed(h.unrealized_gain, currency)}
          valueSub={formatPercent(h.unrealized_gain_pct)}
          color={toneColor(h.unrealized_gain, t)}
        />
      ))}
    </UICard>
  );
}

/* ── עסקאות אחרונות ── */
export function JournalRecentTradesCard({ trades, currency }: { trades: Trade[]; currency: string }) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const recent = useMemo(
    () =>
      trades
        .filter((x) => x.profit_loss != null)
        .sort((a, b) => String(b.exit_date ?? '').localeCompare(String(a.exit_date ?? '')))
        .slice(0, 5),
    [trades]
  );
  if (!recent.length) return null;
  return (
    <UICard variant="soft" padding="md" style={s.section}>
      <Text style={s.title}>עסקאות אחרונות</Text>
      {recent.map((x, i) => (
        <Row
          key={`${x.id ?? x.symbol}-${i}`}
          s={s}
          last={i === recent.length - 1}
          symbol={x.symbol}
          sub={`${x.direction === 'short' ? 'שורט' : 'לונג'} · ${shortDate(x.exit_date)}`}
          value={signed(x.profit_loss ?? 0, currency)}
          color={toneColor(x.profit_loss ?? 0, t)}
        />
      ))}
    </UICard>
  );
}

/* ── מה עובד ── */
export function JournalInsightsCard({ trades, currency }: { trades: Trade[]; currency: string }) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const data = useMemo(() => {
    const done = trades
      .filter((x) => x.profit_loss != null)
      .sort((a, b) => String(a.exit_date ?? '').localeCompare(String(b.exit_date ?? '')));
    if (done.length < 2) return null;
    const bySymbol = new Map<string, number>();
    for (const x of done) bySymbol.set(x.symbol, (bySymbol.get(x.symbol) ?? 0) + (x.profit_loss ?? 0));
    const ranked = [...bySymbol.entries()].sort((a, b) => b[1] - a[1]);
    const best = ranked.filter(([, v]) => v > 0).slice(0, 3);
    const worst = ranked.filter(([, v]) => v < 0).slice(-3).reverse();
    // רצף נוכחי — מהעסקה האחרונה אחורה
    let streak = 0;
    const lastWin = (done[done.length - 1].profit_loss ?? 0) > 0;
    for (let i = done.length - 1; i >= 0; i--) {
      const win = (done[i].profit_loss ?? 0) > 0;
      if (win !== lastWin) break;
      streak += 1;
    }
    const pnl = done.map((x) => x.profit_loss ?? 0);
    const bestTrade = done[pnl.indexOf(Math.max(...pnl))];
    const worstTrade = done[pnl.indexOf(Math.min(...pnl))];
    return { best, worst, streak, lastWin, bestTrade, worstTrade };
  }, [trades]);
  if (!data) return null;
  return (
    <UICard variant="soft" padding="md" style={s.section}>
      <Text style={s.title}>מה עובד</Text>
      <View style={s.cells}>
        <Cell
          s={s}
          label="רצף נוכחי"
          value={`${data.streak} ${data.lastWin ? 'רווחים' : 'הפסדים'}`}
          color={data.lastWin ? t.colors.primary.main : t.colors.text.danger}
        />
        <Cell
          s={s}
          label="העסקה הטובה"
          value={signed(data.bestTrade.profit_loss ?? 0, currency)}
          sub={data.bestTrade.symbol}
          color={toneColor(data.bestTrade.profit_loss ?? 0, t)}
        />
        <Cell
          s={s}
          label="הגרועה"
          value={signed(data.worstTrade.profit_loss ?? 0, currency)}
          sub={data.worstTrade.symbol}
          color={toneColor(data.worstTrade.profit_loss ?? 0, t)}
        />
      </View>
      {data.best.length ? (
        <>
          <Text style={[s.groupLabel, { marginTop: JOURNAL_LAYOUT.componentGap }]}>הכי רווחיות</Text>
          {data.best.map(([sym, v], i) => (
            <Row key={sym} s={s} last={i === data.best.length - 1} symbol={sym} value={signed(v, currency)} color={toneColor(v, t)} />
          ))}
        </>
      ) : null}
      {data.worst.length ? (
        <>
          <Text style={[s.groupLabel, { marginTop: JOURNAL_LAYOUT.componentGap }]}>הכי מפסידות</Text>
          {data.worst.map(([sym, v], i) => (
            <Row key={sym} s={s} last={i === data.worst.length - 1} symbol={sym} value={signed(v, currency)} color={toneColor(v, t)} />
          ))}
        </>
      ) : null}
    </UICard>
  );
}

function Row({
  s,
  symbol,
  sub,
  value,
  valueSub,
  color,
  last,
}: {
  s: ReturnType<typeof createStyles>;
  symbol: string;
  sub?: string;
  value: string;
  valueSub?: string;
  color: string;
  last: boolean;
}) {
  return (
    <View style={[s.row, !last && s.rowDivider]}>
      {/* ltr פיזי: סכום משמאל, טיקר + לוגו מימין */}
      <View style={s.rowValueCol}>
        <Text style={[s.rowValue, { color }]} numberOfLines={1}>{toDataIsland(value)}</Text>
        {valueSub ? <Text style={[s.rowSub, { color }]} numberOfLines={1}>{toDataIsland(valueSub)}</Text> : null}
      </View>
      <View style={s.rowStart}>
        <View style={s.rowTextCol}>
          <Text style={s.rowSymbol} numberOfLines={1}>{symbol}</Text>
          {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <TickerLogo symbol={symbol} size={34} />
      </View>
    </View>
  );
}

function createStyles(t: Tokens) {
  return StyleSheet.create({
    section: { marginBottom: JOURNAL_LAYOUT.cardStackGap },
    title: {
      ...journalCardTitleStyle,
      ...journalPhysicalRightText,
      color: t.colors.text.primary,
      marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
    },
    groupLabel: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
      lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
      fontWeight: '600',
      color: t.colors.text.secondary,
      marginBottom: 2,
    },
    cells: { direction: 'rtl', flexDirection: 'row', gap: 8 },
    cell: { flex: 1, direction: 'ltr' },
    cellLabel: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
      lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
      color: t.colors.text.secondary,
    },
    cellValue: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.cardMetricValueSecondary.fontSize,
      lineHeight: JOURNAL_TYPE.cardMetricValueSecondary.lineHeight,
      fontWeight: JOURNAL_TYPE.cardMetricValueSecondary.fontWeight,
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
    cellSub: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.caption.fontSize,
      lineHeight: JOURNAL_TYPE.caption.lineHeight,
      fontVariant: ['tabular-nums'],
      color: t.colors.text.secondary,
      marginTop: 2,
    },
    row: {
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: t.colors.border.divider },
    rowStart: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    rowTextCol: { alignItems: 'flex-end', flexShrink: 1 },
    rowValueCol: { alignItems: 'flex-start' },
    rowSymbol: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.cardBody.fontSize,
      lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
      fontWeight: '600',
      color: t.colors.text.primary,
    },
    rowValue: {
      fontSize: JOURNAL_TYPE.cardBody.fontSize,
      lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    rowSub: {
      fontSize: JOURNAL_TYPE.caption.fontSize,
      lineHeight: JOURNAL_TYPE.caption.lineHeight,
      fontVariant: ['tabular-nums'],
      color: t.colors.text.secondary,
    },
  });
}
