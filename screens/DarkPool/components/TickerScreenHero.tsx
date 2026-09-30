import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { formatUsdCompact } from '../utils/darkPoolFormat';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalLeftText,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';

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
      direction: 'ltr',
    },
    identityRow: {
      direction: 'ltr',
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
      fontSize: DARK_POOL_TYPE.sectionTitle.fontSize,
      lineHeight: DARK_POOL_TYPE.sectionTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.sectionTitle.fontWeight,
      letterSpacing: DARK_POOL_TYPE.sectionTitle.letterSpacing,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    meta: {
      ...darkPoolPhysicalLeftText,
      marginTop: 2,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      color: tokens.colors.text.secondary,
    },
    premiumHint: {
      ...darkPoolPhysicalRightText,
      marginTop: 6,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    statsRow: {
      direction: 'rtl',
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
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'stretch',
    },
    statLabel: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
      color: tokens.colors.text.tertiary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: DARK_POOL_TYPE.cardMetricValueSecondary.fontSize,
      lineHeight: DARK_POOL_TYPE.cardMetricValueSecondary.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardMetricValueSecondary.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
  });
}
