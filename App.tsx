import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import { View, ActivityIndicator, Text, ImageBackground, StatusBar, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import "./global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { RegistrationProvider } from './context/RegistrationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationService } from './services/notificationService';
import { useDesignTokens } from './components/ui/DesignTokens';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from './services/supabase';

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
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom || 0;

  console.log('🎓 AppContent: Auth state:', { user: user?.id, isLoading });

  // טיפול ב-deep linking עבור OAuth
  useEffect(() => {
    // Handle initial URL (when app opens from a link)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('🔗 AppContent: Initial URL:', initialUrl);
        handleOAuthRedirect(initialUrl);
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 AppContent: URL event:', event.url);
      handleOAuthRedirect(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle OAuth redirect
  const handleOAuthRedirect = async (url: string) => {
    console.log('🔄 AppContent: Handling OAuth redirect:', url);
    
    // Check if this is an OAuth redirect (supports both exp:// and com.darkpool.app://)
    const isOAuthRedirect = url.includes('/oauth') || 
                           url.includes('com.darkpool.app://oauth') ||
                           url.includes('exp://') && url.includes('oauth') ||
                           url.includes('exps://') && url.includes('oauth');
    
    if (isOAuthRedirect) {
      try {
        console.log('✅ AppContent: Detected OAuth redirect, parsing...');
        
        // Extract the URL fragment (everything after #)
        let hash = '';
        if (url.includes('#')) {
          hash = url.split('#')[1];
        } else if (url.includes('?')) {
          // Some redirects use query params instead of hash
          const queryPart = url.split('?')[1];
          hash = queryPart;
        }
        
        if (hash) {
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const error = params.get('error') || params.get('error_description');
          
          if (error) {
            console.error('❌ AppContent: OAuth error:', error);
            return;
          }

          if (accessToken && refreshToken) {
            console.log('✅ AppContent: Got tokens from redirect, setting session...');
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('❌ AppContent: Error setting session:', sessionError);
            } else if (data?.user) {
              console.log('✅ AppContent: Session set successfully, user:', data.user.id);
            }
          } else {
            console.log('⚠️ AppContent: No tokens in redirect URL, waiting for session...');
            // Wait a bit for Supabase to process the redirect
            setTimeout(async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                console.log('✅ AppContent: Session found after delay');
              }
            }, 2000);
          }
        } else {
          console.log('⚠️ AppContent: No hash in redirect URL, waiting for session...');
          // Wait a bit for Supabase to process the redirect
          setTimeout(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              console.log('✅ AppContent: Session found after delay');
            }
          }, 2000);
        }
      } catch (error) {
        console.error('❌ AppContent: Error handling OAuth redirect:', error);
      }
    }
  };

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
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: 'transparent' }}>
      {/* גרדיאנט גלובלי שרץ מתחת לכל המסכים, כולל ה-safe area התחתון וה-MainTabs */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* כיסוי נוסף ל-safe area התחתון ב-Android */}
      {Platform.OS === 'android' && safeBottom > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: safeBottom,
            backgroundColor: '#000000', // צבע הגרדיאנט בתחתית
            zIndex: -1,
          }}
        />
      )}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      <NavigationContainer 
        ref={navigationRef}
        theme={{
          dark: true,
          colors: {
            primary: DesignTokens.colors.primary.main,
            background: 'transparent',
            card: 'transparent',
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
              backgroundColor: 'transparent',
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
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
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
    </SafeAreaProvider>
  );
}
