import React, { useEffect, useMemo, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RegistrationNameScreen from '../screens/Auth/RegistrationNameScreen';
import RegistrationPhoneScreen from '../screens/Auth/RegistrationPhoneScreen';
import RegistrationPhoneVerificationScreen from '../screens/Auth/RegistrationPhoneVerificationScreen';
import RegistrationEmailScreen from '../screens/Auth/RegistrationEmailScreen';
import RegistrationEmailVerificationScreen from '../screens/Auth/RegistrationEmailVerificationScreen';
import RegistrationPasswordScreen from '../screens/Auth/RegistrationPasswordScreen';
import RegistrationProfileImageScreen from '../screens/Auth/RegistrationProfileImageScreen';
import RegistrationDetailsScreen from '../screens/Auth/RegistrationDetailsScreen';
import RegistrationIntroScreen from '../screens/Auth/RegistrationIntroScreen';
import {
  RegistrationAgeScreen,
  RegistrationExperienceScreen,
  RegistrationTradingFocusScreen,
  RegistrationPlatformScreen,
  RegistrationPortfolioScreen,
} from '../screens/Auth/registrationIntroSteps';
import RegistrationTrackScreen from '../screens/Auth/RegistrationTrackScreen';
import RegistrationSummaryScreen from '../screens/Auth/RegistrationSummaryScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { useRegistration } from '../context/RegistrationContext';
import { useAuth } from '../context/AuthContext';
import { isRegistrationComplete } from '../services/authService';
import { RegistrationExitProvider } from '../hooks/useExitRegistration';

const Stack = createNativeStackNavigator();

const OnboardingNavigator = () => {
  const DesignTokens = useDesignTokens();
  const { data, setData } = useRegistration();
  const { user } = useAuth();
  const hydratedRef = useRef(false);

  // כש-App מנווט ל-Onboarding לפני setGoogleUserData (מרוץ auth) — משחזרים מהפרופיל
  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      return;
    }
    if (hydratedRef.current) return;
    if (isRegistrationComplete(user)) return;

    const hasLocalIdentity =
      data.isGoogleSignUp ||
      !!data.googleUserId ||
      !!data.pendingAuthUserId ||
      (!!data.email && !!data.fullName);
    if (hasLocalIdentity) {
      hydratedRef.current = true;
      return;
    }

    hydratedRef.current = true;
    // שימוש ב-displayName alias (כולל כבר display_name ו-full_name fallback)
    const displayName = user.displayName || '';
    const looksLikeOAuth =
      !data.password &&
      (!!user.profile_picture || !!displayName);

    setData((prev) => ({
      ...prev,
      fullName: prev.fullName || displayName,
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
      profileImage: prev.profileImage || user.profile_picture || null,
      trackId: prev.trackId || user.track_id || '',
      accountType: prev.accountType || user.account_type || 'free',
      pendingAuthUserId: prev.pendingAuthUserId || user.id,
      isGoogleSignUp: prev.isGoogleSignUp || looksLikeOAuth,
      googleUserId: prev.googleUserId || (looksLikeOAuth ? user.id : null),
    }));
  }, [
    user,
    data.isGoogleSignUp,
    data.googleUserId,
    data.pendingAuthUserId,
    data.email,
    data.fullName,
    data.password,
    setData,
  ]);

  // משתמש מחובר באמצע רישום — ממשיכים מהשלב הנכון (לא תמיד Age).
  // אחרי אימות אימייל בלבד: סיסמה. אחרי סיסמה: תמונה→שאלון (לא Age ישירות —
  // אחרת remount אחרי OTP משאיר Age בלי היסטוריה ו-goBack קורס).
  // Google: כבר יש תמונה — מתחילים בשאלון מגיל.
  const initialRoute = useMemo(() => {
    if (data.isGoogleSignUp || data.googleUserId) {
      return 'RegistrationAge';
    }
    if (data.emailVerified && !data.password) {
      return 'RegistrationPassword';
    }
    if (
      (data.emailVerified && !!data.password) ||
      (!!data.pendingAuthUserId && !!data.password) ||
      (!!user && !isRegistrationComplete(user) && !!data.password)
    ) {
      return 'RegistrationProfileImage';
    }
    return 'RegistrationName';
  }, [
    data.isGoogleSignUp,
    data.googleUserId,
    data.pendingAuthUserId,
    data.emailVerified,
    data.password,
    user,
  ]);

  return (
    <RegistrationExitProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_left',
          gestureDirection: 'horizontal',
          gestureEnabled: true,
          animationDuration: 400,
          contentStyle: {
            backgroundColor: DesignTokens.colors.background.primary,
          },
        }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="RegistrationName" component={RegistrationNameScreen} />
        <Stack.Screen name="RegistrationPhone" component={RegistrationPhoneScreen} />
        <Stack.Screen name="RegistrationPhoneVerification" component={RegistrationPhoneVerificationScreen} />
        <Stack.Screen name="RegistrationEmail" component={RegistrationEmailScreen} />
        <Stack.Screen name="RegistrationEmailVerification" component={RegistrationEmailVerificationScreen} />
        <Stack.Screen name="RegistrationPassword" component={RegistrationPasswordScreen} />
        <Stack.Screen name="RegistrationProfileImage" component={RegistrationProfileImageScreen} />
        <Stack.Screen name="RegistrationAge" component={RegistrationAgeScreen} />
        <Stack.Screen name="RegistrationExperience" component={RegistrationExperienceScreen} />
        <Stack.Screen name="RegistrationTradingFocus" component={RegistrationTradingFocusScreen} />
        <Stack.Screen name="RegistrationPlatform" component={RegistrationPlatformScreen} />
        <Stack.Screen name="RegistrationPortfolio" component={RegistrationPortfolioScreen} />
        <Stack.Screen name="RegistrationTrack" component={RegistrationTrackScreen} />
        <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutScreen as any} />
        <Stack.Screen name="RegistrationSummary" component={RegistrationSummaryScreen} />
        {/* Aliases — redirect stubs for any leftover navigate() calls */}
        <Stack.Screen name="RegistrationDetails" component={RegistrationDetailsScreen} />
        <Stack.Screen name="RegistrationIntro" component={RegistrationIntroScreen} />
      </Stack.Navigator>
    </RegistrationExitProvider>
  );
};

export default OnboardingNavigator;
