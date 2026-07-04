import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExploreKindFilter } from '../utils/exploreGrid';

const OPTIONS: { id: ExploreKindFilter; label: string }[] = [
  { id: 'all', label: 'כולם' },
  { id: 'politician', label: 'פוליטיקאים' },
  { id: 'insider', label: 'בכירים' },
];

interface Props {
  value: ExploreKindFilter;
  onChange: (v: ExploreKindFilter) => void;
  counts?: Partial<Record<ExploreKindFilter, number>>;
}

export function ExploreKindFilterBar({ value, onChange, counts }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: tokens.layout.screenPadding,
          marginBottom: tokens.spacing.md,
        },
        chip: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
        },
        chipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: 'rgba(0, 230, 118, 0.12)',
        },
        chipText: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        chipTextActive: {
          color: tokens.colors.primary.main,
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
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        const count = counts?.[opt.id];
        const label =
          count != null && count > 0 && opt.id !== 'all'
            ? `${opt.label} (${count})`
            : opt.label;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
