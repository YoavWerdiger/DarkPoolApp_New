import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Line, Rect, Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import UICard from '../../components/ui/UICard';
import type { Trade } from './TradesListTab';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { BRANDFETCH_CLIENT_ID } from '../../config/publicEnv';

function sortTradesByExitAsc(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.exit_date).getTime() - new Date(b.exit_date).getTime()
  );
}

/** נקודות צבירת P&L לפי סדר כרונולוגי של יציאה מהעסקה — מהמסד בלבד */
function cumulativeSeries(trades: Trade[]): { exitISO: string; cum: number }[] {
  const sorted = sortTradesByExitAsc(trades);
  let cum = 0;
  return sorted.map((t) => {
    cum += t.pnl;
    return { exitISO: t.exit_date, cum };
  });
}

/** סיכום P&L לפי חודש (שנה-חודש מ-exit_date) */
function monthlyPnl(trades: Trade[]): { key: string; label: string; pnl: number }[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.exit_date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + t.pnl);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pnl]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('he-IL', {
        month: 'short',
        year: '2-digit',
      });
      return { key, label, pnl };
    });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type ChartColors = {
  line: string;
  grid: string;
  zero: string;
  pos: string;
  neg: string;
  label: string;
};

type PerfTile = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  /** סימבול ללוגו מ־Brandfetch CDN (כשהוגדר מפתח ציבורי) */
  logoSymbol?: string;
};

function StatTileLeading({ tile, accent }: { tile: PerfTile; accent: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const uri =
    tile.logoSymbol && !imgFailed ? brandfetchTickerLogoUri(tile.logoSymbol) : null;

  return (
    <View
      style={[
        styles.statIconWrap,
        {
          backgroundColor: uri ? `${accent}14` : `${accent}22`,
          overflow: 'hidden',
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.statLogoImage}
          contentFit="cover"
          transition={160}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Ionicons name={tile.icon} size={20} color={accent} />
      )}
    </View>
  );
}

function JournalSymbolLogoChip({
  symbol,
  labelColor,
}: {
  symbol: string;
  labelColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;

  return (
    <View style={styles.symbolChip}>
      <View style={styles.symbolChipLogoBox}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.symbolChipImage}
            contentFit="cover"
            transition={160}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={[styles.symbolChipFallback, { color: labelColor }]} numberOfLines={1}>
            {symbol.slice(0, 4)}
          </Text>
        )}
      </View>
      <Text style={[styles.symbolChipLabel, { color: labelColor }]} numberOfLines={1}>
        {symbol}
      </Text>
    </View>
  );
}

