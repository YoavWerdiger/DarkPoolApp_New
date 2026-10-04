import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  InteractionManager,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SUPABASE_URL } from '../config/publicEnv';
import NewsScreen from '../screens/News';
import NewsEconomicCalendarScreen from '../screens/News/NewsEconomicCalendarScreen';
import NewsEarningsScreen from '../screens/News/NewsEarningsScreen';
import LikedArticlesScreen from '../screens/News/LikedArticlesScreen';
import TweetsScreen from '../screens/Tweets/TweetsScreen';
import JournalStack from './JournalStack';
import PortfoliosStack from './PortfoliosStack';
import DarkPoolStack from './DarkPoolStack';
import WatchlistScreen from '../screens/Watchlist/WatchlistScreen';
import MarketsHeatmapScreen from '../screens/Markets/MarketsHeatmapScreen';
import ChatStack from './ChatStack';
import LearningStack from './LearningStack';
import {
  MAIN_DRAWER_NAVIGATOR_ID,
  getMainDrawerPosition,
  registerMainDrawerNavigation,
  type DrawerParentNavigation,
} from './mainDrawerNav';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { HapticFeedback } from '../utils/hapticFeedback';

const Drawer = createDrawerNavigator();

/** קנבס מגירה — שקוף כדי שהאורורה בשורש תיראה */
const SCREEN_BG = 'transparent';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, Math.round(SCREEN_W * 0.82));
/** צד התוכן (פנים למסך) — מגירה מימין = שמאל פיזי */
/** כיוון התוכן — יותר ריווח כדי להזיז את כל התוכן מעט ימינה (מגירה מימין) */
const DRAWER_PAD_INNER = 15;
/** צד המסגרת / לוגו / אווטאר — מעט פחות כדי לאזן את ההזחה ימינה */
const DRAWER_PAD_OUTER = 17;

/**
 * לוגו תפריט — אותו קובץ כמו `app-media/IMG_3289.PNG` (PNG שקוף).
 * הקובץ בסטורג׳ ריבועי עם ריפוד גדול; העותק המקומי חתוך לתוכן
 * כדי ש־contain ב־100%×96 יישאר באותו טביעת רגל כמו הלוגו הישן.
 */
const DRAWER_MENU_LOGO_URI = `${SUPABASE_URL}/storage/v1/object/public/app-media/IMG_3289.PNG`;
const DRAWER_MENU_LOGO = require('../assets/IMG_3289.png');
/** לוגו תפריט במצב בהיר — אותו סלוט כמו IMG_3289. */
const DRAWER_MENU_LOGO_LIGHT_URI = `${SUPABASE_URL}/storage/v1/object/public/app-media/branding/IMG_9432.png`;
/** גובה מקורי של לוגו המגירה — לא להקטין (הריבוע המרוחק נראה כתמונה ממוזערת). */
const DRAWER_MENU_LOGO_HEIGHT = 96;
/**
 * IMG_9432.png הוא פלטה 6250×6250. הסימן (שור עד הוורדמארק) יושב ב־
 * y=1885..4133 (גובה 2249). מגדילים את הפלטה כך שהסימן עצמו יהיה בגובה 96,
 * וחותכים את הריפוד השחור בלי להגדיל את כותרת התפריט.
 */
const LIGHT_LOGO_PLATE = 6250;
const LIGHT_LOGO_MARK_TOP = 1885;
const LIGHT_LOGO_MARK_HEIGHT = 2249;
const LIGHT_LOGO_RENDERED =
  (DRAWER_MENU_LOGO_HEIGHT * LIGHT_LOGO_PLATE) / LIGHT_LOGO_MARK_HEIGHT;
const LIGHT_LOGO_TOP =
  -(LIGHT_LOGO_MARK_TOP * DRAWER_MENU_LOGO_HEIGHT) / LIGHT_LOGO_MARK_HEIGHT;

type DrawerIconFamily = 'ion' | 'mci' | 'feather';

