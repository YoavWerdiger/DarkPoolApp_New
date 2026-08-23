import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import NotificationsScreen from '../screens/Profile/NotificationsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import SubscriptionPlansScreen from '../screens/Profile/SubscriptionPlansScreen';
import ChangePasswordScreen from '../screens/Profile/ChangePasswordScreen';
import BillingScreen from '../screens/Profile/BillingScreen';
import ContactSupportScreen from '../screens/Profile/ContactSupportScreen';
import LegalWebViewScreen from '../screens/Profile/LegalWebViewScreen';
import InvoiceDocumentPreviewScreen from '../screens/Profile/InvoiceDocumentPreviewScreen';
import DeleteAccountScreen from '../screens/Profile/DeleteAccountScreen';
import CreditCardCheckoutScreen from '../screens/Payment/CreditCardCheckoutScreen';
import SubscriptionWelcomeScreen from '../screens/Profile/SubscriptionWelcomeScreen';
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
const ChangePasswordWithShell = withProfileChatShell(ChangePasswordScreen);
const BillingWithShell = withProfileChatShell(BillingScreen);
const ContactSupportWithShell = withProfileChatShell(ContactSupportScreen);
const LegalWebViewWithShell = withProfileChatShell(LegalWebViewScreen);
const InvoiceDocumentPreviewWithShell = withProfileChatShell(InvoiceDocumentPreviewScreen);
const DeleteAccountWithShell = withProfileChatShell(DeleteAccountScreen);
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
      <Stack.Screen name="ChangePassword" component={ChangePasswordWithShell} />
      <Stack.Screen name="Billing" component={BillingWithShell} />
      <Stack.Screen name="ContactSupport" component={ContactSupportWithShell} />
      <Stack.Screen name="LegalWebView" component={LegalWebViewWithShell} />
      <Stack.Screen name="InvoiceDocumentPreview" component={InvoiceDocumentPreviewWithShell} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountWithShell} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansWithShell} />
      <Stack.Screen name="CreditCardCheckout" component={CreditCardCheckoutWithShell} />
      {/* בלי ChatSessionBackdrop — OnboardingLayout מספק רקע משלו (כמו "הכל מוכן!") */}
      <Stack.Screen
        name="SubscriptionWelcome"
        component={SubscriptionWelcomeScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
