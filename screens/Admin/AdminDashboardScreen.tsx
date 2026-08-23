import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import UICard from '../../components/ui/UICard';
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminLoadingState,
  AdminErrorState,
  AdminDeniedState,
} from '../../components/admin';
import {
  adminService,
  type AdminGrowthPoint,
  type AdminStats,
  type AdminStatsBucket,
} from '../../services/admin';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const CHART_H = 176;
type ChartDays = 7 | 30 | 90;

const INTERVAL_OPTIONS: { days: ChartDays; label: string }[] = [
  { days: 7, label: '7 ימים' },
  { days: 30, label: '30 ימים' },
  { days: 90, label: '90 ימים' },
];

function formatIls(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `₪${n.toLocaleString('he-IL')}`;
}

function formatShortHeDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = Number(parts[2]);
  const month = Number(parts[1]);
  if (!Number.isFinite(day) || !Number.isFinite(month)) return dateStr;
  return `${day}.${month}`;
}

function labelIndexes(n: number, maxLabels: number): number[] {
  if (n <= 0) return [];
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (maxLabels - 1));
  const idxs: number[] = [];
  for (let i = 0; i < n; i += step) idxs.push(i);
  if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
  return idxs;
}

export default function AdminDashboardScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [chartDays, setChartDays] = useState<ChartDays>(30);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await adminService.getStats({ days: chartDays });
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartDays]);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      void load();
    } else if (!adminLoading && !isAdmin) {
      setLoading(false);
    }
  }, [adminLoading, isAdmin, load]);

  const onChangeInterval = (days: ChartDays) => {
    if (days === chartDays) return;
    setChartDays(days);
  };

  const header = (
    <ChatSubScreenHeader
      title="פאנל מנהלים"
      onBack={() => {
        void HapticFeedback.impactLight();
        navigation.goBack();
      }}
    />
  );

  if (adminLoading || loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminLoadingState label="טוען פאנל מנהלים..." />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminDeniedState />
      </SafeAreaView>
    );
  }

  const series = stats?.growthSeries ?? [];
  const totalUsers = stats?.totals?.users ?? 0;
  // תפקיד/מסלול גישה (חינמי / פרימיום / מנהל…) — ברור יותר מ־plan id גולמי
  const planBuckets: AdminStatsBucket[] =
    (stats?.byRole && stats.byRole.length > 0 ? stats.byRole : stats?.byPlan) ?? [];
  const monthRevenue = stats?.revenue?.month ?? 0;
  const plansLine =
    planBuckets.length > 0
      ? planBuckets.map((b) => `${b.label} ${b.count.toLocaleString('he-IL')}`).join(' · ')
      : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.base,
          paddingTop: tokens.spacing.sm,
          paddingBottom: 48,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={tokens.colors.primary.main}
          />
        }
      >
        {error ? (
          <AdminErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        ) : null}

        <AdminSectionLabel>מדדים</AdminSectionLabel>
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="md"
          style={{
            borderRadius: tokens.borderRadius.xl,
            borderWidth: 1,
            borderColor: chatPalette.glassBorder,
            marginBottom: tokens.spacing.md,
          }}
        >
          <View style={styles.totalBlock}>
            <Text style={[styles.totalValue, { color: tokens.colors.text.primary }]}>
              {totalUsers.toLocaleString('he-IL')}
            </Text>
            <Text style={[styles.totalLabel, { color: tokens.colors.text.tertiary }]}>
              סה״כ משתמשים
            </Text>
          </View>

          <View style={styles.intervalRow}>
            {INTERVAL_OPTIONS.map((opt) => (
              <AdminFilterChip
                key={opt.days}
                label={opt.label}
                active={chartDays === opt.days}
                onPress={() => onChangeInterval(opt.days)}
              />
            ))}
          </View>

          <View
            style={styles.chartCanvas}
            onLayout={(e: LayoutChangeEvent) => {
              const w = Math.floor(e.nativeEvent.layout.width);
              if (w > 0 && w !== chartWidth) setChartWidth(w);
            }}
          >
            {chartWidth > 0 && series.length > 0 ? (
              <GrowthLineChart
                series={series}
                width={chartWidth}
                lineColor={tokens.colors.primary.main}
                gridColor="rgba(255,255,255,0.05)"
                dotColor={tokens.colors.primary.lighter}
                labelColor={tokens.colors.text.tertiary}
              />
            ) : (
              <View style={styles.chartPlaceholder} />
            )}
          </View>

          <View
            style={[styles.stripDivider, { backgroundColor: tokens.colors.border.divider }]}
          />

          <View style={styles.metricsFooter}>
            {plansLine ? (
              <Text
                style={[styles.metricsFooterText, { color: tokens.colors.text.secondary }]}
                numberOfLines={1}
              >
                {plansLine}
              </Text>
            ) : null}
            <Text
              style={[styles.metricsFooterText, { color: tokens.colors.text.secondary }]}
              numberOfLines={1}
            >
              הכנסות החודש {formatIls(monthRevenue)}
            </Text>
          </View>
        </UICard>

        <AdminSectionLabel>משתמשים וחיובים</AdminSectionLabel>
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={{
            borderRadius: tokens.borderRadius.xl,
            borderWidth: 1,
            borderColor: chatPalette.glassBorder,
            marginBottom: tokens.spacing.md,
          }}
        >
          <ActionRow
            title="ניהול משתמשים"
            subtitle="חיפוש, פרימיום, השעיה ומחיקה"
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminUsers');
            }}
          />
          <View
            style={[styles.actionDivider, { backgroundColor: tokens.colors.border.divider }]}
          />
          <ActionRow
            title="בקרת תשלומים ומנויים"
            subtitle="היסטוריית תשלומים, מנויים פעילים וחיובים קרובים"
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminPayments');
            }}
          />
        </UICard>

        <AdminSectionLabel>תקשורת ותמיכה</AdminSectionLabel>
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={{
            borderRadius: tokens.borderRadius.xl,
            borderWidth: 1,
            borderColor: chatPalette.glassBorder,
          }}
        >
          <ActionRow
            title="שליחת פוש"
            subtitle="הודעה מותאמת לקהל יעד"
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminPush');
            }}
          />
          <View
            style={[styles.actionDivider, { backgroundColor: tokens.colors.border.divider }]}
          />
          <ActionRow
            title="פניות תמיכה"
            subtitle="תיבת טיקטים מהמשתמשים"
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminTickets');
            }}
          />
        </UICard>
      </ScrollView>
    </SafeAreaView>
  );
}

