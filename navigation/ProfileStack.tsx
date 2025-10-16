import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import NotificationsScreen from '../screens/Profile/NotificationsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import SubscriptionScreen from '../screens/Profile/SubscriptionScreen';
import SubscriptionPlansScreen from '../screens/Profile/SubscriptionPlansScreen';
import CheckoutScreen from '../screens/Payment/CheckoutScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';

const Stack = createStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#121212' }
      }}
    >
      <Stack.Screen name="ProfileMain" component={UserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen as any} />
      <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutScreen as any} />
    </Stack.Navigator>
  );
}