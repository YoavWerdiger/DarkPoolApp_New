/**
 * שיט פירוט דוח רווח — לפי הטופו (כמו שיט המניה ברשימת המעקב):
 * ראש עם לוגו / טיקר / חברה ותגית מועד, «תוצאות» (רווח למניה והכנסות בצבע מול הצפי + אחוז הפתעה),
 * גרף TradingView בטיים־פריים נמוך עם מסחר מורחב (התנודה בגלל הדוח), ו«פרטים».
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
const CHART_HEIGHT = 260;

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

function fmtEps(n: number | null): string {
  return n == null ? '—' : `$${n.toFixed(2)}`;
}

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

  const chartHtml = useMemo(
    () => getTradingViewEarningsChartHTML(symbol, report.report_date, isDarkMode),
    [symbol, report.report_date, isDarkMode],
  );

  const toneColor = (pct: number | null) =>
    pct == null || Math.abs(pct) < 0.05
      ? tokens.colors.text.primary
      : pct > 0
        ? tokens.colors.primary.main
        : tokens.colors.danger.main;

  const quarter =
    report.period || report.period_year
      ? [report.period, report.period_year].filter(Boolean).join(' ')
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <DayNavBlurButton
            glass
            glassIntensity="light"
            onPress={onClose}
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="סגור"
          >
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

        <View style={styles.heroRow}>
          {timing ? (
            <View style={[styles.timingChip, { backgroundColor: tokens.colors.background.cardSolid }]}>
              <Ionicons name={timing.icon} size={15} color={timing.color} />
              <Text style={styles.timingText}>{timing.label}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.identityRow}>
            <TickerLogo symbol={symbol} size={48} borderRadius={24} />
            <View style={styles.identityText}>
              <Text style={styles.identityTicker} numberOfLines={1}>
                {`⁦$${symbol}⁩`}
              </Text>
              {company ? (
                <Text style={styles.companyName} numberOfLines={1}>
                  {company}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.groupHeading}>{reported ? 'תוצאות' : 'צפי'}</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none">
            <ValueRow
              icon="stats-chart-outline"
              label="רווח למניה"
              value={reported ? fmtEps(epsActual) : fmtEps(epsEst)}
              valueColor={reported ? toneColor(epsPct) : undefined}
              pct={reported ? epsPct : null}
              sub={reported && epsEst != null ? `צפי ${fmtEps(epsEst)}` : undefined}
              showDivider
            />
            <ValueRow
              icon="cash-outline"
              label="הכנסות"
              value={reported ? fmtRevenue(revActual) : fmtRevenue(revEst)}
              valueColor={reported ? toneColor(revPct) : undefined}
              pct={reported ? revPct : null}
              sub={reported && revEst != null ? `צפי ${fmtRevenue(revEst)}` : undefined}
              showDivider={false}
            />
          </UICard>
        </View>

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
          <Text style={styles.groupHeading}>פרטים</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none">
            <ValueRow icon="calendar-outline" label="תאריך הדיווח" value={dateLabel(report.report_date)} showDivider />
            <ValueRow
              icon="time-outline"
              label="מועד"
              value={timing?.label ?? 'טרם נקבע'}
              showDivider={!!quarter}
            />
            {quarter ? <ValueRow icon="layers-outline" label="רבעון" value={quarter} showDivider={false} /> : null}
          </UICard>
        </View>
      </ScrollView>
    </View>
  );
}

/** שורה כמו ב«נתוני היום» בשיט המניה: אייקון, כותרת, ערך (צבע + אחוז הפתעה + צפי מתחת) */
function ValueRow({
  icon,
  label,
  value,
  valueColor,
  pct,
  sub,
  showDivider,
}: {
  icon: IonName;
  label: string;
  value: string;
  valueColor?: string;
  pct?: number | null;
  sub?: string;
  showDivider: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.valueCol}>
          <View style={styles.valueLine}>
            {pct != null ? (
              <Text style={[styles.pct, { color: valueColor ?? tokens.colors.text.secondary }]}>
                {pct > 0 ? '+' : ''}
                {pct.toFixed(1)}%
              </Text>
            ) : null}
            <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
              {value}
            </Text>
          </View>
          {sub ? (
            <Text style={styles.sub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        <View style={styles.labelCol}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.leadingIcon}>
          <Ionicons name={icon} size={20} color={tokens.colors.text.primary} />
        </View>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

function useStyles() {
  const tokens = useDesignTokens();
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, minHeight: 0 },
        header: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 10,
          paddingBottom: APP_LAYOUT.stackGapSmall,
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        topBar: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HEADER_BACK_BTN_SIZE,
        },
        topSpacer: { flex: 1 },
        heroRow: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: APP_LAYOUT.componentGap,
          marginBottom: APP_LAYOUT.stackGapSmall,
        },
        identityRow: {
          flex: 1,
          minWidth: 0,
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        identityText: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
        identityTicker: {
          fontSize: APP_TYPE.sectionTitle.fontSize,
          lineHeight: APP_TYPE.sectionTitle.lineHeight,
          fontWeight: APP_TYPE.sectionTitle.fontWeight,
          letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        companyName: {
          ...appPhysicalLeftText,
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: APP_TYPE.cardSubtitle.fontSize,
          lineHeight: APP_TYPE.cardSubtitle.lineHeight,
          fontWeight: APP_TYPE.cardSubtitle.fontWeight,
          color: tokens.colors.text.secondary,
        },
        timingChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
        },
        timingText: {
          ...APP_TYPE.caption,
          color: tokens.colors.text.primary,
          writingDirection: 'rtl',
        },
        scroll: { flex: 1, minHeight: 0 },
        scrollContent: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 8,
          gap: APP_LAYOUT.cardStackGap,
        },
        chartCard: {
          overflow: 'hidden',
          borderRadius: tokens.borderRadius.xl,
        },
        groupHeading: {
          ...appGroupLabelStyle,
          color: tokens.colors.text.secondary,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          paddingHorizontal: APP_LAYOUT.cardPadding,
        },
        labelCol: { flex: 1, minWidth: 0 },
        label: {
          ...appCardTitleStyle,
          color: tokens.colors.text.primary,
        },
        leadingIcon: {
          marginLeft: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        valueCol: {
          maxWidth: '58%',
          alignItems: 'flex-start',
        },
        valueLine: {
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'baseline',
        },
        value: {
          ...appCardBodyStyle,
          width: undefined,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        pct: {
          ...APP_TYPE.caption,
          marginRight: 6,
          fontVariant: ['tabular-nums'],
        },
        sub: {
          ...APP_TYPE.caption,
          marginTop: 2,
          color: tokens.colors.text.secondary,
          writingDirection: 'rtl',
          textAlign: 'left',
        },
        divider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
          marginHorizontal: APP_LAYOUT.cardPadding,
        },
      }),
    [tokens],
  );
}
