import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import ProfileStack from './navigation/ProfileStack';
import { View, ActivityIndicator, Text, StatusBar, StyleSheet, AppState, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedBackground } from './components/VideoBackground';
import "./global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { RegistrationProvider } from './context/RegistrationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduledUpdatesService from './services/scheduledUpdates';
import { NotificationService } from './services/notificationService';
import { initSentry, Sentry } from './utils/sentry';
import { ToastProvider } from './components/ui/Toast';
import { AppDialogProvider } from './components/ui/AppDialogProvider';
import { logger } from './utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from './utils/hapticFeedback';
import { Fingerprint } from 'lucide-react-native';
import { rootNavigationRef } from './navigation/rootNavigationRef';

initSentry();

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
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const appState = useRef(AppState.currentState);

  const attemptBiometricAuth = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'אמת את זהותך כדי להיכנס לאפליקציה',
        cancelLabel: 'ביטול',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricLocked(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || isLoading || biometricChecked) return;

    const checkBiometric = async () => {
      try {
        const saved = await AsyncStorage.getItem('appSettings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.biometricAuth) {
            setBiometricLocked(true);
            setBiometricChecked(true);
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'אמת את זהותך כדי להיכנס לאפליקציה',
              cancelLabel: 'ביטול',
              disableDeviceFallback: false,
            });
            if (result.success) {
              setBiometricLocked(false);
            }
            return;
          }
        }
      } catch {}
      setBiometricChecked(true);
    };

    checkBiometric();
  }, [user, isLoading, biometricChecked]);

  useEffect(() => {
    if (!user) {
      setBiometricChecked(false);
      setBiometricLocked(false);
    }
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && user) {
        try {
          const saved = await AsyncStorage.getItem('appSettings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.biometricAuth) {
              setBiometricLocked(true);
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'אמת את זהותך כדי להיכנס לאפליקציה',
                cancelLabel: 'ביטול',
                disableDeviceFallback: false,
              });
              if (result.success) {
                setBiometricLocked(false);
              }
            }
          }
        } catch {}
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    HapticFeedback.init();
  }, []);

  // אתחול עדכונים מתוזמנים
  useEffect(() => {
    // התחלת עדכונים מתוזמנים רק אחרי שהמשתמש מחובר
    if (user && !isLoading) {
      ScheduledUpdatesService.startScheduledUpdates();
    }

    return () => {
      ScheduledUpdatesService.stopScheduledUpdates();
    };
  }, [user, isLoading]);

  // טיפול בהתראות
  useEffect(() => {
    if (!user) return;

    const receivedSubscription = NotificationService.addNotificationReceivedListener((_notification) => {
    });

    const responseSubscription = NotificationService.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const notificationType = data?.type;

      if (!rootNavigationRef.isReady()) return;

      try {
        if (notificationType === 'chat_message' && data?.group_id) {
          rootNavigationRef.navigate('Main', {
            screen: 'Chat',
            params: {
              screen: 'ChatGroup',
              params: {
                groupId: data.group_id,
                groupName: data.group_name || 'צ\'אט',
              },
            },
          });
        } else if (notificationType === 'news' && data?.articleId) {
          rootNavigationRef.navigate('Main', {
            screen: 'News',
            params: { articleId: data.articleId, tab: 'breaking' }
          });
        } else if (notificationType === 'economic_calendar') {
          rootNavigationRef.navigate('Main', {
            screen: 'News',
            params: { tab: 'calendar' }
          });
        } else {
          rootNavigationRef.navigate('Main');
        }
      } catch (navError) {
        logger.error('App', 'Notification navigation failed', navError);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [user]);

  // מסך טעינה מינימלי בלבד בזמן טעינת ה-Auth (בלי splash \"מלאכותי\" ובלי תמונת רקע מרשת)
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00C805" />
      </View>
    );
  }

  // לא מציגים את ה-Main לפני שידוע אם נדרשת ביומטריה — מונע תחושת "זריקה" לשכבת הנעילה
  if (user && !biometricChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00C805" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: '#0A0E0A' }}>
      <AnimatedBackground />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={false}
      />
      <NavigationContainer ref={rootNavigationRef}>
        <Stack.Navigator screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}>
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Profile" component={ProfileStack} />
            </>
          ) : (
            <>
              <Stack.Screen name="Auth" component={AuthStack} />
              <Stack.Screen name="Onboarding" component={OnboardingWithProvider} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {biometricLocked && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0E0A', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
          <LinearGradient
            colors={['#0A0E0A', '#0F1A0F', '#0F1A0F', '#0A0E0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ alignItems: 'center', gap: 24 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(0, 230, 84, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Fingerprint size={40} color="#00C805" strokeWidth={2} />
            </View>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              האפליקציה נעולה
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', paddingHorizontal: 40 }}>
              אמת את זהותך באמצעות Face ID / Touch ID כדי להמשיך
            </Text>
            <TouchableOpacity
              onPress={attemptBiometricAuth}
              style={{
                backgroundColor: '#00C805',
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 40,
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>
                אמת זהות
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0E0A' }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppDialogProvider>
                  <AppContent />
                </AppDialogProvider>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