function JournalPerformanceTile({
  tile,
  width,
  textPrimary,
  textSecondary,
  textTertiary,
}: {
  tile: PerfTile;
  width: number;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}) {
  return (
    <View style={{ width }}>
      <UICard variant="blur" padding="sm" style={styles.statCardOuter}>
        <View style={styles.statCardRow}>
          <StatTileLeading tile={tile} accent={tile.accent} />
          <View style={styles.statCardTextCol}>
            <Text style={[styles.statCardTitle, { color: textSecondary }]} numberOfLines={2}>
              {tile.title}
            </Text>
            <Text
              style={[styles.statCardValue, { color: textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {tile.value}
            </Text>
            {tile.subtitle ? (
              <Text style={[styles.statCardSubtitle, { color: textTertiary }]} numberOfLines={1}>
                {tile.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </UICard>
    </View>
  );
}

function CumulativePnlChart({
  series,
  chartW,
  colors,
}: {
  series: { exitISO: string; cum: number }[];
  chartW: number;
  colors: ChartColors;
}) {
  const H = 200;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = Math.max(1, chartW - padL - padR);
  const innerH = H - padT - padB;

  if (series.length === 0) return null;

  const values = series.map((s) => s.cum);
  let minV = Math.min(0, ...values);
  let maxV = Math.max(0, ...values);
  let range = maxV - minV;
  if (range < 1e-9) {
    minV -= 1;
    maxV += 1;
    range = maxV - minV;
  }

  const n = values.length;
  const coords = values.map((v, i) => {
    const x = n <= 1 ? padL + innerW / 2 : padL + (i / Math.max(1, n - 1)) * innerW;
    const y = padT + innerH - ((v - minV) / range) * innerH;
    return { x, y, v };
  });

  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const zeroY = padT + innerH - ((0 - minV) / range) * innerH;
  const showZero = zeroY >= padT && zeroY <= padT + innerH;

  return (
    <View style={{ width: chartW }}>
      <Svg width={chartW} height={H}>
        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke={colors.grid}
          strokeWidth={1}
        />
        <Line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          stroke={colors.grid}
          strokeWidth={1}
        />
        {showZero ? (
          <Line
            x1={padL}
            y1={zeroY}
            x2={padL + innerW}
            y2={zeroY}
            stroke={colors.zero}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ) : null}
        {n > 1 ? (
          <Polyline points={pointsStr} fill="none" stroke={colors.line} strokeWidth={2.5} />
        ) : (
          <Circle cx={coords[0].x} cy={coords[0].y} r={5} fill={colors.line} />
        )}
      </Svg>
      <View style={styles.chartLegendRow}>
        <Text style={[styles.axisHint, { color: colors.label }]}>${formatMoney(minV)}</Text>
        <Text style={[styles.axisHint, { color: colors.label }]}>${formatMoney(maxV)}</Text>
      </View>
    </View>
  );
}

function MonthlyBarChart({
  months,
  chartW,
  colors,
}: {
  months: { key: string; label: string; pnl: number }[];
  chartW: number;
  colors: ChartColors;
}) {
  const H = 200;
  const padL = 36;
  const padB = 36;
  const innerW = Math.max(1, chartW - padL - 8);
  const innerH = H - padB - 16;

  const slice = months.slice(-8);
  if (slice.length === 0) return null;

  const maxAbs = Math.max(...slice.map((m) => Math.abs(m.pnl)), 1e-6);
  const n = slice.length;
  const gap = 6;
  const barW = (innerW - gap * (n - 1)) / n;
  const zeroY = 16 + innerH / 2;

  return (
    <View style={{ width: chartW }}>
      <Svg width={chartW} height={H}>
        <Line
          x1={padL}
          y1={zeroY}
          x2={chartW - 8}
          y2={zeroY}
          stroke={colors.zero}
          strokeWidth={1}
        />
        {slice.map((m, i) => {
          const x = padL + i * (barW + gap);
          const half = innerH / 2 - 4;
          const h = Math.max((Math.abs(m.pnl) / maxAbs) * half, m.pnl !== 0 ? 3 : 0);
          const isPos = m.pnl >= 0;
          const fill = isPos ? colors.pos : colors.neg;
          if (isPos) {
            return (
              <Rect key={m.key} x={x} y={zeroY - h} width={barW} height={h} rx={3} fill={fill} />
            );
          }
          return <Rect key={m.key} x={x} y={zeroY} width={barW} height={h} rx={3} fill={fill} />;
        })}
      </Svg>
      <View
        style={{
          flexDirection: 'row-reverse',
          width: chartW,
          paddingLeft: padL,
          paddingRight: 8,
          marginTop: 4,
          gap,
        }}
      >
        {slice.map((m) => (
          <Text
            key={m.key}
            style={{ width: barW, fontSize: 10, color: colors.label, textAlign: 'center' }}
            numberOfLines={1}
          >
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function JournalDataTab() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const { width: windowW } = useWindowDimensions();
  const mainTabsHeight = useMainTabsHeight();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const chartW = Math.min(windowW - 40, 400);
  const statsInnerW = windowW - 40;
  const statsGap = 10;
  const statTileW = Math.max(140, (statsInnerW - statsGap) / 2);

  const loadTrades = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('exit_date', { ascending: false });
      if (error) throw error;
      setTrades(data || []);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadTrades();
    }, [loadTrades])
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const performanceTiles: PerfTile[] = useMemo(() => {
    if (trades.length === 0) return [];
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const isTotalProfit = totalPnl >= 0;
    const avg = totalPnl / trades.length;
    const winning = trades.filter((t) => t.pnl > 0);
    const losing = trades.filter((t) => t.pnl < 0);
    const wins = winning.length;
    const winRate = Math.round((wins / trades.length) * 100);
    const avgWin = wins ? winning.reduce((s, t) => s + t.pnl, 0) / wins : 0;
    const avgLoss = losing.length ? losing.reduce((s, t) => s + t.pnl, 0) / losing.length : 0;
    const grossProfit = winning.reduce((s, t) => s + t.pnl, 0);
    const grossLossAbs = Math.abs(losing.reduce((s, t) => s + t.pnl, 0));
    let profitFactorLabel = '—';
    if (grossLossAbs < 1e-9) {
      profitFactorLabel = grossProfit > 0 ? '∞' : '—';
    } else {
      profitFactorLabel = (grossProfit / grossLossAbs).toFixed(2);
    }
    let best = trades[0];
    let worst = trades[0];
    for (const t of trades) {
      if (t.pnl > best.pnl) best = t;
      if (t.pnl < worst.pnl) worst = t;
    }
    const longCount = trades.filter((t) => t.direction === 'long').length;
    const shortCount = trades.length - longCount;

    return [
      {
        id: 'total-trades',
        title: 'סה״כ טריידים',
        value: String(trades.length),
        subtitle: `${longCount} לונג · ${shortCount} שורט`,
        icon: 'layers-outline',
        accent: DesignTokens.colors.primary.main,
      },
      {
        id: 'total-pnl',
        title: 'P&L כולל',
        value: `$${formatCurrency(totalPnl)}`,
        subtitle: isTotalProfit ? 'רווח נטו' : 'הפסד נטו',
        icon: isTotalProfit ? 'trending-up' : 'trending-down',
        accent: isTotalProfit ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger,
      },
      {
        id: 'win-rate',
        title: 'אחוז ניצחונות',
        value: `${winRate}%`,
        subtitle: `${wins} רווח · ${losing.length} הפסד`,
        icon: 'ribbon-outline',
        accent: DesignTokens.colors.primary.main,
      },
      {
        id: 'avg-trade',
        title: 'ממוצע לעסקה',
        value: `$${formatCurrency(avg)}`,
        subtitle: 'P&L ממוצע',
        icon: 'analytics-outline',
        accent: avg >= 0 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger,
      },
      {
        id: 'avg-win',
        title: 'ממוצע ברווח',
        value: wins ? `$${formatCurrency(avgWin)}` : '—',
        subtitle: wins ? `${wins} עסקאות` : 'אין רווחים',
        icon: 'arrow-up-circle-outline',
        accent: DesignTokens.colors.primary.main,
      },
      {
        id: 'avg-loss',
        title: 'ממוצע בהפסד',
        value: losing.length ? `$${formatCurrency(avgLoss)}` : '—',
        subtitle: losing.length ? `${losing.length} עסקאות` : 'אין הפסדים',
        icon: 'arrow-down-circle-outline',
        accent: DesignTokens.colors.text.danger,
      },
      {
        id: 'profit-factor',
        title: 'יחס רווח/הפסד',
        value: profitFactorLabel,
        subtitle: 'סה״כ רווחים / סה״כ הפסדים',
        icon: 'scale-outline',
        accent: DesignTokens.colors.text.secondary,
      },
      {
        id: 'best',
        title: 'הטרייד הטוב ביותר',
        value: `$${formatCurrency(best.pnl)}`,
        subtitle: best.symbol,
        icon: 'trophy-outline',
        accent: DesignTokens.colors.primary.main,
        logoSymbol: best.symbol,
      },
      {
        id: 'worst',
        title: 'הטרייד הגרוע ביותר',
        value: `$${formatCurrency(worst.pnl)}`,
        subtitle: worst.symbol,
        icon: 'warning-outline',
        accent: DesignTokens.colors.text.danger,
        logoSymbol: worst.symbol,
      },
    ];
  }, [trades, DesignTokens]);

  const symbolsByActivity = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) {
      const s = t.symbol.trim().toUpperCase();
      if (!s) continue;
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([sym]) => sym);
  }, [trades]);

  const cumSeries = useMemo(() => cumulativeSeries(trades), [trades]);
  const monthSeries = useMemo(() => monthlyPnl(trades), [trades]);

  const chartColors: ChartColors = useMemo(
    () => ({
      line: DesignTokens.colors.primary.main,
      grid: DesignTokens.colors.border.primary,
      zero: 'rgba(255,255,255,0.25)',
      pos: DesignTokens.colors.primary.main,
      neg: DesignTokens.colors.text.danger,
      label: DesignTokens.colors.text.tertiary,
    }),
    [DesignTokens]
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={[styles.loadingText, { color: DesignTokens.colors.text.secondary }]}>
          טוען נתונים...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: mainTabsHeight + 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces
    >
      {trades.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: DesignTokens.colors.text.primary }]}>
            אין עדיין טריידים
          </Text>
          <Text style={[styles.emptyHint, { color: DesignTokens.colors.text.tertiary }]}>
            הוסף טריידים ביומן — הגרפים והביצועים יחושבו אוטומטית מהמסד.
          </Text>
        </View>
      ) : (
        <>
          {performanceTiles.length > 0 ? (
            <View style={styles.statsBlock}>
              <Text style={[styles.sectionHeading, { color: DesignTokens.colors.text.primary }]}>
                סיכום ביצועים
              </Text>
              <View style={[styles.statsGrid, { gap: statsGap }]}>
                {performanceTiles.map((tile) => (
                  <JournalPerformanceTile
                    key={tile.id}
                    tile={tile}
                    width={statTileW}
                    textPrimary={DesignTokens.colors.text.primary}
                    textSecondary={DesignTokens.colors.text.secondary}
                    textTertiary={DesignTokens.colors.text.tertiary}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {symbolsByActivity.length > 0 ? (
            <View style={styles.symbolStripBlock}>
              <Text style={[styles.sectionHeading, { color: DesignTokens.colors.text.primary }]}>
                לוגואי נכסים
              </Text>
              {!BRANDFETCH_CLIENT_ID ? (
                <Text
                  style={[styles.brandfetchHint, { color: DesignTokens.colors.text.tertiary }]}
                >
                  הגדר EXPO_PUBLIC_BRANDFETCH_CLIENT_ID ב־.env כדי לטעון לוגואים מ־Brandfetch CDN.
                </Text>
              ) : null}
              <View style={[styles.symbolChipWrap, { gap: statsGap }]}>
                {symbolsByActivity.map((sym) => (
                  <JournalSymbolLogoChip
                    key={sym}
                    symbol={sym}
                    labelColor={DesignTokens.colors.text.secondary}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <UICard variant="blur" padding="md" style={styles.chartCard}>
            <Text style={[styles.chartTitle, { color: DesignTokens.colors.text.primary }]}>
              צבירת P&L
            </Text>
            <Text style={[styles.chartSubtitle, { color: DesignTokens.colors.text.secondary }]}>
              לפי תאריך יציאה מהעסקה (כרונולוגי)
            </Text>
            <CumulativePnlChart series={cumSeries} chartW={chartW} colors={chartColors} />
          </UICard>

          <UICard variant="blur" padding="md" style={styles.chartCard}>
            <Text style={[styles.chartTitle, { color: DesignTokens.colors.text.primary }]}>
              P&L חודשי
            </Text>
            <Text style={[styles.chartSubtitle, { color: DesignTokens.colors.text.secondary }]}>
              סיכום לפי חודש יציאה (עד 8 חודשים אחרונים עם נתונים)
            </Text>
            {monthSeries.length > 0 ? (
              <MonthlyBarChart months={monthSeries} chartW={chartW} colors={chartColors} />
            ) : (
              <Text style={{ color: DesignTokens.colors.text.tertiary, textAlign: 'center' }}>
                אין מספיק נתונים לפי חודש
              </Text>
            )}
          </UICard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    minHeight: 200,
  },
  loadingText: {
    fontSize: 14,
  },
  empty: {
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsBlock: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  statCardOuter: {
    borderRadius: 14,
    minHeight: 96,
  },
  statCardRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLogoImage: {
    width: 40,
    height: 40,
  },
  symbolStripBlock: {
    marginBottom: 14,
  },
  brandfetchHint: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
    marginBottom: 8,
  },
  symbolChipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  symbolChip: {
    alignItems: 'center',
    width: 72,
    gap: 4,
  },
  symbolChipLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  symbolChipImage: {
    width: 44,
    height: 44,
  },
  symbolChipFallback: {
    fontSize: 11,
    fontWeight: '700',
  },
  symbolChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  statCardTextCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
  statCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statCardValue: {
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    letterSpacing: -0.4,
  },
  statCardSubtitle: {
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  chartCard: {
    marginBottom: 12,
    borderRadius: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chartSubtitle: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
    marginTop: 4,
  },
  chartLegendRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  axisHint: {
    fontSize: 11,
  },
});
