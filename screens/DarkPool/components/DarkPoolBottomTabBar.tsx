/**
 * סרגל תחתון — פיד | אנשים | מעקב
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { DARK_POOL_TAB_BAR_HEIGHT } from '../../../hooks/useDarkPoolTabBarHeight';

type TabRoute =
  | 'DarkPoolExplore'
  | 'DarkPoolFollowing'
  | 'DarkPoolFeed';

const TAB_META: Record<
  TabRoute,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; iconActive: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  DarkPoolFeed: {
    label: 'פיד',
    icon: 'newspaper-outline',
    iconActive: 'newspaper',
  },
  DarkPoolExplore: {
    label: 'אנשים',
    icon: 'search-outline',
    iconActive: 'search',
  },
  DarkPoolFollowing: {
    label: 'מעקב',
    icon: 'people-outline',
    iconActive: 'people',
  },
};

export function DarkPoolBottomTabBar({ state, navigation }: BottomTabBarProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens, insets.bottom), [tokens, insets.bottom]);

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TAB_META[route.name as TabRoute];
          if (!meta) return null;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (!focused) void HapticFeedback.selection();
                const e = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !e.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={[styles.tab, focused && styles.tabFocused]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <Ionicons
                name={focused ? meta.iconActive : meta.icon}
                size={22}
                color={focused ? tokens.colors.primary.main : tokens.colors.text.tertiary}
              />
              <Text style={[styles.label, focused && styles.labelFocused]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, safeBottom: number) {
  return StyleSheet.create({
    outer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingBottom: Math.max(safeBottom, 8),
      paddingHorizontal: tokens.layout.screenPadding,
      alignItems: 'center',
    },
    pill: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      maxWidth: 420,
      height: DARK_POOL_TAB_BAR_HEIGHT,
      borderRadius: 28,
      backgroundColor: 'rgba(22, 26, 22, 0.96)',
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      paddingHorizontal: 6,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: 22,
      gap: 2,
    },
    tabFocused: {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    labelFocused: {
      color: tokens.colors.text.primary,
      fontWeight: '800',
    },
  });
}
