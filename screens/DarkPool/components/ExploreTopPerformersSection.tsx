import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { ExplorePortraitCard } from './ExplorePortraitCard';

export type ExplorePerformancePeriod =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | 'YTD'
  | '1Y'
  | '5Y'
  | 'ALL';

const PERIODS: ExplorePerformancePeriod[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  'YTD',
  '1Y',
  '5Y',
  'ALL',
];

interface Props {
  title: string;
  subtitle?: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
}

export function ExploreTopPerformersSection({
  title,
  subtitle,
  people,
  onPersonPress,
}: Props) {
  const tokens = useDesignTokens();
  const [period, setPeriod] = useState<ExplorePerformancePeriod>('ALL');
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const ranked = useMemo(() => {
    const withReturn = people.map((p) => {
      const ret = p.returns?.[period];
      return { person: p, ret };
    });
    return withReturn.sort((a, b) => {
      const ar = a.ret ?? -Infinity;
      const br = b.ret ?? -Infinity;
      return br - ar;
    });
  }, [people, period]);

  if (!people.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periodRow}
      >
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodPill, active && styles.periodPillActive]}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {p}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {ranked.map(({ person, ret }) => {
          const metric =
            ret != null
              ? `${ret >= 0 ? '+' : ''}${ret.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`
              : person.metric;
          return (
            <ExplorePortraitCard
              key={person.id}
              person={{
                ...person,
                metric,
                metric_label: ret != null ? period : person.metric_label,
              }}
              variant="compact"
              onPress={() => onPersonPress(person)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      marginBottom: tokens.spacing.lg,
      direction: 'rtl',
    },
    header: {
      paddingHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.sm,
      alignItems: 'flex-start',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    periodRow: {
      flexDirection: 'row',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 6,
      marginBottom: tokens.spacing.sm,
    },
    periodPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    periodPillActive: {
      backgroundColor: tokens.colors.text.primary,
    },
    periodText: {
      fontSize: 12,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
    },
    periodTextActive: {
      color: tokens.colors.background.primary,
    },
    cardRow: {
      flexDirection: 'row',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 12,
      paddingBottom: 4,
    },
  });
}
