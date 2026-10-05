import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import ProfileStack from './navigation/ProfileStack';
import AdminStack from './navigation/AdminStack';
import { View, Text, StyleSheet, AppState, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuroraHost } from './components/VideoBackground';
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
import { AppLaunchScreen } from './components/AppLaunchScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from './utils/hapticFeedback';
import { Fingerprint } from 'lucide-react-native';
import { rootNavigationRef } from './navigation/rootNavigationRef';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { isRegistrationComplete } from './services/authService';
import { APP_SYSTEM_BACKGROUND, applyAppSystemUI } from './lib/androidSystemUI';
import { installAppFont } from './components/ui/appFont';
import { useLoadAppFonts } from './components/ui/useLoadAppFonts';
import {
  buildNotificationNavigateArgs,
  resolveNotificationNavTarget,
} from './lib/notificationRouting';
import { warmChatGroupOnPress } from './services/appPrefetch';
import { lockAndroidChatSoftInput } from './components/chat/androidChatKeyboard';
import { ShareIntentProvider } from 'expo-share-intent';
import { useIncomingShare } from './hooks/useIncomingShare';
import { clearShareTargets } from './lib/shareTargets';
import { DeviceConflictScreen } from './components/DeviceConflictScreen';
import { checkActiveDevice, installDeviceClaimOnSignIn, subscribeActiveDevice } from './services/deviceSession';
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
    border: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    notification: '#00C805',
  },
};

function AppContent() {
  const { user, isLoading, passwordRecoveryMode, signOut } = useAuth();
  const { isDarkMode, theme: appTheme } = useTheme();
  const canvas = isDarkMode ? APP_SYSTEM_BACKGROUND : appTheme.background;
  const navigationTheme = useMemo<NavTheme>(() => {
    if (isDarkMode) return AppNavigationTheme;
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: '#00C805',
        background: appTheme.background,
        card: appTheme.cardBackground,
        text: appTheme.textPrimary,
        border: appTheme.border,
        notification: '#00C805',
      },
    };
  }, [
    appTheme.background,
    appTheme.border,
    appTheme.cardBackground,
    appTheme.textPrimary,
    isDarkMode,
  ]);
  const { data: registrationData } = useRegistration();
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const appState = useRef(AppState.currentState);
  const [launchDone, setLaunchDone] = useState(false);
  const [appRevealed, setAppRevealed] = useState(false);
  const revealApp = useCallback(() => setAppRevealed(true), []);
  const finishLaunch = useCallback(() => setLaunchDone(true), []);
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

  // מכשיר פעיל יחיד: התחברות טרייה תופסת את המכשיר; מכשיר שנזרק → מסך התנתקות
  useEffect(() => installDeviceClaimOnSignIn(), []);
  const [deviceConflict, setDeviceConflict] = useState(false);
  useEffect(() => {
    if (isLoading || !user?.id || !registrationDone) {
      setDeviceConflict(false);
      return;
    }
    let alive = true;
    const check = async () => {
      const state = await checkActiveDevice();
      if (alive) setDeviceConflict(state === 'conflict');
    };
    void check();
    const unsubscribe = subscribeActiveDevice(user.id, () => {
      if (alive) setDeviceConflict(true);
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      alive = false;
      unsubscribe();
      appStateSub.remove();
    };
  }, [isLoading, user?.id, registrationDone]);

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
    const mode = isDarkMode ? 'dark' : 'light';
    void applyAppSystemUI(mode).catch((error) => {
      logger.warn('App', 'Failed to configure Android system UI', error);
    });

    // Modals / sheets / keyboard can leave system bars in a bad state — re-apply on resume.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void applyAppSystemUI(mode);
      }
    });
    return () => sub.remove();
  }, [isDarkMode]);

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
      if (target.kind === 'chat' && user.id && target.groupId) {
        lockAndroidChatSoftInput();
        warmChatGroupOnPress(user.id, target.groupId);
      }
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

  useIncomingShare(!!user && registrationDone && biometricChecked && !biometricLocked);

  useEffect(() => {
    if (!isLoading && !user) clearShareTargets();
  }, [isLoading, user]);

  // מסך פתיחה: ממשיך מה-splash הנייטיב עד שה-Auth (וה-check הביומטרי) מוכנים.
  // עץ האפליקציה נטען מתחתיו רק כשהפס מלא ועומד (appRevealed) — כדי שה-mount הכבד לא ייפול על אנימציה.
  const bootReady = !isLoading && !(user && registrationDone && !biometricChecked);

  return (
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: canvas }}>
      {bootReady && (appRevealed || launchDone) && (
      <>
      {/* KeyboardProvider בתוך עץ LTR — ה-dummy translateX של הספרייה לא מתהפך מ-forceRTL כמו מחוץ למעטפת (פרודקשן ≠ Expo Go). */}
      <KeyboardProvider
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
      >
      <AuroraHost>
      {/* edge-to-edge: רק style — backgroundColor/translucent נדחים באנדרואיד 15+ */}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* חייב להתאים ל־direction של ה־View המעטף — אחרת useLocale (rtl) לא תואם ל־Yoga (ltr) ו־react-native-drawer-layout מחשב translateX שגוי (רצועת מגירה בפרודקשן). */}
      <NavigationContainer ref={rootNavigationRef} direction="ltr" theme={navigationTheme}>
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

      {deviceConflict && registrationDone && !biometricLocked ? (
        <DeviceConflictScreen
          onSignOut={() => {
            setDeviceConflict(false);
            void signOut();
          }}
        />
      ) : null}

      {biometricLocked && registrationDone && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: canvas, justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
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
            <Text style={{ color: appTheme.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              האפליקציה נעולה
            </Text>
            <Text style={{ color: appTheme.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 40 }}>
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
      </AuroraHost>
      </KeyboardProvider>
      </>
      )}
      {!launchDone && <AppLaunchScreen ready={bootReady} onRevealApp={revealApp} onFinish={finishLaunch} />}
    </View>
  );
}

export default function App() {
  const fontsLoaded = useLoadAppFonts();
  if (fontsLoaded) installAppFont();

  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_SYSTEM_BACKGROUND }} />
    );
  }

  return (
    <ShareIntentProvider>
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
    </ShareIntentProvider>
  );
}
