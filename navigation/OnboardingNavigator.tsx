import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RegistrationDetailsScreen from '../screens/Auth/RegistrationDetailsScreen';
import RegistrationProfileImageScreen from '../screens/Auth/RegistrationProfileImageScreen';
import RegistrationTrackScreen from '../screens/Auth/RegistrationTrackScreen';
import RegistrationPaymentScreen from '../screens/Auth/RegistrationPaymentScreen';
import RegistrationSummaryScreen from '../screens/Auth/RegistrationSummaryScreen';
import RegistrationIntroScreen from '../screens/Auth/RegistrationIntroScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';

const Stack = createNativeStackNavigator();

const OnboardingNavigator = () => (
  <Stack.Navigator 
    screenOptions={{ 
      headerShown: false,
      animation: 'slide_from_left',
      gestureDirection: 'horizontal',
      gestureEnabled: true,
      animationDuration: 400
    }} 
    initialRouteName="RegistrationDetails"
  >
    <Stack.Screen name="RegistrationDetails" component={RegistrationDetailsScreen} />
    <Stack.Screen name="RegistrationProfileImage" component={RegistrationProfileImageScreen} />
    <Stack.Screen name="RegistrationIntro" component={RegistrationIntroScreen} />
    <Stack.Screen name="RegistrationPayment" component={RegistrationPaymentScreen} />
    <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutScreen} />
    <Stack.Screen name="RegistrationSummary" component={RegistrationSummaryScreen} />
  </Stack.Navigator>
);

export default OnboardingNavigator; 