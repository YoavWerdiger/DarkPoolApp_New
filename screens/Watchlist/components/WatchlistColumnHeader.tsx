import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE } from '../../../components/ui/appType';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import type { WatchlistSortMode } from '../../../services/watchlist/watchlistTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  colChg,
  colChgPct,
  colDrag,
  colLast,
  colSymbol,
  colVol,
  quoteRow,
} from '../watchlistTheme';

type Props = {
  sortMode: WatchlistSortMode;
  onSortChange: (mode: WatchlistSortMode) => void;
};

type ColDef = {
  key: string;
  label: string;
  mode: WatchlistSortMode;
  toggleMode?: WatchlistSortMode;
  style: ViewStyle;
};

const COLS: ColDef[] = [
  { key: 'symbol', label: 'סימבול', mode: 'name', style: colSymbol },
  { key: 'last', label: 'מחיר', mode: 'price_desc', style: colLast },
  {
    key: 'chg',
    label: 'שינוי',
    mode: 'change_abs_desc',
    toggleMode: 'change_abs_asc',
    style: colChg,
  },
  {
    key: 'chgPct',
    label: 'שינוי %',
    mode: 'change_desc',
    toggleMode: 'change_asc',
    style: colChgPct,
  },
  {
    key: 'vol',
    label: 'וול׳',
    mode: 'volume_desc',
    toggleMode: 'volume_asc',
    style: colVol,
  },
  { key: 'drag', label: '', mode: 'custom', style: colDrag },
];

export function WatchlistColumnHeader({ sortMode, onSortChange }: Props) {
  const tokens = useDesignTokens();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          ...quoteRow,
          paddingTop: APP_LAYOUT.cardPadding,
          paddingBottom: APP_LAYOUT.stackGapSmall,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        },
        cell: { justifyContent: 'center' },
        hit: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
          minHeight: 22,
        },
        label: {
          ...APP_TYPE.cardMetricLabel,
          textAlign: 'right',
          color: tokens.colors.text.secondary,
        },
        labelActive: {
          color: tokens.colors.text.primary,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.wrap}>
      {COLS.map((col) => {
        const active =
          sortMode === col.mode ||
          (col.toggleMode != null && sortMode === col.toggleMode);
        const asc =
          sortMode === col.toggleMode ||
          (col.mode === 'name' && sortMode === 'name');
        if (col.key === 'drag') {
          return <View key={col.key} style={[styles.cell, col.style]} />;
        }
        return (
          <View key={col.key} style={[styles.cell, col.style]}>
            <Pressable
              style={styles.hit}
              onPress={() => {
                void HapticFeedback.selection();
                if (col.toggleMode && sortMode === col.mode) {
                  onSortChange(col.toggleMode);
                } else if (col.toggleMode && sortMode === col.toggleMode) {
                  onSortChange(col.mode);
                } else if (sortMode === col.mode) {
                  onSortChange('custom');
                } else {
                  onSortChange(col.mode);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`מיון לפי ${col.label}`}
              hitSlop={6}
            >
              {active ? (
                <Ionicons
                  name={asc ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={tokens.colors.text.primary}
                />
              ) : null}
              <Text style={[styles.label, active && styles.labelActive]}>{col.label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
