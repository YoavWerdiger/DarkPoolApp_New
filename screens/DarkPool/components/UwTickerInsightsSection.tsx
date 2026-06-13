import React, { useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { useUwTickerInsights } from '../../../hooks/useUwTickerInsights';
import { formatUsdCompact } from '../utils/darkPoolFormat';
import { DarkPoolSectionHeader } from './DarkPoolSectionHeader';
import { UwRateLimitBanner } from './UwRateLimitBanner';

interface Props {
  ticker: string;
}

export function UwTickerInsightsSection({ ticker }: Props) {
  const tokens = useDesignTokens();
  const { data, loading, error } = useUwTickerInsights(ticker);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (loading && !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={tokens.colors.primary.main} />
        <Text style={styles.loaderText}>טוען תובנות…</Text>
      </View>
    );
  }

  if (error && !data) return null;
  if (!data) return null;

  const hasContent =
    !!data.gex ||
    data.flow_alerts.length > 0 ||
    data.insider_live.length > 0 ||
    data.news.length > 0 ||
    !!data.cluster_signal ||
    !!data.insider_sentiment ||
    !!data.form4_company;

  if (!hasContent) return null;

  const sentimentTone =
    data.insider_sentiment == null
      ? 'default'
      : data.insider_sentiment.score >= 0.2
        ? 'positive'
        : data.insider_sentiment.score <= -0.2
          ? 'negative'
          : 'default';

  return (
    <View style={styles.wrap}>
      <UwRateLimitBanner warnings={data.warnings} />

      {(data.insider_sentiment || data.cluster_signal) && (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.summaryCard}>
          <DarkPoolSectionHeader title="סיכום פעילות" icon="pulse-outline" />
          <View style={styles.summaryGrid}>
            {data.insider_sentiment ? (
              <SummaryCell
                label="סנטימנט בכירים"
                value={data.insider_sentiment.score.toFixed(2)}
                hint={`${data.insider_sentiment.buy_count} רכ · ${data.insider_sentiment.sell_count} מכ`}
                tone={sentimentTone}
                styles={styles}
              />
            ) : null}
            {data.cluster_signal ? (
              <SummaryCell
                label="אות מרוכז"
                value={
                  data.cluster_signal.is_cluster_buy
                    ? 'רכישות'
                    : data.cluster_signal.is_cluster_sell
                      ? 'מכירות'
                      : 'מעורב'
                }
                hint={`${data.cluster_signal.insider_count} בכירים · ${data.cluster_signal.date}`}
                styles={styles}
              />
            ) : null}
            {data.form4_company ? (
              <SummaryCell
                label="בכירים פעילים"
                value={String(data.form4_company.active_insiders)}
                hint={data.form4_company.sector || undefined}
                styles={styles}
              />
            ) : null}
          </View>
        </UICard>
      )}

      {data.gex ? (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
          <DarkPoolSectionHeader title="מדד GEX" subtitle="חשיפת גמא בסpot" icon="analytics-outline" />
          <Text style={styles.metricValue}>{data.gex.label}</Text>
          <Text style={styles.metricHint}>
            {data.gex.strike_count} strikes · {formatCompactNum(Math.abs(data.gex.net_gamma))} γ
          </Text>
        </UICard>
      ) : null}

      {data.flow_alerts.length > 0 ? (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
          <DarkPoolSectionHeader title="זרימת אופציות" icon="flash-outline" />
          {data.flow_alerts.map((f, i) => (
            <View
              key={f.id}
              style={[styles.listRow, i === data.flow_alerts.length - 1 && styles.listRowLast]}
            >
              <Text style={styles.rowTitle}>
                {f.type === 'put' ? 'פוט' : 'קול'} · {formatUsdCompact(f.premium)}
              </Text>
              <Text style={styles.rowHint}>{f.rule}</Text>
            </View>
          ))}
        </UICard>
      ) : null}

      {data.insider_live.length > 0 ? (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
          <DarkPoolSectionHeader title="עסקאות בכירים" icon="people-outline" />
          {data.insider_live.map((row, i) => (
            <View
              key={row.id}
              style={[
                styles.insiderRow,
                i === data.insider_live.length - 1 && styles.listRowLast,
              ]}
            >
              {row.logo_url ? (
                <Image source={{ uri: row.logo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFb]}>
                  <Ionicons name="person" size={14} color={tokens.colors.text.tertiary} />
                </View>
              )}
              <View style={styles.insiderText}>
                <Text style={styles.rowTitle}>{row.owner_name}</Text>
                <Text style={styles.rowHint}>
                  {[row.txn_label, row.amount_label, row.date].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </UICard>
      ) : null}

      {data.news.length > 0 ? (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
          <DarkPoolSectionHeader title="חדשות" icon="newspaper-outline" />
          {data.news.map((n, i) => (
            <View
              key={n.id}
              style={[styles.newsRow, i === data.news.length - 1 && styles.listRowLast]}
            >
              <Text style={styles.newsTitle}>{n.title}</Text>
              <Text style={styles.rowHint}>
                {[n.source, n.date, n.sentiment].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </UICard>
      ) : null}
    </View>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  tone = 'default',
  styles,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
  styles: ReturnType<typeof createStyles>;
}) {
  const tokens = useDesignTokens();
  const valueColor =
    tone === 'positive'
      ? tokens.colors.primary.main
      : tone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.primary;

  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
    </View>
  );
}

function formatCompactNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { gap: 12 },
    loader: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    loaderText: {
      fontSize: 13,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    summaryCard: {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    summaryCell: {
      flexGrow: 1,
      flexBasis: '45%',
      minWidth: 120,
      paddingVertical: 8,
      alignItems: 'flex-start',
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    summaryValue: {
      marginTop: 4,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    summaryHint: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'left',
      lineHeight: 15,
    },
    card: {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
      lineHeight: 22,
    },
    metricHint: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    listRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
      alignItems: 'flex-start',
    },
    listRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    insiderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
    },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    avatarFb: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    insiderText: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
    rowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
      lineHeight: 20,
    },
    rowHint: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
      lineHeight: 17,
    },
    newsRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
      alignItems: 'flex-start',
    },
    newsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      lineHeight: 21,
      writingDirection: 'rtl',
    },
  });
}
