/**
 * לוח הבקרה של יומן המסחר (בסקירה, מתחת לגרף וחלוקת הנכסים) — באותה שפה כמו תיק האינסיידרים:
 * כותרת סקשן על רקע המסך, ומתחתיה פאנל רשימה בלי ריפוד עם שורות ברוחב מלא וקווים מפרידים.
 * • פוזיציות פתוחות — כמו «אחזקות» באינסיידרים: שווי, תשואה לא ממומשת, נקודת צבע כמו בעוגה
 * • עסקאות אחרונות — חמש האחרונות שנסגרו, עם רווח/הפסד ותשואה
 * • סטטיסטיקה — רשת שני טורים לפי הטופו (אייקון, תווית 12, ערך 20): אחוז הצלחה, עסקאות, רווח/הפסד ממוצע, היחס, רווח ממומש
 * הכל מנתונים שהסקירה כבר טוענת (פוזיציות + מחירים חיים, עסקאות סגורות) — בלי קריאות שרת נוספות.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { TickerLogo } from './TickerLogo';
import { formatNumber, formatPercent, getCurrencySymbol } from '../utils/format';
import { toDataIsland } from '../../DarkPool/utils/bidi';
import { HoldingsListRow, useHoldingsPieColors } from '../../DarkPool/components/HoldingsPieSection';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
  journalPhysicalRightText,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';
import type { PortfolioHolding, Trade } from '../portfolioTypes';

type Tokens = ReturnType<typeof useDesignTokens>;
type Styles = ReturnType<typeof createStyles>;

/** +$736.60 / -$12.00 — סמל צמוד למספר, כמו בכותרת «שווי תיק» */
const signed = (v: number, currency: string) =>
  `${v < 0 ? '-' : '+'}${getCurrencySymbol(currency)}${formatNumber(Math.abs(v), 2)}`;
const money = (v: number, currency: string) => `${getCurrencySymbol(currency)}${formatNumber(v, 2)}`;
const toneColor = (v: number, t: Tokens) =>
  v > 0 ? t.colors.primary.main : v < 0 ? t.colors.text.danger : t.colors.text.secondary;
const shortDate = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('.') : '';

/** תשואת עסקה סגורה מהמחירים (כיוון שורט הופך סימן) */
const tradeReturnPct = (x: Trade) =>
  x.exit_price != null && x.entry_price > 0
    ? ((x.exit_price - x.entry_price) / x.entry_price) * 100 * (x.direction === 'short' ? -1 : 1)
    : null;

/* ── פוזיציות פתוחות ── */
export function JournalOpenPositionsCard({ holdings, currency }: { holdings: PortfolioHolding[]; currency: string }) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const { rows, alloc } = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const total = sorted.reduce((sum, h) => sum + Math.abs(h.value), 0);
    return {
      rows: sorted,
      alloc: sorted.map((h) => ({
        ticker: h.symbol,
        allocation_pct: total > 0 ? (Math.abs(h.value) / total) * 100 : 0,
        market_value: Math.abs(h.value),
      })),
    };
  }, [holdings]);
  const colorByTicker = useHoldingsPieColors(alloc);
  if (!rows.length) return null;
  return (
    <Section s={s} title="פוזיציות פתוחות">
      <Panel s={s}>
        {rows.map((h, i) => (
          <React.Fragment key={h.symbol}>
            <HoldingsListRow
              ticker={h.symbol}
              allocationLabel={`${alloc[i].allocation_pct.toFixed(1)}%`}
              valueLabel={money(h.value, currency)}
              returnLabel={formatPercent(h.unrealized_gain_pct)}
              returnPct={h.unrealized_gain_pct}
              colorByTicker={colorByTicker}
            />
            {i < rows.length - 1 ? <View style={s.divider} /> : null}
          </React.Fragment>
        ))}
      </Panel>
    </Section>
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
    <Section s={s} title="עסקאות אחרונות">
      <Panel s={s}>
        {recent.map((x, i) => (
          <Row
            key={`${x.id ?? x.symbol}-${i}`}
            s={s}
            last={i === recent.length - 1}
            symbol={x.symbol}
            title={x.symbol}
            meta={`${x.direction === 'short' ? 'שורט' : 'לונג'} · ${shortDate(x.exit_date)}`}
            value={signed(x.profit_loss ?? 0, currency)}
            valueSub={tradeReturnPct(x) != null ? formatPercent(tradeReturnPct(x)) : undefined}
            color={toneColor(x.profit_loss ?? 0, t)}
          />
        ))}
      </Panel>
    </Section>
  );
}

