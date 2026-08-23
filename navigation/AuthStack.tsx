import { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import LoginScreen from '../screens/Auth/LoginScreen';
import OnboardingNavigator from './OnboardingNavigator';
import TestRegistrationScreen from '../screens/Auth/TestRegistrationScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import ForgotPasswordOtpScreen from '../screens/Auth/ForgotPasswordOtpScreen';
import ForgotPasswordNewScreen from '../screens/Auth/ForgotPasswordNewScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const RECOVERY_ROUTES = new Set([
  'ForgotPassword',
  'ForgotPasswordOtp',
  'ForgotPasswordNew',
]);

/**
 * Deep-link / cold-start recovery: מנווט למסך סיסמה חדשה בלי לרמונט את כל ה-stack
 * (רמונט עם key גרם לאיבוד מסך ה-OTP ולכניסה כפולה של קוד).
 * חייב להיות בתוך Screen של ה-Auth stack (useNavigation).
 */
function PasswordRecoveryRedirect() {
  const { passwordRecoveryMode } = useAuth();
  const navigation = useNavigation<any>();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!passwordRecoveryMode) {
      didRedirect.current = false;
      return;
    }
    if (didRedirect.current) return;

    const state = navigation.getState?.();
    const current = state?.routes?.[state.index ?? 0]?.name;
    if (current && RECOVERY_ROUTES.has(current)) {
      didRedirect.current = true;
      return;
    }

    didRedirect.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'ForgotPasswordNew' }],
    });
  }, [passwordRecoveryMode, navigation]);

  return null;
}

function LoginWithRecoveryRedirect(props: any) {
  return (
    <>
      <PasswordRecoveryRedirect />
      <LoginScreen {...props} />
    </>
  );
}

export default function AuthStack() {
  const DesignTokens = useDesignTokens();
  const { passwordRecoveryMode } = useAuth();

  return (
    <Stack.Navigator
      // בלי key דינמי — שינוי key רמונט את ה-OTP באמצע אימות
      initialRouteName={passwordRecoveryMode ? 'ForgotPasswordNew' : 'Login'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
        gestureDirection: 'horizontal',
        gestureEnabled: true,
        animationDuration: 250,
        contentStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginWithRecoveryRedirect} />
      <Stack.Screen name="Register" component={OnboardingNavigator} />
      <Stack.Screen name="TestRegistration" component={TestRegistrationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
      <Stack.Screen name="ForgotPasswordNew" component={ForgotPasswordNewScreen} />
    </Stack.Navigator>
  );
}
