import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NewsScreen from '../screens/News';
import JournalScreen from '../screens/Journal';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { MessageCircle, User, Newspaper, BookOpen, GraduationCap } from 'lucide-react-native';
import ChatStack from '../navigation/ChatStack';
import LearningStack from '../navigation/LearningStack';
import ProfileStack from '../navigation/ProfileStack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../components/ui/DesignTokens';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  console.log('🎓 MainTabs: Rendering...');
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      initialRouteName="Chat"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: DesignTokens.colors.success.main,
        tabBarInactiveTintColor: DesignTokens.colors.text.tertiary,
        tabBarStyle: { 
          backgroundColor: DesignTokens.colors.background.primary, 
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 90 : 70 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 15 : insets.bottom + 10,
          paddingTop: 15,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'Chat') {
            return <MessageCircle size={size + 2} color={color} strokeWidth={2} />;
          } else if (route.name === 'Profile') {
            return <User size={size + 2} color={color} strokeWidth={2} />;
          } else if (route.name === 'News') {
            return <Newspaper size={size + 2} color={color} strokeWidth={2} />;
          } else if (route.name === 'Journal') {
            return <BookOpen size={size + 2} color={color} strokeWidth={2} />;
          } else if (route.name === 'Courses') {
            return <GraduationCap size={size + 2} color={color} strokeWidth={2} />;
          }
          return null;
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
      })}
    >
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
      <Tab.Screen name="Chat" component={ChatStack} options={{ title: 'צאטים' }} />
      <Tab.Screen 
        name="Courses" 
        component={LearningStack} 
        options={{ title: 'קורסים' }}
        listeners={{
          tabPress: () => {
            console.log('🎓 MainTabs: Courses tab pressed');
          },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ title: 'פרופיל' }} />
    </Tab.Navigator>
  );
} 