/** סדר מלמעלה למטה לפי חשיבות (מגירה) */
const DRAWER_ITEMS: Array<{
  name:
    | 'Chat'
    | 'Courses'
    | 'Portfolios'
    | 'DarkPool'
    | 'News'
    | 'Tweets'
    | 'Watchlist'
    | 'NewsEarnings'
    | 'NewsCalendar'
    | 'MarketsHeatmap';
  title: string;
  icon: string;
  iconFamily?: DrawerIconFamily;
}> = [
  { name: 'Chat', title: 'קהילה', icon: 'chatbubbles-outline' },
  { name: 'Courses', title: 'האקדמיה', icon: 'school-outline' },
  { name: 'Portfolios', title: 'יומן מסחר', icon: 'book-outline' },
  { name: 'DarkPool', title: 'אינסיידרים', icon: 'eye-outline' },
  { name: 'News', title: 'חדשות', icon: 'newspaper-outline' },
  { name: 'Tweets', title: 'ציוצים', icon: 'twitter', iconFamily: 'feather' },
  { name: 'NewsEarnings', title: 'דיווחי רווח', icon: 'notifications-outline' },
  { name: 'NewsCalendar', title: 'יומן כלכלי', icon: 'calendar-outline' },
  { name: 'Watchlist', title: 'רשימת מעקב', icon: 'list-outline' },
  { name: 'MarketsHeatmap', title: 'מפת חום', icon: 'map-outline' },
];

const ACCENT = '#00C805';

/** מגירה → מסכי Stack מקוננים — ניווט מפורש למסך הבית של כל Stack (מונע מסך ריק / state תקוע). */
function navigateDrawerItem(
  navigation: DrawerContentComponentProps['navigation'],
  routeName: string
) {
  const stackHome: Record<string, { screen: string }> = {
    Portfolios: { screen: 'PortfoliosHub' },
    Journal: { screen: 'JournalMain' },
    Courses: { screen: 'CoursesScreen' },
    Chat: { screen: 'ChatGroupsList' },
    DarkPool: { screen: 'DarkPoolHome' },
  };
  const nest = stackHome[routeName];
  if (nest) {
    navigation.dispatch(
      CommonActions.navigate({
        name: routeName,
        params: nest,
      } as never)
    );
  } else {
    navigation.dispatch(CommonActions.navigate({ name: routeName } as never));
  }
}

/** `created_at` מגיע כמחרוזת ISO מהשרת — עלול להיות חסר או לא תקין */
function formatActiveSince(createdAt: string | null | undefined): string {
  if (!createdAt) return 'חבר קהילה';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'חבר קהילה';
  return `חבר קהילה מאז ${date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`;
}

/**
 * פרודקשן — הפרדה מפורשת לפלטפורמה:
 * - Android: `front` כמו תמיד (אין שינוי בהתנהגות המגירה).
 * - iOS בלבד: `slide` בגלל חיתוך/הזחה שגויה עם forceRTL + מגירה מימין.
 */
