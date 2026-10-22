/**
 * שיט פירוט דוח רווח — לפי הטופו:
 * כרטיס ראשי (פס צבע לפי ההפתעה): לוגו / $TICKER / חברה + תגית מועד·תאריך·רבעון,
 * ושתי עמודות — רווח למניה | הכנסות: ערך בצבע עם אחוז, ו«מכה» / «מפספסת» מתחת.
 * «פירוט» — שורות עם אייקונים (צפי, רבעון קודם, שנה קודמת, בורסה, תאריך, מועד),
 * ו«תנועת המניה» — TradingView בטיים־פריים נמוך עם מסחר מורחב.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  APP_TYPE,
  appCardBodyStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
  appPhysicalLeftText,
} from '../../components/ui/appType';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import { TickerLogo } from '../../components/ui/TickerLogo';
import { MarketsTradingView } from '../Markets/components/MarketsTradingView';
import { getTradingViewEarningsChartHTML } from '../Markets/embeds/tradingViewEmbeds';
import { useTheme } from '../../context/ThemeContext';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { EarningsReport } from '../../services/earningsService';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

const SHEET_SNAP = 0.92;
const CHART_HEIGHT = 280;

type Props = {
  visible: boolean;
  report: EarningsReport | null;
  onClose: () => void;
  /** שיתוף הדוח (צ׳אט / ציוצים) — ההורה סוגר את השיט ופותח את שיט השיתוף */
  onShare?: (report: EarningsReport) => void;
};

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().toUpperCase().replace(/[$,]/g, '');
  let mult = 1;
  if (s.endsWith('B')) { mult = 1e9; s = s.slice(0, -1); }
  else if (s.endsWith('M')) { mult = 1e6; s = s.slice(0, -1); }
  else if (s.endsWith('K')) { mult = 1e3; s = s.slice(0, -1); }
  const n = Number(s) * mult;
  return Number.isFinite(n) ? n : null;
}

