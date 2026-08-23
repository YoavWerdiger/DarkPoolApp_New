import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { DistributionDonut } from '../../Portfolios/components/DistributionDonut';
import { formatPercent } from '../../Portfolios/utils/format';
import {
  holdingsToDistributionSlices,
  sliceColorByTicker,
  type HoldingAllocationInput,
} from '../utils/holdingsAllocation';

interface Props {
  title?: string;
  holdings: HoldingAllocationInput[];
  /** תמונת האדם במרכז העוגה (כמו בתיק אישי) */
  avatarUrl?: string | null;
  /** מועמדים מאותו מקור כמו ProfileHeroAvatar — עם fallback בטעינה */
  avatarCandidates?: string[] | null;
  userInitial?: string;
}

/**
 * פילוח אחזקות — donut + מקרא (במקום אחוזים + progress bar בכל שורה).
 */
export function HoldingsPieSection({
  title = 'פילוח אחזקות',
  holdings,
  avatarUrl,
  avatarCandidates,
  userInitial,
}: Props) {
  const tokens = useDesignTokens();
  const slices = useMemo(() => holdingsToDistributionSlices(holdings), [holdings]);
  const colorByTicker = useMemo(() => sliceColorByTicker(slices), [slices]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (slices.length === 0) return null;

  return (
    <UICard variant="glass" padding="md" style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.donutWrap}>
        <DistributionDonut
          slices={slices}
          size={128}
          strokeWidth={18}
          avatarUrl={avatarUrl}
          avatarCandidates={avatarCandidates}
          userInitial={userInitial}
        />
        <View style={styles.legend}>
          {slices.map((s) => (
            <View key={s.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.legendPct}>{formatPercent(s.percentage, 1, false)}</Text>
            </View>
          ))}
        </View>
      </View>
    </UICard>
  );
}

/** נקודת צבע ליד טיקר ברשימה — תואמת ל-slice בעוגה */
export function HoldingTickerDot({
  ticker,
  colorByTicker,
}: {
  ticker: string;
  colorByTicker: Map<string, string>;
}) {
  const color = colorByTicker.get(ticker.toUpperCase());
  if (!color) return null;
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export function useHoldingsPieColors(holdings: HoldingAllocationInput[]) {
  return useMemo(() => {
    const slices = holdingsToDistributionSlices(holdings);
    return sliceColorByTicker(slices);
  }, [holdings]);
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      marginBottom: 12,
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
    },
    title: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      marginBottom: 12,
      writingDirection: 'rtl',
    },
    donutWrap: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 14,
    },
    legend: {
      flex: 1,
      gap: 7,
    },
    legendRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    legendPct: {
      fontSize: 12,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
    },
  });
}
