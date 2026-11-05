import { ROW_REV } from '../../../lib/i18n/direction';
import i18n from '../../../lib/i18n';
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
  { id: 'all', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s1') },
  { id: 'up', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s2') },
  { id: 'down', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s3') },
  { id: 'volume', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s4') },
  { id: 'events', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s5') },
  { id: 'alerts', label: i18n.t('auto.screens__Watchlist__components__WatchlistFilterBar.s6') },
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
          flexDirection: ROW_REV,
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