const fmtEps = (n: number | null) => (n == null ? '—' : `$${n.toFixed(2)}`);
function fmtRevenue(n: number | null): string {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function surprisePct(actual: number | null, est: number | null): number | null {
  if (actual == null || est == null || est === 0) return null;
  return ((actual - est) / Math.abs(est)) * 100;
}
function verdictLabel(pct: number | null): string {
  if (pct == null) return '';
  if (Math.abs(pct) < 0.05) return 'בקו הצפי';
  return pct > 0 ? 'מכה' : 'מפספסת';
}
function symbolOf(report: EarningsReport): string {
  return (report.ticker || (report.code || '').replace(/\.US$/i, '') || '').trim().toUpperCase();
}
function timingOf(report: EarningsReport): { label: string; icon: IonName; color: string } | null {
  const t = `${report.before_after_market ?? ''} ${report.report_time ?? ''}`.toLowerCase();
  if (t.includes('before') || t.includes('bmo')) return { label: 'לפני הפתיחה', icon: 'sunny-outline', color: '#D1A11D' };
  if (t.includes('after') || t.includes('amc')) return { label: 'אחרי הסגירה', icon: 'moon-outline', color: '#007AFF' };
  return null;
}
function dateLabel(iso?: string | null): string {
  const d = (iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function EarningsDetailSheet({ visible, report, onClose, onShare }: Props) {
  const tokens = useDesignTokens();
  return (
    <BottomSheet
      isOpen={visible && !!report}
      onClose={onClose}
      snapPoints={[SHEET_SNAP]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      {report ? <Body report={report} onClose={onClose} onShare={onShare} /> : null}
    </BottomSheet>
  );
}

function Body({
  report,
  onClose,
  onShare,
}: {
  report: EarningsReport;
  onClose: () => void;
  onShare?: (report: EarningsReport) => void;
}) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const extra = report as EarningsReport & {
    eps_prior?: number | string | null;
    revenue_estimate_year_ago?: number | string | null;
    exchange?: string | null;
  };

  const symbol = symbolOf(report);
  const company = (report.company_name || report.asset_name || '').trim();
  const timing = timingOf(report);
  const epsActual = toNum(report.actual);
  const epsEst = toNum(report.estimate ?? report.eps_estimate);
  const revActual = toNum(report.revenue_actual);
  const revEst = toNum(report.revenue_estimate ?? report.revenue_estimate_avg);
  const epsPct = toNum(report.percent) ?? surprisePct(epsActual, epsEst);
  const revPct = toNum(report.revenue_surprise_percent) ?? surprisePct(revActual, revEst);
  const reported = epsActual != null || revActual != null;
  const epsPrior = toNum(extra.eps_prior);
  const revYearAgo = toNum(extra.revenue_estimate_year_ago);
  const quarter =
    report.period || report.period_year ? [report.period, report.period_year].filter(Boolean).join(' ') : null;

  const tone = (pct: number | null) =>
    pct == null || Math.abs(pct) < 0.05
      ? tokens.colors.text.primary
      : pct > 0
        ? tokens.colors.primary.main
        : tokens.colors.danger.main;
  const barColor = (() => {
    const p = epsPct ?? revPct;
    if (p == null || Math.abs(p) < 0.05) return null;
    return p > 0 ? tokens.colors.primary.main : tokens.colors.danger.main;
  })();

  const chartHtml = useMemo(
    () => getTradingViewEarningsChartHTML(symbol, report.report_date, isDarkMode),
    [symbol, report.report_date, isDarkMode],
  );

  const detailRows: Array<{ icon: IonName; label: string; value: string }> = [
    { icon: 'stats-chart-outline', label: 'צפי רווח למניה', value: fmtEps(epsEst) },
    { icon: 'cash-outline', label: 'צפי הכנסות', value: fmtRevenue(revEst) },
    ...(epsPrior != null ? [{ icon: 'time-outline' as IonName, label: 'רווח למניה ברבעון המקביל', value: fmtEps(epsPrior) }] : []),
    ...(revYearAgo != null ? [{ icon: 'trending-up-outline' as IonName, label: 'הכנסות לפני שנה', value: fmtRevenue(revYearAgo) }] : []),
    ...(quarter ? [{ icon: 'layers-outline' as IonName, label: 'רבעון', value: quarter }] : []),
    { icon: 'calendar-outline', label: 'תאריך הדיווח', value: dateLabel(report.report_date) },
    { icon: timing?.icon ?? 'help-circle-outline', label: 'מועד', value: timing?.label ?? 'טרם נקבע' },
    ...(extra.exchange ? [{ icon: 'business-outline' as IonName, label: 'בורסה', value: String(extra.exchange) }] : []),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <DayNavBlurButton glass glassIntensity="light" onPress={onClose} size={HEADER_BACK_BTN_SIZE} accessibilityLabel="סגור">
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
        </DayNavBlurButton>
        <View style={styles.topSpacer} />
        {onShare ? (
          <DayNavBlurButton
            glass
            glassIntensity="light"
            onPress={() => {
              void HapticFeedback.selection();
              onShare(report);
            }}
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="שיתוף"
          >
            <Ionicons name="share-outline" size={20} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* כרטיס ראשי — כמו ברשימת הדוחות, עם פס צבע לפי ההפתעה */}
        <UICard variant="soft" glassIntensity="subtle" padding="none" style={styles.mainCard}>
          {barColor ? <View style={[styles.accentBar, { backgroundColor: barColor }]} /> : null}
          <View style={styles.mainInner}>
            <View style={styles.identityRow}>
              <TickerLogo symbol={symbol} size={48} borderRadius={24} />
              <View style={styles.identityText}>
                <Text style={styles.ticker} numberOfLines={1}>{`⁦$${symbol}⁩`}</Text>
                {company ? <Text style={styles.company} numberOfLines={1}>{company}</Text> : null}
              </View>
            </View>

            <View style={styles.metaRow}>
              {timing ? (
                <View style={[styles.chip, { backgroundColor: tokens.colors.background.primary }]}>
                  <Ionicons name={timing.icon} size={14} color={timing.color} />
                  <Text style={styles.chipText}>{timing.label}</Text>
                </View>
              ) : null}
              <View style={[styles.chip, { backgroundColor: tokens.colors.background.primary }]}>
                <Ionicons name="calendar-outline" size={14} color={tokens.colors.text.secondary} />
                <Text style={styles.chipText}>{dateLabel(report.report_date)}</Text>
              </View>
              {quarter ? (
                <View style={[styles.chip, { backgroundColor: tokens.colors.background.primary }]}>
                  <Text style={styles.chipText}>{quarter}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.columns}>
              <ResultColumn
                label="רווח למניה"
                value={reported ? fmtEps(epsActual) : fmtEps(epsEst)}
                pct={reported ? epsPct : null}
                color={reported ? tone(epsPct) : tokens.colors.text.primary}
                verdict={reported ? verdictLabel(epsPct) : 'צפי'}
              />
              <View style={styles.colDivider} />
              <ResultColumn
                label="הכנסות"
                value={reported ? fmtRevenue(revActual) : fmtRevenue(revEst)}
                pct={reported ? revPct : null}
                color={reported ? tone(revPct) : tokens.colors.text.primary}
                verdict={reported ? verdictLabel(revPct) : 'צפי'}
              />
            </View>
          </View>
        </UICard>

        <View>
          <Text style={styles.groupHeading}>תנועת המניה</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none" style={styles.chartCard}>
            <MarketsTradingView
              html={chartHtml}
              instanceKey={`earnings-sheet-${symbol}-${report.id}`}
              height={CHART_HEIGHT}
              loadingBackgroundColor="transparent"
            />
          </UICard>
        </View>

        <View>
          <Text style={styles.groupHeading}>פירוט</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none">
            {detailRows.map((r, i) => (
              <DetailRow key={r.label} icon={r.icon} label={r.label} value={r.value} showDivider={i < detailRows.length - 1} />
            ))}
          </UICard>
        </View>
      </ScrollView>
    </View>
  );
}

function ResultColumn({
  label,
  value,
  pct,
  color,
  verdict,
}: {
  label: string;
  value: string;
  pct: number | null;
  color: string;
  verdict: string;
}) {
  const tokens = useDesignTokens();
  const styles = useStyles();
  return (
    <View style={styles.column}>
      <Text style={styles.colLabel}>{label}</Text>
      <View style={styles.colValueRow}>
        {pct != null ? (
          <Text style={[styles.colPct, { color }]}>
            {pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </Text>
        ) : null}
        <Text style={[styles.colValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {verdict ? (
        <Text style={[styles.colVerdict, { color: verdict === 'צפי' ? tokens.colors.text.secondary : color }]}>
          {verdict}
        </Text>
      ) : null}
    </View>
  );
}

/** שורה כמו ב«נתוני היום» בשיט המניה: אייקון, כותרת, ערך */
function DetailRow({ icon, label, value, showDivider }: { icon: IonName; label: string; value: string; showDivider: boolean }) {
  const tokens = useDesignTokens();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        <View style={styles.rowLabelCol}>
          <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        </View>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={tokens.colors.text.primary} />
        </View>
      </View>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

function useStyles() {
  const tokens = useDesignTokens();
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, minHeight: 0 },
        topBar: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HEADER_BACK_BTN_SIZE,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 10,
          paddingBottom: APP_LAYOUT.stackGapSmall + 4,
        },
        topSpacer: { flex: 1 },
        scroll: { flex: 1, minHeight: 0 },
        scrollContent: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          gap: APP_LAYOUT.cardStackGap,
        },
        mainCard: { overflow: 'hidden', borderRadius: tokens.borderRadius.xl },
        accentBar: {
          position: 'absolute',
          right: 0,
          top: 14,
          bottom: 14,
          width: 3,
          borderTopLeftRadius: 2,
          borderBottomLeftRadius: 2,
          zIndex: 1,
        },
        mainInner: { padding: APP_LAYOUT.cardPadding, gap: APP_LAYOUT.cardTitleToBodyGap },
        identityRow: {
          direction: 'ltr',
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        identityText: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
        ticker: {
          fontSize: APP_TYPE.sectionTitle.fontSize,
          lineHeight: APP_TYPE.sectionTitle.lineHeight,
          fontWeight: APP_TYPE.sectionTitle.fontWeight,
          letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        company: {
          ...appPhysicalLeftText,
          textAlign: 'right',
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: APP_TYPE.cardSubtitle.fontSize,
          lineHeight: APP_TYPE.cardSubtitle.lineHeight,
          fontWeight: APP_TYPE.cardSubtitle.fontWeight,
          color: tokens.colors.text.secondary,
        },
        metaRow: {
          direction: 'rtl',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        },
        chipText: {
          ...APP_TYPE.caption,
          color: tokens.colors.text.primary,
          writingDirection: 'rtl',
          fontVariant: ['tabular-nums'],
        },
        divider: { height: 1, backgroundColor: tokens.colors.border.divider },
        columns: { direction: 'rtl', flexDirection: 'row', alignItems: 'stretch' },
        colDivider: { width: 1, backgroundColor: tokens.colors.border.divider, marginHorizontal: 8 },
        column: { flex: 1, alignItems: 'center', gap: 4 },
        colLabel: { ...APP_TYPE.cardMetricLabel, color: tokens.colors.text.secondary, textAlign: 'center' },
        colValueRow: { direction: 'ltr', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
        colPct: { ...APP_TYPE.caption, marginRight: 6, fontVariant: ['tabular-nums'] },
        colValue: {
          ...appCardBodyStyle,
          width: undefined,
          fontSize: APP_TYPE.cardTitle.fontSize + 2,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
          writingDirection: 'ltr',
        },
        colVerdict: { ...APP_TYPE.caption, fontWeight: '600', textAlign: 'center' },
        chartCard: { overflow: 'hidden', borderRadius: tokens.borderRadius.xl },
        groupHeading: { ...appGroupLabelStyle, color: tokens.colors.text.secondary },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          paddingHorizontal: APP_LAYOUT.cardPadding,
        },
        rowLabelCol: { flex: 1, minWidth: 0 },
        rowLabel: { ...appCardTitleStyle, color: tokens.colors.text.primary },
        rowIcon: { marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
        rowValue: {
          ...appCardBodyStyle,
          width: undefined,
          flexShrink: 1,
          maxWidth: '46%',
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        rowDivider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
          marginHorizontal: APP_LAYOUT.cardPadding,
        },
      }),
    [tokens],
  );
}
