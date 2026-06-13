import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { formatUsdCompact } from '../utils/darkPoolFormat';

export interface TickerHeroStat {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
}

interface Props {
  ticker: string;
  companyName?: string | null;
  sector?: string | null;
  stats?: TickerHeroStat[];
  premiumToday?: number | null;
}

export function TickerScreenHero({
  ticker,
  companyName,
  sector,
  stats = [],
  premiumToday,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const metaLine = [companyName?.trim(), sector?.trim()].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap}>
      <View style={styles.identityRow}>
        <TickerLogo symbol={ticker} size={52} borderRadius={14} />
        <View style={styles.identityText}>
          <Text style={styles.ticker}>{ticker}</Text>
          {metaLine ? (
            <Text style={styles.meta} numberOfLines={2}>
              {metaLine}
            </Text>
          ) : null}
          {premiumToday != null && premiumToday > 0 ? (
            <Text style={styles.premiumHint}>
              Dark Pool היום · {formatUsdCompact(premiumToday)}
            </Text>
          ) : null}
        </View>
      </View>

      {stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statChip}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text
                style={[
                  styles.statValue,
                  s.tone === 'positive' && { color: tokens.colors.primary.main },
                  s.tone === 'negative' && { color: tokens.colors.text.danger },
                  s.tone === 'muted' && { color: tokens.colors.text.tertiary },
                ]}
              >
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      marginBottom: tokens.spacing.lg,
      gap: 14,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    identityText: {
      flex: 1,
      alignItems: 'flex-start',
      minWidth: 0,
    },
    ticker: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    meta: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    premiumHint: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statChip: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 96,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.03)',
      alignItems: 'flex-start',
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'left',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
  });
}
