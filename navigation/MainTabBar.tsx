import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { rootNavigationRef } from './rootNavigationRef';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { HapticFeedback } from '../utils/hapticFeedback';

/** גובה הסרגל בלי ה-safe area התחתון — MainTabs מוסיף padding כזה לסצנות כשהסרגל מוצג */
export const MAIN_TAB_BAR_HEIGHT = 56;

type TabDef = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  /** מסכי ה-Drawer שנחשבים «בתוך» הטאב */
  routes: string[];
  /** 'drawer' = מסך ב-Drawer; 'root' = מסך בסטאק הראשי (Profile) */
  target: { kind: 'drawer'; route: string } | { kind: 'root'; route: string };
};

const TABS: TabDef[] = [
  { key: 'home', label: 'בית', icon: 'home-outline', iconActive: 'home', routes: ['Home'], target: { kind: 'drawer', route: 'Home' } },
  {
    key: 'community',
    label: 'קהילה',
    icon: 'chatbubbles-outline',
    iconActive: 'chatbubbles',
    routes: ['Chat', 'Tweets'],
    target: { kind: 'drawer', route: 'Chat' },
  },
  {
    key: 'markets',
    label: 'שווקים',
    icon: 'trending-up-outline',
    iconActive: 'trending-up',
    routes: ['Watchlist', 'Markets', 'News', 'NewsCalendar', 'NewsEarnings', 'MarketsHeatmap'],
    target: { kind: 'drawer', route: 'Watchlist' },
  },
  {
    key: 'darkpool',
    label: 'דארק פול',
    icon: 'eye-outline',
    iconActive: 'eye',
    routes: ['DarkPool'],
    target: { kind: 'drawer', route: 'DarkPool' },
  },
  { key: 'me', label: 'אני', icon: 'person-circle-outline', iconActive: 'person-circle', routes: [], target: { kind: 'root', route: 'Profile' } },
];

type NavState = { index: number; routes: { name: string; state?: NavState }[] } | undefined;

/** המסך הפעיל ב-Drawer, והאם הוא במסך השורש של הסטאק שלו (לא בתוך שיחה / פרטי עסקה). */
function readDrawerFocus(): { route: string | null; atRoot: boolean } {
  if (!rootNavigationRef.isReady()) return { route: null, atRoot: false };
  const root = rootNavigationRef.getRootState() as NavState;
  const top = root?.routes[root.index];
  if (!top || top.name !== 'Main') return { route: null, atRoot: false };
  const drawer = top.state;
  if (!drawer) return { route: 'Home', atRoot: true };
  const focused = drawer.routes[drawer.index];
  const nested = focused?.state;
  return { route: focused?.name ?? null, atRoot: !nested || nested.index === 0 };
}

/** שומע לשינויי ניווט ומחזיר את מצב הסרגל */
export function useMainTabBarState(): { visible: boolean; activeKey: string | null } {
  const [state, setState] = useState(() => readDrawerFocus());
  useEffect(() => {
    const update = () => setState(readDrawerFocus());
    update();
    const unsub = rootNavigationRef.addListener('state', update);
    return unsub;
  }, []);
  const tab = TABS.find((t) => state.route && t.routes.includes(state.route));
  return { visible: !!state.route && state.atRoot, activeKey: tab?.key ?? null };
}

/**
 * Tab Bar תחתון עם 5 יעדים. ה-Drawer נשאר ליעדים המשניים (קורסים, תיקים, יומן...) ולקישורים עמוקים.
 * מוצג רק במסכי השורש — בתוך שיחה / מסך פרטים הוא נעלם.
 */
export default function MainTabBar({ activeKey }: { activeKey: string | null }) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const c = tokens.colors;

  const onPress = (tab: TabDef) => {
    void HapticFeedback.selection();
    if (!rootNavigationRef.isReady()) return;
    const nav = rootNavigationRef as unknown as { navigate: (name: string, params?: object) => void };
    if (tab.target.kind === 'root') {
      nav.navigate(tab.target.route);
      return;
    }
    nav.navigate('Main', { screen: tab.target.route });
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: c.background.cardSolid,
          borderTopColor: c.border.divider,
        },
      ]}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        const color = active ? c.text.primary : c.text.tertiary;
        const badge = 0; // ChatProvider יושב רק בתוך ChatStack — המונה מוצג על אייקון האפליקציה
        return (
          <Pressable
            key={tab.key}
            onPress={() => onPress(tab)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={badge ? `${tab.label}, ${badge} הודעות שלא נקראו` : tab.label}
          >
            <View>
              <Ionicons name={active ? tab.iconActive : tab.icon} size={24} color={color} />
              {badge ? (
                <View style={[styles.badge, { backgroundColor: c.danger.main }]}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row-reverse',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MAIN_TAB_BAR_HEIGHT - 6, gap: 2 },
  label: { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
