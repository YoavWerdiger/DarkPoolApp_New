import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CreditCard, KeyRound, LifeBuoy, Users } from 'lucide-react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { SettingsActionRow } from '../../components/profile/ProfileSettingsUI';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  AdminSectionLabel,
  AdminLoadingState,
  AdminErrorState,
  AdminDeniedState,
  AdminSurface,
  adminScreenPad,
} from '../../components/admin';
import {
  adminCardSubtitle,
  adminCardTitle,
  adminMetric,
  adminPhysicalRightText,
} from '../../components/admin/adminType';
import { APP_TYPE } from '../../components/ui/appType';
import {
  adminService,
  type AdminGrowthPoint,
  type AdminStats,
} from '../../services/admin';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const CHART_H = 176;
const CHART_DAYS = 30;

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

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await adminService.getStats({ days: CHART_DAYS });
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      void load();
    } else if (!adminLoading && !isAdmin) {
      setLoading(false);
    }
  }, [adminLoading, isAdmin, load]);

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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={adminScreenPad}
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
        <AdminSurface padding="md">
          <View style={styles.metricBlock}>
            <Text style={[styles.metricLabel, { color: tokens.colors.text.primary }]}>
              סה״כ משתמשים
            </Text>
            <Text style={[styles.metricSubtitle, { color: tokens.colors.text.secondary }]}>
              30 הימים האחרונים
            </Text>
            <Text style={[styles.metricValue, { color: tokens.colors.text.primary }]}>
              {totalUsers.toLocaleString('he-IL')}
            </Text>
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
                gridColor={tokens.colors.border.divider}
                dotColor={tokens.colors.primary.lighter}
                labelColor={tokens.colors.text.tertiary}
              />
            ) : (
              <View style={styles.chartPlaceholder} />
            )}
          </View>
        </AdminSurface>

        <AdminSurface>
          <SettingsActionRow
            title="ניהול משתמשים"
            icon={Users}
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminUsers');
            }}
          />
          <SettingsActionRow
            title="בקרת תשלומים ומנויים"
            icon={CreditCard}
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminPayments');
            }}
          />
          <SettingsActionRow
            title="הגדרות CardCom"
            icon={KeyRound}
            showDivider={false}
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminCardCom');
            }}
          />
        </AdminSurface>

        <AdminSectionLabel>תקשורת ותמיכה</AdminSectionLabel>
        <AdminSurface>
          <SettingsActionRow
            title="שליחת פוש"
            icon={Bell}
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminPush');
            }}
          />
          <SettingsActionRow
            title="פניות תמיכה"
            icon={LifeBuoy}
            showDivider={false}
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.navigate('AdminTickets');
            }}
          />
        </AdminSurface>
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
            fontSize={APP_TYPE.caption2.fontSize}
            textAnchor={anchor}
          >
            {formatShortHeDate(point.date)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  metricBlock: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: APP_LAYOUT.cardTitleToBodyGap,
  },
  metricLabel: {
    ...adminPhysicalRightText,
    ...adminCardTitle,
  },
  metricValue: {
    ...adminPhysicalRightText,
    ...adminMetric,
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    fontVariant: ['tabular-nums'],
  },
  metricSubtitle: {
    ...adminPhysicalRightText,
    ...adminCardSubtitle,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
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
});
