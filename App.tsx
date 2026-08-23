import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DarkTheme, NavigationContainer, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import ProfileStack from './navigation/ProfileStack';
import AdminStack from './navigation/AdminStack';
import { View, ActivityIndicator, Text, StyleSheet, AppState, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedBackground } from './components/VideoBackground';
import "./global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { RegistrationProvider, useRegistration } from './context/RegistrationContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import ScheduledUpdatesService from './services/scheduledUpdates';
import { NotificationService } from './services/notificationService';
import { initSentry, Sentry } from './utils/sentry';
import { ToastProvider } from './components/ui/Toast';
import { AppDialogProvider } from './components/ui/AppDialogProvider';
import { logger } from './utils/logger';
import { ErrorBoundary } from './components/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from './utils/hapticFeedback';
import { Fingerprint } from 'lucide-react-native';
import { rootNavigationRef } from './navigation/rootNavigationRef';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { isRegistrationComplete } from './services/authService';
import { APP_SYSTEM_BACKGROUND, applyAppSystemUI } from './lib/androidSystemUI';
import {
  buildNotificationNavigateArgs,
  resolveNotificationNavTarget,
} from './lib/notificationRouting';

// מסכים לא-פעילים (כל ה-stacks ב-Drawer נשארים טעונים) מוקפאים ולא מתרנדרים ברקע —
// משחרר את ה-JS thread ומשפר משמעותית את חלקות הניווט והאינטראקציות.
enableScreens(true);
enableFreeze(true);

initSentry();

const Stack = createNativeStackNavigator();

/** Dark theme for Navigation Background/card — DefaultTheme is light and paints white under edge-to-edge bars. */
const AppNavigationTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#00C805',
    background: APP_SYSTEM_BACKGROUND,
    card: APP_SYSTEM_BACKGROUND,
    border: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    notification: '#00C805',
  },
};

