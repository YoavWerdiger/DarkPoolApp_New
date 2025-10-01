import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NewsScreen from '../screens/News';
import JournalScreen from '../screens/Journal';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { MessageCircle, User, Newspaper, BookOpen, GraduationCap } from 'lucide-react-native';
import ChatStack from '../navigation/ChatStack';
import LearningStack from '../navigation/LearningStack';
import ProfileStack from '../navigation/ProfileStack';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  console.log('🎓 MainTabs: Rendering...');
  
  return (
    <Tab.Navigator
      initialRouteName="Chat"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#00E654',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { 
          backgroundColor: '#121212', 
          borderTopWidth: 0,
          height: 90,
          paddingBottom: 15,
          paddingTop: 15,
        },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'Chat') {
            return (
              <View 
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: focused ? '#00E654' : '#222222',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -15,
                  shadowColor: focused ? '#00E654' : '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: focused ? 0.3 : 0.2,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <MessageCircle 
                  size={focused ? 36 : 32} 
                  color={focused ? '#000' : color}
                  strokeWidth={2}
                />
              </View>
            );
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
      <Tab.Screen name="News" component={NewsScreen} options={{ title: 'חדשות' }} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ title: 'יומן' }} />
      <Tab.Screen name="Chat" component={ChatStack} options={{ title: '' }} />
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