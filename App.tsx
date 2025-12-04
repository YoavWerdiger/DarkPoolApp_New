import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import { View, ActivityIndicator, Text, ImageBackground, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import "./global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { RegistrationProvider } from './context/RegistrationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationService } from './services/notificationService';
import { useDesignTokens } from './components/ui/DesignTokens';

const Stack = createNativeStackNavigator();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const OnboardingWithProvider = () => (
  <RegistrationProvider>
    <OnboardingNavigator />
  </RegistrationProvider>
);

function AppContent() {
  const { user, isLoading } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const DesignTokens = useDesignTokens();

  console.log('🎓 AppContent: Auth state:', { user: user?.id, isLoading });

  // טיפול בהתראות
  useEffect(() => {
    if (!user) return;

    console.log('📱 AppContent: Setting up notification listeners');

    // טיפול בהתראה שמגיעה כשהאפליקציה פתוחה
    const receivedSubscription = NotificationService.addNotificationReceivedListener((notification) => {
      console.log('📬 AppContent: Notification received:', notification);
      // ההתראה תוצג אוטומטית על ידי Expo
    });

    // טיפול בלחיצה על התראה
    const responseSubscription = NotificationService.addNotificationResponseReceivedListener((response) => {
      console.log('👆 AppContent: Notification tapped:', response);
      
      const data = response.notification.request.content.data;
      const notificationType = data?.type;

      if (!navigationRef.current) {
        console.log('⚠️ AppContent: Navigation ref not ready');
        return;
      }

      try {
        if (notificationType === 'news' && data?.articleId) {
          // ניווט לטאב חדשות
          console.log('📰 AppContent: Navigating to News tab');
          navigationRef.current.navigate('Main', {
            screen: 'News',
            params: { articleId: data.articleId }
          });
        } else {
          // ניווט למסך הראשי
          console.log('🏠 AppContent: Navigating to Main');
          navigationRef.current.navigate('Main');
        }
      } catch (error) {
        console.error('❌ AppContent: Error navigating:', error);
      }
    });

    return () => {
      console.log('🧹 AppContent: Cleaning up notification listeners');
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <LinearGradient 
          colors={['rgba(0,230,84,0.08)', 'rgba(0,230,84,0.03)', 'rgba(0,230,84,0.05)']} 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 32,
            paddingVertical: 24,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(0,230,84,0.2)'
          }}>
            <ActivityIndicator size="large" color="#05d157" />
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 16, 
              fontWeight: '500',
              marginTop: 16,
              textAlign: 'center'
            }}>
              טוען אפליקציה...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: DesignTokens.colors.background.primary }}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={DesignTokens.colors.background.primary}
        translucent={false}
      />
      <NavigationContainer 
        ref={navigationRef}
        theme={{
          dark: true,
          colors: {
            primary: DesignTokens.colors.primary.main,
            background: DesignTokens.colors.background.primary,
            card: DesignTokens.colors.background.primary,
            text: DesignTokens.colors.text.primary,
            border: DesignTokens.colors.border.main,
            notification: DesignTokens.colors.primary.main,
          },
          fonts: {
            regular: {
              fontFamily: Array.isArray(DesignTokens.typography.fontFamily.system) 
                ? DesignTokens.typography.fontFamily.system[0] 
                : 'System',
              fontWeight: '400' as const,
            },
            medium: {
              fontFamily: Array.isArray(DesignTokens.typography.fontFamily.system) 
                ? DesignTokens.typography.fontFamily.system[0] 
                : 'System',
              fontWeight: '500' as const,
            },
            bold: {
              fontFamily: Array.isArray(DesignTokens.typography.fontFamily.system) 
                ? DesignTokens.typography.fontFamily.system[0] 
                : 'System',
              fontWeight: '700' as const,
            },
            heavy: {
              fontFamily: Array.isArray(DesignTokens.typography.fontFamily.system) 
                ? DesignTokens.typography.fontFamily.system[0] 
                : 'System',
              fontWeight: '800' as const,
            },
          },
        }}
      >
        <Stack.Navigator 
          screenOptions={{ 
            headerShown: false,
            contentStyle: {
              backgroundColor: DesignTokens.colors.background.primary,
            },
          }}
        >
          {user ? (
              <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <>
              <Stack.Screen name="Auth" component={AuthStack} />
              <Stack.Screen name="Onboarding" component={OnboardingWithProvider} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
