import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import NewsScreen from '../screens/News';
import JournalScreen from '../screens/Journal';
import MarketsScreen from '../screens/Markets/MarketsScreen';
import { View, Platform, StyleSheet } from 'react-native';
import { Newspaper, BookOpen, GraduationCap, Users, TrendingUp } from 'lucide-react-native';
import ChatStack from '../navigation/ChatStack';
import LearningStack from '../navigation/LearningStack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import React from 'react';

const Tab = createBottomTabNavigator();

// קומפוננטה לאייקון הקהילה מ-SVG (ico-32-communities-2.svg)
const CommunitiesIcon = ({ size, color }: { size: number; color: string }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 6.96672C14.4004 6.96672 12.9667 8.43169 12.9667 10.4167C12.9667 12.4018 14.4004 13.8667 16 13.8667C17.5996 13.8667 19.0333 12.4018 19.0333 10.4167C19.0333 8.43169 17.5996 6.96672 16 6.96672ZM11.3667 10.4167C11.3667 7.70734 13.3654 5.36672 16 5.36672C18.6346 5.36672 20.6333 7.70734 20.6333 10.4167C20.6333 13.1261 18.6346 15.4667 16 15.4667C13.3654 15.4667 11.3667 13.1261 11.3667 10.4167ZM9.91579 21.1994C8.65548 22.3383 8.01768 23.7137 7.70973 24.6403C7.70815 24.6451 7.7072 24.6488 7.70665 24.6516C7.7062 24.6539 7.706 24.6555 7.70593 24.6567L7.70738 24.659L7.709 24.6611C7.7181 24.6725 7.75003 24.7001 7.8159 24.7001H24.1841C24.25 24.7001 24.2819 24.6725 24.291 24.6611C24.2927 24.6591 24.2936 24.6576 24.2941 24.6567C24.2939 24.6541 24.2931 24.6489 24.2903 24.6403C23.9823 23.7137 23.3445 22.3383 22.0842 21.1994C20.8409 20.0757 18.9392 19.1334 16 19.1334C13.0609 19.1334 11.1592 20.0757 9.91579 21.1994ZM8.843 20.0123C10.3926 18.6119 12.6811 17.5334 16 17.5334C19.3189 17.5334 21.6074 18.6119 23.157 20.0123C24.6897 21.3974 25.4476 23.0493 25.8086 24.1357C26.1997 25.3124 25.2471 26.3001 24.1841 26.3001H7.8159C6.75296 26.3001 5.80034 25.3124 6.19138 24.1357C6.55243 23.0493 7.31034 21.3974 8.843 20.0123ZM23.9667 12.5C23.9667 11.28 24.819 10.4666 25.6667 10.4666C26.5144 10.4666 27.3667 11.28 27.3667 12.5C27.3667 13.72 26.5144 14.5333 25.6667 14.5333C24.819 14.5333 23.9667 13.72 23.9667 12.5ZM25.6667 8.86664C23.753 8.86664 22.3667 10.5904 22.3667 12.5C22.3667 14.4096 23.753 16.1333 25.6667 16.1333C27.5804 16.1333 28.9667 14.4096 28.9667 12.5C28.9667 10.5904 27.5804 8.86664 25.6667 8.86664ZM27.4838 24.8H30.25C31.0829 24.8 31.8665 24.0982 31.7251 23.1389C31.6078 22.3428 31.294 21.0402 30.4268 19.9211C29.5297 18.7635 28.0872 17.8667 25.8781 17.8667C24.9945 17.8667 24.239 18.0231 23.5963 18.2888C24.0942 18.6815 24.5441 19.1056 24.9499 19.5491C25.2308 19.4958 25.5391 19.4667 25.8781 19.4667C27.5879 19.4667 28.5652 20.131 29.1621 20.9012C29.7371 21.6432 29.9988 22.5393 30.1144 23.2H27.2157C27.3679 23.7514 27.4449 24.3336 27.4838 24.8ZM4.78576 23.2H1.88099C1.99125 22.5346 2.24171 21.6316 2.79203 20.886C3.35969 20.117 4.27762 19.4667 5.87808 19.4667C6.30293 19.4667 6.68255 19.5077 7.02235 19.5811C7.42229 19.1409 7.86541 18.7193 8.35548 18.3282C7.66403 18.0383 6.84441 17.8667 5.87808 17.8667C3.74646 17.8667 2.35997 18.7772 1.50475 19.9358C0.679614 21.0536 0.382224 22.3523 0.271047 23.144C0.136963 24.0989 0.915936 24.8 1.75003 24.8H4.51764C4.55649 24.3336 4.63354 23.7514 4.78576 23.2ZM6.33335 10.4666C5.48563 10.4666 4.63335 11.28 4.63335 12.5C4.63335 13.72 5.48563 14.5333 6.33335 14.5333C7.18108 14.5333 8.03335 13.72 8.03335 12.5C8.03335 11.28 7.18108 10.4666 6.33335 10.4666ZM3.03335 12.5C3.03335 10.5904 4.41965 8.86664 6.33335 8.86664C8.24705 8.86664 9.63335 10.5904 9.63335 12.5C9.63335 14.4096 8.24705 16.1333 6.33335 16.1333C4.41965 16.1333 3.03335 14.4096 3.03335 12.5Z"
        fill={color}
      />
    </Svg>
  );
};

