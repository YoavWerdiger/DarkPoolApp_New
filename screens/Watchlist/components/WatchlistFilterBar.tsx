import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { appCardSubtitleStyle } from '../../../components/ui/appType';
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
          borderBottomWidth: 1,
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
          backgroundColor: tokens.colors.background.navChrome,
          borderWidth: 0,
        },
        chipActive: {
          backgroundColor: tokens.colors.primary.dim,
        },
        text: {
          ...appCardSubtitleStyle,
          width: undefined,
          marginTop: 0,
          color: tokens.colors.text.secondary,
        },
        textActive: {
          color: tokens.colors.primary.main,
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