const DRAWER_TYPE_PRODUCTION = Platform.OS === 'ios' ? ('slide' as const) : ('front' as const);

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { navigation, state } = props;
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const tokens = useDesignTokens();
  const drawerStyles = useMemo(
    () => createDrawerStyles(tokens),
    [tokens],
  );

  useEffect(() => {
    registerMainDrawerNavigation(navigation as unknown as DrawerParentNavigation);
    return () => {
      registerMainDrawerNavigation(null);
    };
  }, [navigation]);
  const activeRoute = state.routes[state.index]?.name;
  const drawerSide = getMainDrawerPosition();
  const displayName =
    user?.display_name ||
    user?.full_name ||
    user?.email?.split('@')?.[0] ||
    'משתמש';
  const avatarUrl = user?.profile_picture;
  const activeSinceText = useMemo(() => formatActiveSince(user?.created_at), [user?.created_at]);

  const isIos = Platform.OS === 'ios';

  const padOuterWithSafe =
    DRAWER_PAD_OUTER +
    (isIos && drawerSide === 'right' ? insets.right : 0) +
    (isIos && drawerSide === 'left' ? insets.left : 0);

  const rootHorizontal = useMemo(() => {
    if (drawerSide === 'right') {
      return { paddingLeft: DRAWER_PAD_INNER, paddingRight: padOuterWithSafe };
    }
    return { paddingLeft: padOuterWithSafe, paddingRight: DRAWER_PAD_INNER };
  }, [drawerSide, padOuterWithSafe]);

  return (
    <View
      style={[
        drawerStyles.root,
        rootHorizontal,
        {
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 8,
          /** רק iOS: רוחב מלא + minWidth — כמו פרודקשן, בלי לשנות drawerType */
          ...(isIos && { width: '100%', minWidth: 0 }),
        },
      ]}
    >
      <View style={drawerStyles.brandHeader}>
        {isDarkMode ? (
          <ExpoImage
            source={DRAWER_MENU_LOGO}
            recyclingKey={DRAWER_MENU_LOGO_URI}
            style={drawerStyles.brandLogo}
            contentFit="contain"
            transition={0}
            accessibilityLabel="DarkPool"
          />
        ) : (
          <View style={drawerStyles.brandLogoClip}>
            <ExpoImage
              source={{ uri: DRAWER_MENU_LOGO_LIGHT_URI }}
              recyclingKey={DRAWER_MENU_LOGO_LIGHT_URI}
              style={drawerStyles.brandLogoLight}
              contentFit="fill"
              transition={0}
              accessibilityLabel="DarkPool"
            />
          </View>
        )}
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
                void HapticFeedback.selection();
                // סוגרים מגירה קודם — mount של מסך כבד אחרי האנימציה מונע גמגום
                navigation.closeDrawer();
                InteractionManager.runAfterInteractions(() => {
                  navigateDrawerItem(navigation, item.name);
                });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              {item.iconFamily === 'mci' ? (
                <MaterialCommunityIcons
                  name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                  size={24}
                  color={focused ? ACCENT : tokens.colors.text.primary}
                />
              ) : item.iconFamily === 'feather' ? (
                <Feather
                  name={item.icon as React.ComponentProps<typeof Feather>['name']}
                  size={22}
                  color={focused ? ACCENT : tokens.colors.text.primary}
                />
              ) : (
                <Ionicons
                  name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={24}
                  color={focused ? ACCENT : tokens.colors.text.primary}
                />
              )}
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
        style={drawerStyles.profileFooter}
        onPress={() => {
          void HapticFeedback.selection();
          navigation.closeDrawer();
          const rootStack = navigation.getParent();
          try {
            (rootStack as any)?.navigate('Profile', { screen: 'ProfileMain' });
          } catch {
            (navigation as any).navigate('Profile', { screen: 'ProfileMain' });
          }
        }}
      >
        {/* App LTR tree + forceRTL: alignSelf קבוע flex-end — לא I18nManager.isRTL */}
        <View style={drawerStyles.profileFooterRow}>
          {avatarUrl ? (
            <View style={drawerStyles.profileAvatarWrap}>
              <Image source={{ uri: avatarUrl }} style={drawerStyles.profileAvatarImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={drawerStyles.profileAvatarPlaceholder}>
              <Ionicons name="person" size={18} color={tokens.colors.text.primary} />
            </View>
          )}
          <View style={drawerStyles.profileFooterInfo}>
            <Text style={drawerStyles.profileFooterName} numberOfLines={1}>{displayName}</Text>
            <Text style={drawerStyles.profileFooterMeta} numberOfLines={1}>{activeSinceText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function createDrawerStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
  /** ריווח אופקי מוגדר ב־CustomDrawerContent (אסימטרי + safe area) */
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background.cardSolid,
  },
  brandHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  brandLogo: {
    width: '100%',
    height: DRAWER_MENU_LOGO_HEIGHT,
    backgroundColor: 'transparent',
  },
  /** אותה תיבה של 96 — הריפוד השחור נחתך, הכותרת לא גדלה */
  brandLogoClip: {
    width: '100%',
    height: DRAWER_MENU_LOGO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  brandLogoLight: {
    position: 'absolute',
    width: LIGHT_LOGO_RENDERED,
    height: LIGHT_LOGO_RENDERED,
    top: LIGHT_LOGO_TOP,
    left: '50%',
    marginLeft: -LIGHT_LOGO_RENDERED / 2,
  },
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 26,
    marginBottom: 3,
    gap: 10,
  },
  rowActive: {
    backgroundColor: 'rgba(0, 200, 5, 0.10)',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  labelActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  profileFooter: {
    marginTop: 12,
    marginHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1.5,
    borderTopColor: tokens.colors.border.divider,
    alignSelf: 'stretch',
  },
  /** צמוד לימין הפיזי (עץ LTR) — אווטאר ימין, טקסט משמאלו */
  profileFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 12,
    direction: 'ltr',
  },
  profileFooterInfo: {
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  profileFooterName: {
    color: tokens.colors.text.primary,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileFooterMeta: {
    marginTop: 3,
    color: tokens.colors.text.secondary,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.tertiary,
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
    backgroundColor: tokens.colors.background.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.divider,
  },
  });
}

/**
 * ניווט ראשי: Drawer (החלקה מהקצה) במקום Bottom Tabs — מסך מלא בלי סרגל תחתון.
 */
export default function MainTabs() {
  const drawerPosition = getMainDrawerPosition();
  const tokens = useDesignTokens();
  const drawerFill = tokens.colors.background.cardSolid;

  return (
    <View style={{ flex: 1, backgroundColor: SCREEN_BG }}>
      <Drawer.Navigator
        id={MAIN_DRAWER_NAVIGATOR_ID}
        initialRouteName="Chat"
        drawerContent={(p) => <CustomDrawerContent {...p} />}
        // ברירת המחדל true לאנדרואיד/iOS — ידוע שגורם למסכים ריקים/שבורים עם Native Stack בתוך Drawer
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          drawerPosition,
          drawerType: DRAWER_TYPE_PRODUCTION,
          swipeEdgeWidth: 72,
          overlayColor: 'rgba(0,0,0,0.55)',
          drawerStyle: {
            width: DRAWER_WIDTH,
            backgroundColor: drawerFill,
          },
          sceneStyle: { backgroundColor: SCREEN_BG },
          // enableFreeze(true) ב-App — משאירים הקפאה ב-blur כדי שמסכי Drawer כבדים
          // (צ'אט/realtime) לא ימשיכו לרנדר ברקע וייגנבו את ה-JS thread בניווט.
        }}
      >
        <Drawer.Screen name="Chat" component={ChatStack} options={{ title: 'קהילה' }} />
        <Drawer.Screen name="Courses" component={LearningStack} options={{ title: 'האקדמיה' }} />
        {/* Journal stack kept registered for backward-compat deep links, hidden from drawer menu. */}
        <Drawer.Screen
          name="Journal"
          component={JournalStack}
          options={{ title: 'יומן מסחר (legacy)', drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="Portfolios"
          component={PortfoliosStack}
          options={{ title: 'יומן מסחר' }}
        />
        <Drawer.Screen
          name="DarkPool"
          component={DarkPoolStack}
          options={{ title: 'אינסיידרים' }}
        />
        <Drawer.Screen name="News" component={NewsScreen} options={{ title: 'חדשות' }} />
        <Drawer.Screen name="Tweets" component={TweetsScreen} options={{ title: 'ציוצים' }} />
        <Drawer.Screen
          name="Watchlist"
          component={WatchlistScreen}
          options={{ title: 'רשימת מעקב' }}
        />
        {/* Legacy alias — deep links ישנים ל-"Markets" */}
        <Drawer.Screen
          name="Markets"
          component={WatchlistScreen}
          options={{ title: 'רשימת מעקב', drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="NewsEarnings"
          component={NewsEarningsScreen}
          options={{ title: 'דיווחי רווח' }}
        />
        <Drawer.Screen
          name="NewsCalendar"
          component={NewsEconomicCalendarScreen}
          options={{ title: 'יומן כלכלי' }}
        />
        <Drawer.Screen
          name="MarketsHeatmap"
          component={MarketsHeatmapScreen}
          options={{ title: 'מפת חום' }}
        />
        <Drawer.Screen
          name="NewsLiked"
          component={LikedArticlesScreen}
          options={{
            title: 'כתבות שמורות',
            drawerItemStyle: { display: 'none' },
          }}
        />
      </Drawer.Navigator>
    </View>
  );
}