function AppContent() {
  const { user, isLoading, passwordRecoveryMode, signOut } = useAuth();
  const { data: registrationData } = useRegistration();
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const appState = useRef(AppState.currentState);
  /** רק אחרי מעבר ראשון מ-loading — לנקות סשן רישום ישן ב-cold start בלי לפגוע ב-Google/OTP חי */
  const bootAuthHandledRef = useRef(false);
  // באמצע אשף הרישום עבור אותו משתמש מחובר — לא מדלגים ל-Main גם אם הפרופיל עוד לא מעודכן
  const midRegistrationWizard =
    !!user &&
    (registrationData.pendingAuthUserId === user.id ||
      (registrationData.isGoogleSignUp && registrationData.googleUserId === user.id) ||
      (registrationData.emailVerified &&
        !!registrationData.email &&
        registrationData.email.toLowerCase() === (user.email || '').toLowerCase()));
  // passwordRecoveryMode חוסם Main בזמן איפוס סיסמה — אחרי signIn רגיל הדגל מנוקה
  const registrationDone =
    isRegistrationComplete(user) && !midRegistrationWizard && !passwordRecoveryMode;
  // Warm/hydrate רק אחרי רישום מלא — לא לבזבז רשת באמצע OTP
  useAppBootstrap(user?.id, !isLoading && registrationDone);

  // Cold start: סשן OTP/רישום לא-הושלם בלי כוונת המשך פעילה → Welcome (לא Onboarding)
  // לא רצים בזמן recovery — אחרת מסלקים את סשן ה-OTP לפני מסך סיסמה חדשה
  useEffect(() => {
    if (isLoading || bootAuthHandledRef.current) return;
    bootAuthHandledRef.current = true;
    if (!user || passwordRecoveryMode) return;
    if (isRegistrationComplete(user) || midRegistrationWizard) return;
    void signOut(true);
  }, [isLoading, user, passwordRecoveryMode, midRegistrationWizard, signOut]);

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
    if (!user || !registrationDone || isLoading || biometricChecked) return;

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
  }, [user, registrationDone, isLoading, biometricChecked]);

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

  useEffect(() => {
    void applyAppSystemUI().catch((error) => {
      logger.warn('App', 'Failed to configure Android system UI', error);
    });

    // Modals / sheets / keyboard can leave system bars in a bad state — re-apply on resume.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void applyAppSystemUI();
      }
    });
    return () => sub.remove();
  }, []);

  // אתחול עדכונים מתוזמנים
  useEffect(() => {
    // התחלת עדכונים מתוזמנים רק אחרי שהמשתמש מחובר והשלים רישום
    if (user && registrationDone && !isLoading) {
      ScheduledUpdatesService.startScheduledUpdates();
    }

    return () => {
      ScheduledUpdatesService.stopScheduledUpdates();
    };
  }, [user, registrationDone, isLoading]);

  // משתמש חדש (Google / pending payment) — העברה ל-Onboarding בלי לדלג ל-Main
  // הוסר: navigation לא צריך להיות ב-useEffect כי ה-conditional rendering כבר מטפל בזה

  // טיפול בהתראות — tap (foreground/background) + cold start
  useEffect(() => {
    if (!user || !registrationDone) return;

    const handledKeys = new Set<string>();

    const responseKey = (response: {
      notification: { request: { identifier: string }; date?: number };
    }) =>
      `${response.notification.request.identifier}:${response.notification.date ?? ''}`;

    const navigateFromNotificationData = (raw: unknown) => {
      const data =
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
      const target = resolveNotificationNavTarget(data);
      const args = buildNotificationNavigateArgs(target);

      const attempt = (triesLeft: number) => {
        if (!rootNavigationRef.isReady()) {
          if (triesLeft <= 0) {
            logger.warn('App', 'Notification navigation skipped — nav not ready');
            return;
          }
          setTimeout(() => attempt(triesLeft - 1), 120);
          return;
        }
        try {
          if (args.params) {
            rootNavigationRef.navigate(args.name as never, args.params as never);
          } else {
            rootNavigationRef.navigate(args.name as never);
          }
        } catch (navError) {
          logger.error('App', 'Notification navigation failed', navError);
        }
      };
      attempt(25);
    };

    const handleResponse = (response: {
      notification: {
        request: { identifier: string; content: { data?: unknown } };
        date?: number;
      };
    }) => {
      const key = responseKey(response);
      if (handledKeys.has(key)) return;
      handledKeys.add(key);
      navigateFromNotificationData(response.notification.request.content.data);
      NotificationService.clearLastNotificationResponse();
    };

    const receivedSubscription = NotificationService.addNotificationReceivedListener(
      (_notification) => {},
    );

    const responseSubscription =
      NotificationService.addNotificationResponseReceivedListener(handleResponse);

    let cancelled = false;
    void NotificationService.getLastNotificationResponse().then((response) => {
      if (cancelled || !response) return;
      handleResponse(response);
    });

    return () => {
      cancelled = true;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [user, registrationDone]);

  // מסך טעינה מינימלי בלבד בזמן טעינת ה-Auth (בלי splash \"מלאכותי\" ובלי תמונת רקע מרשת)
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00C805" />
      </View>
    );
  }

  // לא מציגים את ה-Main לפני שידוע אם נדרשת ביומטריה — מונע תחושת "זריקה" לשכבת הנעילה
  if (user && registrationDone && !biometricChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00C805" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: APP_SYSTEM_BACKGROUND }}>
      {/* KeyboardProvider בתוך עץ LTR — ה-dummy translateX של הספרייה לא מתהפך מ-forceRTL כמו מחוץ למעטפת (פרודקשן ≠ Expo Go). */}
      <KeyboardProvider
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
      >
      <AnimatedBackground />
      {/* edge-to-edge: רק style — backgroundColor/translucent נדחים באנדרואיד 15+ */}
      <StatusBar style="light" />
      {/* חייב להתאים ל־direction של ה־View המעטף — אחרת useLocale (rtl) לא תואם ל־Yoga (ltr) ו־react-native-drawer-layout מחשב translateX שגוי (רצועת מגירה בפרודקשן). */}
      <NavigationContainer ref={rootNavigationRef} direction="ltr" theme={AppNavigationTheme}>
        <Stack.Navigator screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}>
          {user && registrationDone ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Profile" component={ProfileStack} />
              <Stack.Screen name="Admin" component={AdminStack} />
            </>
          ) : midRegistrationWizard && !passwordRecoveryMode ? (
            <>
              {/* אשף רישום פעיל (OTP/Google באמצע) — ממשיכים Onboarding רק עם כוונת המשך */}
              <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
              <Stack.Screen name="Auth" component={AuthStack} />
            </>
          ) : (
            // מנותק / סשן לא-הושלם / recovery — נשארים ב-Auth
            // (registrationDone כבר false כש-passwordRecoveryMode; ענף נפרד גרם ל-remount
            // של AuthStack באמצע OTP וזריקת משתמש ל-Main)
            <Stack.Screen name="Auth" component={AuthStack} />
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {biometricLocked && registrationDone && (
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
      </KeyboardProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_SYSTEM_BACKGROUND }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RegistrationProvider>
                <ToastProvider>
                  <AppDialogProvider>
                    {/* ErrorBoundary פנימי — קריסת UI לא מפרקת AuthProvider באמצע signOut */}
                    <ErrorBoundary>
                      <AppContent />
                    </ErrorBoundary>
                  </AppDialogProvider>
                </ToastProvider>
              </RegistrationProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
