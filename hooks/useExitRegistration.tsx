import React, { createContext, useCallback, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useRegistration } from '../context/RegistrationContext';
import { showAppConfirm } from '../utils/appDialog';
import { HapticFeedback } from '../utils/hapticFeedback';

export type RegistrationExitFn = () => Promise<void>;

const RegistrationExitContext = createContext<RegistrationExitFn | null>(null);

/**
 * יציאה מאשף הרישום: אישור → איפוס נתונים מקומיים → signOut (אם יש סשן)
 * או ניווט ל-Login (אם הרישום רץ בלי סשן תחת AuthStack).
 *
 * חייב לרוץ בתוך מסך/Navigator שכבר בתוך NavigationContainer
 * (למשל כעטיפת OnboardingNavigator).
 */
export function useExitRegistration(): RegistrationExitFn {
  const { signOut, user } = useAuth();
  const { resetData } = useRegistration();
  const navigation = useNavigation<any>();
  const exitingRef = useRef(false);

  return useCallback(async () => {
    if (exitingRef.current) return;
    void HapticFeedback.impactLight();

    const ok = await showAppConfirm(
      'לצאת מהרישום?',
      'ההתקדמות הנוכחית לא תישמר. תוכל להתחבר או להירשם מחדש בכל עת.',
      {
        confirmText: 'יציאה',
        cancelText: 'המשך רישום',
        destructive: true,
      }
    );
    if (!ok) return;

    exitingRef.current = true;
    try {
      resetData();
      try {
        await AsyncStorage.setItem('explicit_logout', 'true');
      } catch {
        /* non-critical */
      }

      if (user) {
        // App.tsx מחליף ל-Auth/Login כש-user מתאפס — לא קוראים goBack
        await signOut(true);
        return;
      }

      // רישום בלי סשן (Auth → Register): חזרה ל-Login בלי GO_BACK על stack ריק
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    } finally {
      exitingRef.current = false;
    }
  }, [navigation, resetData, signOut, user]);
}

export function RegistrationExitProvider({ children }: { children: React.ReactNode }) {
  const exitRegistration = useExitRegistration();
  return (
    <RegistrationExitContext.Provider value={exitRegistration}>
      {children}
    </RegistrationExitContext.Provider>
  );
}

/** null מחוץ ל-OnboardingNavigator (למשל ForgotPassword) */
export function useRegistrationExitOptional(): RegistrationExitFn | null {
  return useContext(RegistrationExitContext);
}

/**
 * חזרה בטוחה ברישום — לעולם לא goBack בלי canGoBack (מונע GO_BACK crash/warning).
 */
export function safeRegistrationBack(
  navigation: { canGoBack?: () => boolean; goBack?: () => void; navigate?: (name: string) => void },
  options?: {
    exit?: RegistrationExitFn | null;
    fallbackRoute?: string;
  }
): void {
  if (navigation.canGoBack?.()) {
    navigation.goBack?.();
    return;
  }
  if (options?.fallbackRoute && navigation.navigate) {
    navigation.navigate(options.fallbackRoute);
    return;
  }
  void options?.exit?.();
}