// רקע מעודן עם blur - כמו ב-UICard variant="blur"
const TabBarBackground = () => {
  const DesignTokens = useDesignTokens();
  
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={40}
        tint="dark"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(15, 15, 15, 0.5)',
          }
        ]}
      />
    );
  }
  
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: 'rgba(20, 20, 20, 0.7)',
        },
      ]}
    />
  );
};

export default function MainTabs() {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom || 0;
  
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Tab.Navigator
        initialRouteName="Markets"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: DesignTokens.colors.primary.main,
          tabBarInactiveTintColor: DesignTokens.colors.text.tertiary,
          tabBarBackground: () => <TabBarBackground />,
          tabBarStyle: { 
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            // גובה קבוע + padding bottom שמתחשב ב-safe area
            height: 60 + safeBottom,
            paddingBottom: safeBottom > 0 ? safeBottom + 8 : 8,
            paddingTop: 10,
            paddingHorizontal: DesignTokens.spacing.md, // padding פנימי לתוכן בלבד
            marginHorizontal: 0, // מצד לצד
            marginBottom: 0,
            marginTop: 0,
            borderTopLeftRadius: DesignTokens.borderRadius['2xl'], // פינה מעוגלת למעלה משמאל
            borderTopRightRadius: DesignTokens.borderRadius['2xl'], // פינה מעוגלת למעלה מימין
            borderBottomLeftRadius: 0, // ללא עיגול למטה
            borderBottomRightRadius: 0, // ללא עיגול למטה
            overflow: 'hidden',
            position: 'absolute',
            left: 0,
            right: 0,
            // מוצמד למטה, ה-safe area מטופל דרך paddingBottom
            bottom: 0,
            width: '100%', // מצד לצד
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderBottomWidth: 0, // ללא גבול תחתון
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: Platform.OS === 'android' ? 10 : 0,
          },
          tabBarIcon: ({ color, size, focused }) => {
            const iconSize = focused ? size + 2 : size;
            const strokeWidth = focused ? 2.5 : 2;
            
            if (route.name === 'Markets') {
              return <TrendingUp size={iconSize} color={color} strokeWidth={strokeWidth} />;
            } else if (route.name === 'Chat') {
              return <Users size={iconSize} color={color} strokeWidth={strokeWidth} />;
            } else if (route.name === 'News') {
              return <Newspaper size={iconSize} color={color} strokeWidth={strokeWidth} />;
            } else if (route.name === 'Journal') {
              return <BookOpen size={iconSize} color={color} strokeWidth={strokeWidth} />;
            } else if (route.name === 'Courses') {
              return <GraduationCap size={iconSize} color={color} strokeWidth={strokeWidth} />;
            }
            return null;
          },
          tabBarLabelStyle: {
            fontSize: DesignTokens.typography.fontSize.xs,
            marginTop: 4,
            fontWeight: DesignTokens.typography.fontWeight.semibold as any,
            letterSpacing: DesignTokens.typography.letterSpacing.tight,
          },
        })}
      >
      <Tab.Screen 
        name="Markets" 
        component={MarketsScreen} 
        options={{ title: 'שווקים' }}
        listeners={{
          tabPress: (e) => {
            console.log('📈 MainTabs: Markets tab pressed', e);
          },
          focus: () => {
            console.log('📈 MainTabs: Markets tab focused');
          },
        }}
      />
      <Tab.Screen 
        name="News" 
        component={NewsScreen} 
        options={{ title: 'חדשות' }}
        listeners={{
          tabPress: (e) => {
            console.log('📰 MainTabs: News tab pressed', e);
          },
          focus: () => {
            console.log('📰 MainTabs: News tab focused');
          },
        }}
      />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ title: 'יומן' }} />
      <Tab.Screen 
        name="Chat" 
        component={ChatStack} 
        options={({ route }) => ({
          title: 'קהילה',
          tabBarStyle: ((route) => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? 'ChatGroupsList';
            
            // הסתר טאבים במסכי הצ'אט והמידע
            if (routeName === 'ChatGroup' || routeName === 'ChatGroupInfo' || routeName === 'SavedMedia' || routeName === 'PrivacySupport') {
              return { display: 'none' };
            }
            
            // הצג טאבים ברשימת הקבוצות - מצד לצד עם פינות מעוגלות למעלה
            // ה-safe area מטופל דרך paddingBottom
            return {
              height: 60 + safeBottom,
              paddingBottom: safeBottom > 0 ? safeBottom + 8 : 8,
              paddingTop: 10,
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              paddingHorizontal: DesignTokens.spacing.md, // padding פנימי לתוכן בלבד
              marginHorizontal: 0, // מצד לצד
              marginBottom: 0,
              marginTop: 0,
              borderTopLeftRadius: DesignTokens.borderRadius['2xl'],
              borderTopRightRadius: DesignTokens.borderRadius['2xl'],
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              overflow: 'hidden',
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%', // מצד לצד
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              borderBottomWidth: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: Platform.OS === 'android' ? 10 : 0,
            };
          })(route),
        })}
      />
      <Tab.Screen 
        name="Courses" 
        component={LearningStack} 
        options={{ title: 'אקדמיה' }}
        listeners={{
          tabPress: () => {
            console.log('🎓 MainTabs: Courses tab pressed');
          },
        }}
      />
      </Tab.Navigator>
    </View>
  );
} 