/* ── סטטיסטיקה ── */
export type StatCell = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
};

export function JournalStatsCard({ trades, currency }: { trades: Trade[]; currency: string }) {
  const t = useDesignTokens();
  const cells = useMemo<StatCell[] | null>(() => {
    const pnl = trades.filter((x) => x.profit_loss != null).map((x) => x.profit_loss ?? 0);
    if (pnl.length < 2) return null;
    const wins = pnl.filter((v) => v > 0);
    const losses = pnl.filter((v) => v < 0);
    const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : null;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null;
    const total = pnl.reduce((a, b) => a + b, 0);
    // כמה רווח ממוצע על כל דולר הפסד ממוצע
    const ratio = avgWin != null && avgLoss != null && avgLoss < 0 ? avgWin / Math.abs(avgLoss) : null;
    const primary = t.colors.text.primary;
    return [
      { icon: 'pie-chart-outline', label: 'אחוז הצלחה', value: `${Math.round((wins.length / pnl.length) * 100)}%`, color: primary },
      { icon: 'swap-horizontal-outline', label: 'עסקאות סגורות', value: String(pnl.length), color: primary },
      {
        icon: 'trending-up',
        label: 'רווח ממוצע',
        value: avgWin != null ? signed(avgWin, currency) : '—',
        color: avgWin != null ? t.colors.primary.main : t.colors.text.secondary,
      },
      {
        icon: 'trending-down',
        label: 'הפסד ממוצע',
        value: avgLoss != null ? signed(avgLoss, currency) : '—',
        color: avgLoss != null ? t.colors.text.danger : t.colors.text.secondary,
      },
      { icon: 'scale-outline', label: 'יחס רווח/הפסד', value: ratio != null ? ratio.toFixed(2) : '—', color: primary },
      { icon: 'wallet-outline', label: 'רווח ממומש', value: signed(total, currency), color: toneColor(total, t) },
    ];
  }, [trades, currency, t]);
  if (!cells) return null;
  return <JournalStatsGrid title="סטטיסטיקה" cells={cells} />;
}

/**
 * רשת KPI לפי הטופו — שני טורים, אייקון בעיגול, תווית 12 ↔ ערך 20, קווים מפרידים.
 * משותפת לסקירה ולסטטיסטיקות החודש בלוח השנה. `style` — למשל ריווח שונה מתחת לסקשן.
 */
