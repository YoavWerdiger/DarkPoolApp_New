import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DayDividerPill, DayDividerSlidingLayer } from '../../../components/ui/DayDividerPill';
import { useSlidingIndicator } from '../../../components/ui/SlidingIndicator';
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

  // מחוון מחליק (כמו האינטרוולים); «אין בחירה» = מפתח ריק — בלי מחוון
  const NONE = '__none__';
  const indicator = useSlidingIndicator<string>(value ?? NONE);
  const labelFor = (id: string) => {
    const opt = EXPLORE_KIND_CHIPS.find((o) => o.id === id);
    if (!opt) return '';
    const count = counts?.[opt.id];
    return count != null && count > 0 ? `${opt.label} (${toDataIsland(count)})` : opt.label;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {EXPLORE_KIND_CHIPS.map((opt) => {
        const active = value === opt.id;
        return (
          <View key={opt.id} onLayout={indicator.onItemLayout(opt.id)}>
            <DayDividerPill
              selected={indicator.visualSelected === opt.id}
              instantSelection
              onPress={() => onChange(active ? null : opt.id)}
              accessibilityLabel={opt.label}
            >
              {labelFor(opt.id)}
            </DayDividerPill>
          </View>
        );
      })}
      <DayDividerSlidingLayer indicator={indicator} labelOf={labelFor} />
    </ScrollView>
  );
}