function GrowthLineChart({
  series,
  width,
  lineColor,
  gridColor,
  dotColor,
  labelColor,
}: {
  series: AdminGrowthPoint[];
  width: number;
  lineColor: string;
  gridColor: string;
  dotColor: string;
  labelColor: string;
}) {
  const H = CHART_H;
  const padL = 4;
  const padR = 4;
  const padT = 12;
  const padB = 28;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = H - padT - padB;
  const values = series.map((p) => p.count);
  // סקאלה לפי טווח הסדרה (לא מ־0) כדי שהעלייה בחלון תהיה קריאה
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, maxV - minV);
  const n = values.length;
  const coords = values.map((v, i) => {
    const x = n <= 1 ? padL + innerW / 2 : padL + (i / Math.max(1, n - 1)) * innerW;
    const y = padT + innerH - ((v - minV) / span) * innerH;
    return { x, y };
  });
  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const maxLabels = n <= 7 ? n : n <= 30 ? 5 : 6;
  const tickIdx = labelIndexes(n, maxLabels);

  return (
    <Svg width={width} height={H}>
      <Line
        x1={padL}
        y1={padT + innerH}
        x2={padL + innerW}
        y2={padT + innerH}
        stroke={gridColor}
        strokeWidth={1}
      />
      {n > 1 ? (
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={3}
          strokeOpacity={0.7}
        />
      ) : null}
      {last ? (
        <Circle cx={last.x} cy={last.y} r={3} fill={dotColor} fillOpacity={0.55} />
      ) : null}
      {tickIdx.map((i) => {
        const c = coords[i];
        const point = series[i];
        if (!c || !point) return null;
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        return (
          <SvgText
            key={`${point.date}-${i}`}
            x={c.x}
            y={H - 6}
            fill={labelColor}
            fontSize={10}
            textAnchor={anchor}
          >
            {formatShortHeDate(point.date)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const ty = DesignTokens.typography;

function ActionRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const tokens = useDesignTokens();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.actionRow}>
      <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: tokens.colors.text.primary }]}>{title}</Text>
        <Text style={[styles.actionSub, { color: tokens.colors.text.tertiary }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  totalBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  totalValue: {
    fontSize: 34,
    fontWeight: ty.fontWeight.bold,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  totalLabel: {
    marginTop: 2,
    fontSize: ty.caption.size,
    fontWeight: ty.fontWeight.semibold,
    lineHeight: ty.caption.lineHeight,
    textAlign: 'center',
  },
  intervalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chartCanvas: {
    width: '100%',
    height: CHART_H,
    overflow: 'hidden',
  },
  chartPlaceholder: {
    width: '100%',
    height: CHART_H,
  },
  stripDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 12,
  },
  metricsFooter: {
    alignItems: 'center',
    gap: 6,
  },
  metricsFooterText: {
    fontSize: ty.footnote.size,
    fontWeight: ty.fontWeight.medium,
    lineHeight: ty.footnote.lineHeight,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionText: {
    flex: 1,
    marginStart: 12,
  },
  actionTitle: {
    fontSize: ty.body.size,
    fontWeight: ty.fontWeight.bold,
    lineHeight: ty.body.lineHeight,
    ...DesignTokens.rtlText,
  },
  actionSub: {
    fontSize: ty.footnote.size,
    lineHeight: ty.footnote.lineHeight,
    marginTop: 3,
    ...DesignTokens.rtlText,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
