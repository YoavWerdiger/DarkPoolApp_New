import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NewsScreen from '../screens/News';
import JournalStack from './JournalStack';
import MarketsScreen from '../screens/Markets/MarketsScreen';
import ChatStack from './ChatStack';
import LearningStack from './LearningStack';
import {
  MAIN_DRAWER_NAVIGATOR_ID,
  getMainDrawerPosition,
  registerMainDrawerNavigation,
  type DrawerParentNavigation,
} from './mainDrawerNav';
import { useAuth } from '../context/AuthContext';

const Drawer = createDrawerNavigator();

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, Math.round(SCREEN_W * 0.82));

const DRAWER_ITEMS = [
  { name: 'Chat' as const, title: 'קהילה', icon: 'people-outline' as const },
  { name: 'Markets' as const, title: 'שווקים', icon: 'trending-up-outline' as const },
  { name: 'News' as const, title: 'חדשות', icon: 'newspaper-outline' as const },
  { name: 'Journal' as const, title: 'יומן', icon: 'book-outline' as const },
  { name: 'Courses' as const, title: 'אקדמיה', icon: 'school-outline' as const },
];

const ACCENT = '#00C805';
const LABEL = 'rgba(255,255,255,0.68)';

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { navigation, state } = props;
  const { user } = useAuth();

  useEffect(() => {
    registerMainDrawerNavigation(navigation as unknown as DrawerParentNavigation);
  }, [navigation]);
  const activeRoute = state.routes[state.index]?.name;
  const drawerSide = getMainDrawerPosition();
  const rootEdgeStyle =
    drawerSide === 'left'
      ? drawerStyles.rootEdgeRight
      : drawerStyles.rootEdgeLeft;
  const displayName =
    (user as any)?.user_metadata?.display_name ||
    (user as any)?.user_metadata?.full_name ||
    (user as any)?.email?.split('@')?.[0] ||
    'משתמש';
  const avatarUrl = (user as any)?.user_metadata?.avatar_url as string | undefined;
  const createdAt = (user as any)?.created_at ? new Date((user as any).created_at) : null;
  const activeSinceText = createdAt
    ? `חבר קהילה מאז ${createdAt.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`
    : 'חבר קהילה';

  return (
    <View style={[drawerStyles.root, rootEdgeStyle, { paddingTop: insets.top + 10 }]}>
      <View style={drawerStyles.brandHeader}>
        <Image source={require('../assets/icon.png')} style={drawerStyles.brandLogo} resizeMode="contain" />
        <View style={drawerStyles.brandTextWrap}>
          <Text style={drawerStyles.brand}>קהילת DarkPool</Text>
          <Text style={drawerStyles.hint}>הבית של הסוחרים בישראל</Text>
        </View>
      </View>
      <ScrollView style={drawerStyles.scroll} showsVerticalScrollIndicator={false}>
        {DRAWER_ITEMS.map((item) => {
          const focused = activeRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[drawerStyles.row, focused && drawerStyles.rowActive]}
              activeOpacity={0.75}
              onPress={() => {
                navigation.navigate(item.name as any);
                navigation.closeDrawer();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <Ionicons name={item.icon} size={24} color={focused ? ACCENT : LABEL} />
              <Text style={[drawerStyles.label, focused && drawerStyles.labelActive]}>{item.title}</Text>
              {focused ? (
                <Ionicons
                  name={drawerSide === 'left' ? 'chevron-forward' : 'chevron-back'}
                  size={20}
                  color={ACCENT}
                />
              ) : (
                <View style={{ width: 20 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[drawerStyles.profileFooter, { paddingBottom: insets.bottom + 10 }]}
        onPress={() => {
          navigation.closeDrawer();
          const rootStack = navigation.getParent();
          try {
            (rootStack as any)?.navigate('Profile', { screen: 'ProfileMain' });
          } catch {
            (navigation as any).navigate('Profile', { screen: 'ProfileMain' });
          }
        }}
      >
        {avatarUrl ? (
          <View style={drawerStyles.profileAvatarWrap}>
            <Image source={{ uri: avatarUrl }} style={drawerStyles.profileAvatarImage} resizeMode="cover" />
          </View>
        ) : (
          <View style={drawerStyles.profileAvatarPlaceholder}>
            <Ionicons name="person" size={18} color="#FFFFFF" />
          </View>
        )}
        <View style={drawerStyles.profileFooterInfo}>
          <Text style={drawerStyles.profileFooterName} numberOfLines={1}>{displayName}</Text>
          <Text style={drawerStyles.profileFooterMeta} numberOfLines={1}>{activeSinceText}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const HAIRLINE = StyleSheet.hairlineWidth;
const EDGE = 'rgba(255,255,255,0.08)';

const drawerStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1A0F',
    paddingHorizontal: 14,
  },
  /** מגירה משמאל — קו מפריד בצד ימין של הפאנל (לכיוון התוכן) */
  rootEdgeRight: {
    borderRightWidth: HAIRLINE,
    borderRightColor: EDGE,
  },
  /** מגירה מימין — קו מפריד בצד שמאל של הפאנל */
  rootEdgeLeft: {
    borderLeftWidth: HAIRLINE,
    borderLeftColor: EDGE,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  brandHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  brandTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  brandLogo: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 26,
    marginBottom: 4,
    gap: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(0, 200, 5, 0.10)',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: LABEL,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  labelActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  profileFooter: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: HAIRLINE,
    borderTopColor: EDGE,
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
  },
  profileFooterInfo: {
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  profileFooterName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileFooterMeta: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.48)',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
});

/**
 * ניווט ראשי: Drawer (החלקה מהקצה) במקום Bottom Tabs — מסך מלא בלי סרגל תחתון.
 */
export default function MainTabs() {
  const drawerPosition = getMainDrawerPosition();

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E0A' }}>
      <Drawer.Navigator
        id={MAIN_DRAWER_NAVIGATOR_ID}
        initialRouteName="Chat"
        drawerContent={(p) => <CustomDrawerContent {...p} />}
        // ברירת המחדל true לאנדרואיד/iOS — ידוע שגורם למסכים ריקים/שבורים עם Native Stack בתוך Drawer
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          drawerPosition,
          // front = המגירה מעל התוכן עם overlay — נראה ברור יותר מ-slide שדוחף חצי מסך
          drawerType: 'front',
          swipeEdgeWidth: 72,
          overlayColor: 'rgba(0,0,0,0.55)',
          drawerStyle: {
            width: DRAWER_WIDTH,
            backgroundColor: '#0F1A0F',
          },
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Drawer.Screen name="Chat" component={ChatStack} options={{ title: 'קהילה' }} />
        <Drawer.Screen name="Markets" component={MarketsScreen} options={{ title: 'שווקים' }} />
        <Drawer.Screen name="News" component={NewsScreen} options={{ title: 'חדשות' }} />
        <Drawer.Screen name="Journal" component={JournalStack} options={{ title: 'יומן' }} />
        <Drawer.Screen name="Courses" component={LearningStack} options={{ title: 'אקדמיה' }} />
      </Drawer.Navigator>
    </View>
  );
}
