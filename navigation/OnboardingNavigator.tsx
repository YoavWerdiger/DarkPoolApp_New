import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import RegistrationDetailsScreen from '../screens/Auth/RegistrationDetailsScreen';
import RegistrationProfileImageScreen from '../screens/Auth/RegistrationProfileImageScreen';
import RegistrationTrackScreen from '../screens/Auth/RegistrationTrackScreen';
import RegistrationPaymentScreen from '../screens/Auth/RegistrationPaymentScreen';
import RegistrationSummaryScreen from '../screens/Auth/RegistrationSummaryScreen';
import RegistrationIntroScreen from '../screens/Auth/RegistrationIntroScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';

const Stack = createNativeStackNavigator();

type OnboardingParams = {
  Onboarding: {
    skipToIntro?: boolean;
  };
};

interface OnboardingNavigatorProps {
  route?: RouteProp<OnboardingParams, 'Onboarding'>;
}

const OnboardingNavigator = ({ route }: OnboardingNavigatorProps) => {
  const DesignTokens = useDesignTokens();
  
  // בדיקה אם צריך לדלג על שלבי פרטים אישיים (להרשמה עם Google)
  const skipToIntro = route?.params?.skipToIntro ?? false;
  const initialRoute = skipToIntro ? 'RegistrationIntro' : 'RegistrationDetails';
  
  return (
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
      <Stack.Screen name="RegistrationDetails" component={RegistrationDetailsScreen} />
      <Stack.Screen name="RegistrationProfileImage" component={RegistrationProfileImageScreen} />
      <Stack.Screen name="RegistrationIntro" component={RegistrationIntroScreen} />
      <Stack.Screen name="RegistrationTrack" component={RegistrationTrackScreen} />
      {/* RegistrationPayment removed - going directly to Cardcom */}
      <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutScreen} />
      <Stack.Screen name="RegistrationSummary" component={RegistrationSummaryScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
