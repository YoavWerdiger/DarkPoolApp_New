import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import NotificationsScreen from '../screens/Profile/NotificationsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import SubscriptionPlansScreen from '../screens/Profile/SubscriptionPlansScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';
import { ChatSessionBackdrop } from '../components/chat/ChatSessionBackdrop';

/** אותו רקע כמו מערכת הצ'אט — גרדיאנט + שור ודוב */
function withProfileChatShell<P extends object>(ScreenComponent: React.ComponentType<P>): React.FC<P> {
  return function WrappedScreen(props: P) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A' }}>
        <ChatSessionBackdrop />
        <ScreenComponent {...props} />
      </View>
    );
  };
}

const ProfileMainScreen = withProfileChatShell(UserProfileScreen);
const EditProfileWithShell = withProfileChatShell(EditProfileScreen);
const NotificationsWithShell = withProfileChatShell(NotificationsScreen);
const SettingsWithShell = withProfileChatShell(SettingsScreen);
const SubscriptionPlansWithShell = withProfileChatShell(SubscriptionPlansScreen);
const CreditCardCheckoutWithShell = withProfileChatShell(CreditCardCheckoutScreen as any);

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
      <Stack.Screen name="EditProfile" component={EditProfileWithShell} />
      <Stack.Screen name="Notifications" component={NotificationsWithShell} />
      <Stack.Screen name="Settings" component={SettingsWithShell} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansWithShell} />
      <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutWithShell} />
    </Stack.Navigator>
  );
}