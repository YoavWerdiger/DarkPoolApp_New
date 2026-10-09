/**
 * מעטפת בורר תקופות — לא מחוברת למסך גילוי.
 * `people.returns[period]` הוא תשואת תיק משוחזרת (InsiderWave ALL +3051%) ואסור להציג.
 */

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DayDividerPill, SlidingPillGroup } from '../../../components/ui/DayDividerPill';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  darkPoolSectionSubtitleStyle,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';
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

      <SlidingPillGroup
        scroll
        options={PERIODS.map((p) => ({ id: p, label: p }))}
        value={period}
        onChange={setPeriod}
        contentContainerStyle={styles.periodRow}
      />

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
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.sm,
      alignSelf: 'stretch',
      alignItems: 'stretch',
    },
    title: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...darkPoolSectionSubtitleStyle,
      color: tokens.colors.text.tertiary,
    },
    periodRow: {
      flexDirection: 'row',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 8,
      marginBottom: tokens.spacing.sm,
    },
    cardRow: {
      flexDirection: 'row',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 12,
      paddingBottom: 4,
    },
  });
}
