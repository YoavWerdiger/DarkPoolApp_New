import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import NotificationsScreen from '../screens/Profile/NotificationsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import SubscriptionScreen from '../screens/Profile/SubscriptionScreen';
import SubscriptionPlansScreen from '../screens/Profile/SubscriptionPlansScreen';
import CheckoutScreen from '../screens/Payment/CheckoutScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';
import { withVideoBackground } from '../components/VideoBackground';

const ProfileMainScreen = withVideoBackground(UserProfileScreen);
const EditProfileWithVideo = withVideoBackground(EditProfileScreen);
const NotificationsWithVideo = withVideoBackground(NotificationsScreen);
const SettingsWithVideo = withVideoBackground(SettingsScreen);
const SubscriptionWithVideo = withVideoBackground(SubscriptionScreen);
const SubscriptionPlansWithVideo = withVideoBackground(SubscriptionPlansScreen);
const CheckoutWithVideo = withVideoBackground(CheckoutScreen as any);
const CreditCardCheckoutWithVideo = withVideoBackground(CreditCardCheckoutScreen as any);

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0E0A' },
        animation: 'fade',
        gestureEnabled: true,
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileMainScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileWithVideo} />
      <Stack.Screen name="Notifications" component={NotificationsWithVideo} />
      <Stack.Screen name="Settings" component={SettingsWithVideo} />
      <Stack.Screen name="Subscription" component={SubscriptionWithVideo} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansWithVideo} />
      <Stack.Screen name="Checkout" component={CheckoutWithVideo} />
      <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutWithVideo} />
    </Stack.Navigator>
  );
}