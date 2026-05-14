/**
 * DarkPoolTabToggle.tsx
 * -----------------------------------------------------------------------------
 * Tab Toggle עליון במסך Dark Pool — Following / All.
 * כשהמשתמש לא פרימיום, ה-Following נעול (מציג icon נעילה).
 *
 * תואם לשפת העיצוב של האפליקציה (RTL, ירוק accent, גלאסי כהה).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { DarkPoolFeedTab } from '../../../hooks/useDarkPoolInsiderFeed';

interface DarkPoolTabToggleProps {
  value: DarkPoolFeedTab;
  onChange: (tab: DarkPoolFeedTab) => void;
  /** האם הטאב 'watchlist' נעול (לא פרימיום). */
  watchlistLocked?: boolean;
}

const TABS: Array<{ id: DarkPoolFeedTab; label: string }> = [
  { id: 'all', label: 'הכל' },
  { id: 'watchlist', label: 'מעקב' },
];

export function DarkPoolTabToggle({
  value,
  onChange,
  watchlistLocked = false,
}: DarkPoolTabToggleProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const active = value === tab.id;
        const locked = tab.id === 'watchlist' && watchlistLocked;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={6}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {locked ? (
              <Ionicons
                name="lock-closed"
                size={12}
                color={
                  active
                    ? tokens.colors.primary.main
                    : tokens.colors.text.tertiary
                }
              />
            ) : null}
            {active ? <View style={styles.activeIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.subtle,
      marginBottom: tokens.spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      position: 'relative',
    },
    tabActive: {},
    tabLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    tabLabelActive: {
      color: tokens.colors.text.primary,
      fontWeight: '800',
    },
    activeIndicator: {
      position: 'absolute',
      bottom: -1,
      left: '20%',
      right: '20%',
      height: 2,
      borderRadius: 1,
      backgroundColor: tokens.colors.primary.main,
    },
  });
}
