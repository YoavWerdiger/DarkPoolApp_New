/**
 * סרגל תחתון — פיד | חקור | טיקרים | מעקב
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
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
  | 'DarkPoolSearch'
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
    label: 'חקור',
    icon: 'compass-outline',
    iconActive: 'compass',
  },
  DarkPoolSearch: {
    label: 'טיקרים',
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

  // רקע הטאב הנבחר מחליק בין הטאבים (כמו בורר האינטרוולים) — מיקומים נמדדים ב-onLayout
  const reduceMotion = useReducedMotion();
  const frames = useRef(new Map<number, { x: number; width: number }>());
  const [measured, setMeasured] = useState(false);
  const hx = useSharedValue(0);
  const hw = useSharedValue(0);
  const moveTo = useCallback(
    (index: number, animate: boolean) => {
      const f = frames.current.get(index);
      if (!f) return;
      const cfg = { duration: 260, easing: Easing.out(Easing.cubic) };
      hx.value = animate && !reduceMotion ? withTiming(f.x, cfg) : f.x;
      hw.value = animate && !reduceMotion ? withTiming(f.width, cfg) : f.width;
    },
    [hx, hw, reduceMotion],
  );
  useEffect(() => {
    moveTo(state.index, measured);
  }, [state.index, measured, moveTo]);
  const highlightStyle = useAnimatedStyle(() => ({
    width: hw.value,
    transform: [{ translateX: hx.value }],
  }));

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.pill}>
        {/* direction ltr — x של onLayout פיזי (left מתהפך בעץ RTL) */}
        <View style={styles.highlightLayer} pointerEvents="none">
          {measured ? <Animated.View style={[styles.highlight, highlightStyle]} /> : null}
        </View>
        <View style={styles.pillInner}>
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
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                frames.current.set(index, { x, width });
                if (index === state.index) moveTo(index, false);
                if (frames.current.size >= state.routes.length && !measured) setMeasured(true);
              }}
              style={[styles.tab, focused && !measured && styles.tabFocused]}
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
      paddingTop: 10,
      paddingBottom: Math.max(safeBottom, 8),
      paddingHorizontal: tokens.layout.screenPadding,
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    pill: {
      width: '100%',
      maxWidth: 420,
      height: DARK_POOL_TAB_BAR_HEIGHT,
      borderRadius: tokens.borderRadius.full,
      backgroundColor: tokens.colors.background.navChrome,
      borderWidth: 0,
      overflow: 'hidden',
    },
    pillInner: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      height: DARK_POOL_TAB_BAR_HEIGHT,
      paddingHorizontal: 8,
    },
    highlightLayer: {
      ...StyleSheet.absoluteFill,
      direction: 'ltr',
      justifyContent: 'center',
    },
    highlight: {
      position: 'absolute',
      left: 0,
      top: 4,
      bottom: 4,
      borderRadius: tokens.borderRadius.full,
      backgroundColor: tokens.colors.selection.subtle,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: tokens.borderRadius.full,
      gap: 2,
    },
    tabFocused: {
      backgroundColor: tokens.colors.selection.subtle,
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
