import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { WatchlistFilterMode } from '../../../services/watchlist/watchlistTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { ROW_PAD_H } from '../watchlistTheme';

type Props = {
  mode: WatchlistFilterMode;
  onChange: (mode: WatchlistFilterMode) => void;
};

const FILTERS: Array<{ id: WatchlistFilterMode; label: string }> = [
  { id: 'all', label: 'הכל' },
  { id: 'up', label: 'עולות' },
  { id: 'down', label: 'יורדות' },
  { id: 'volume', label: 'ווליום גבוה' },
  { id: 'events', label: 'דיווחים' },
  { id: 'alerts', label: 'עם התראה' },
];

export function WatchlistFilterBar({ mode, onChange }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        scroll: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: ROW_PAD_H,
          paddingVertical: 8,
        },
        chip: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        chipActive: {
          backgroundColor: tokens.colors.primary.dim,
          borderColor: tokens.colors.border.accent,
        },
        text: {
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          fontWeight: '600',
        },
        textActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {FILTERS.map((f) => {
          const active = mode === f.id;
          return (
            <Pressable
              key={f.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                void HapticFeedback.selection();
                onChange(f.id);
              }}
            >
              <Text style={[styles.text, active && styles.textActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
