import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { DayDividerPill } from '../../../components/ui/DayDividerPill';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  EXPLORE_KIND_CHIPS,
  type ExploreKindFilter,
} from '../utils/exploreGrid';
import { toDataIsland } from '../utils/bidi';

interface Props {
  value: ExploreKindFilter | null;
  onChange: (v: ExploreKindFilter | null) => void;
  counts?: Partial<Record<ExploreKindFilter, number>>;
}

export function ExploreKindFilterBar({ value, onChange, counts }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: tokens.spacing.md,
        },
      }),
    [tokens]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {EXPLORE_KIND_CHIPS.map((opt) => {
        const active = value === opt.id;
        const count = counts?.[opt.id];
        const label =
          count != null && count > 0
            ? `${opt.label} (${toDataIsland(count)})`
            : opt.label;
        return (
          <DayDividerPill
            key={opt.id}
            selected={active}
            onPress={() => onChange(active ? null : opt.id)}
            accessibilityLabel={opt.label}
          >
            {label}
          </DayDividerPill>
        );
      })}
    </ScrollView>
  );
}