export function JournalStatsGrid({ title, cells, style }: { title: string; cells: StatCell[]; style?: ViewStyle }) {
  const t = useDesignTokens();
  const s = useMemo(() => createStyles(t), [t]);
  const rows: StatCell[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <Section s={s} title={title} style={style}>
      <Panel s={s}>
        {rows.map((pair, r) => (
          <React.Fragment key={pair[0].label}>
            <View style={s.statRow}>
              {pair.map((c, i) => (
                <React.Fragment key={c.label}>
                  {i > 0 ? <View style={s.statColDivider} /> : null}
                  <View style={s.statCell}>
                    <View style={s.iconBadge}>
                      <Ionicons name={c.icon} size={20} color={c.color === t.colors.text.secondary ? t.colors.text.primary : c.color} />
                    </View>
                    <View style={s.rowGap} />
                    <View style={s.rowText}>
                      <Text style={s.statLabel} numberOfLines={1}>{c.label}</Text>
                      <Text style={[s.statValue, { color: c.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {toDataIsland(c.value)}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {r < rows.length - 1 ? <View style={s.divider} /> : null}
          </React.Fragment>
        ))}
      </Panel>
    </Section>
  );
}

function Section({
  s,
  title,
  style,
  children,
}: {
  s: Styles;
  title: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.section, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** פאנל רשימה כמו באינסיידרים — בלי ריפוד, השורות ברוחב מלא */
function Panel({ s, children }: { s: Styles; children: React.ReactNode }) {
  return (
    <UICard variant="soft" glassIntensity="light" padding="none" style={s.panel} contentContainerStyle={s.panelInner}>
      {children}
    </UICard>
  );
}

/**
 * שורה RTL כמו «עסקאות אחרונות» באינסיידרים:
 *   [לוגו/אייקון] כותרת              +$סכום
 *                 פירוט              תשואה
 */
function Row({
  s,
  symbol,
  icon,
  iconColor,
  title,
  meta,
  value,
  valueSub,
  color,
  last,
}: {
  s: Styles;
  symbol?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  meta?: string;
  value: string;
  valueSub?: string;
  color: string;
  last: boolean;
}) {
  return (
    <>
      <View style={s.row}>
        {symbol ? (
          <TickerLogo symbol={symbol} size={36} borderRadius={18} />
        ) : (
          <View style={s.iconBadge}>
            <Ionicons name={icon ?? 'ellipse-outline'} size={20} color={iconColor} />
          </View>
        )}
        <View style={s.rowGap} />
        <View style={s.rowText}>
          <Text style={symbol ? s.rowTicker : s.rowTitle} numberOfLines={1}>
            {symbol ? toDataIsland(title) : title}
          </Text>
          {meta ? <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        <View style={s.rowValueCol}>
          <Text style={[s.rowValue, { color }]} numberOfLines={1}>{toDataIsland(value)}</Text>
          {valueSub ? (
            <Text style={[s.rowValueSub, { color }]} numberOfLines={1}>{toDataIsland(valueSub)}</Text>
          ) : null}
        </View>
      </View>
      {!last ? <View style={s.divider} /> : null}
    </>
  );
}

function createStyles(t: Tokens) {
  return StyleSheet.create({
    section: { marginBottom: JOURNAL_LAYOUT.sectionGap },
    sectionTitle: {
      ...journalSectionTitleStyle,
      color: t.colors.text.primary,
      marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent,
    },
    panel: { borderRadius: UI_CARD_RADIUS, overflow: 'hidden', alignSelf: 'stretch', width: '100%' },
    panelInner: { width: '100%', alignSelf: 'stretch' },
    divider: {
      height: 1,
      backgroundColor: t.colors.border.divider,
      marginHorizontal: JOURNAL_LAYOUT.cardPadding,
      alignSelf: 'stretch',
    },

    /* שורות רשימה */
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: JOURNAL_LAYOUT.cardTitleToBodyGap,
      paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
      minHeight: 56,
    },
    rowGap: { width: 12, flexShrink: 0 },
    rowText: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, justifyContent: 'center' },
    rowTicker: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: JOURNAL_TYPE.cardBody.fontSize,
      lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
      fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
      fontVariant: ['tabular-nums'],
      color: t.colors.text.primary,
    },
    rowMeta: {
      ...journalPhysicalRightText,
      marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
      fontSize: JOURNAL_TYPE.caption.fontSize,
      lineHeight: JOURNAL_TYPE.caption.lineHeight,
      fontWeight: JOURNAL_TYPE.caption.fontWeight,
      fontVariant: ['tabular-nums'],
      color: t.colors.text.secondary,
    },
    rowTitle: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.cardBody.fontSize,
      lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
      fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
      color: t.colors.text.primary,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.selection.subtle,
    },
    /* סטטיסטיקה — תא KPI: תווית cardMetricLabel ↔ ערך cardMetricValueSecondary (4) */
    statRow: { direction: 'rtl', flexDirection: 'row', alignSelf: 'stretch', width: '100%' },
    statCell: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: JOURNAL_LAYOUT.cardPadding,
      paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
    },
    statColDivider: {
      width: 1,
      backgroundColor: t.colors.border.divider,
      marginVertical: JOURNAL_LAYOUT.cardPadding,
    },
    statLabel: {
      ...journalCardMetricLabelStyle,
      ...journalPhysicalRightText,
      color: t.colors.text.secondary,
    },
    statValue: {
      ...journalCardMetricValueSecondaryStyle,
      marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
      fontVariant: ['tabular-nums'],
      // ימין פיזי כמו התווית (journalPhysicalRightText), עם מספר LTR
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    rowValueCol: { flexShrink: 0, marginStart: 12, alignItems: 'flex-start', direction: 'ltr' },
    rowValue: {
      fontSize: JOURNAL_TYPE.cardBody.fontSize,
      lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
      fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    rowValueSub: {
      marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
      fontSize: JOURNAL_TYPE.caption.fontSize,
      lineHeight: JOURNAL_TYPE.caption.lineHeight,
      fontWeight: JOURNAL_TYPE.caption.fontWeight,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'left',
    },
  });
}
