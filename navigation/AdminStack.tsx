import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatSessionBackdrop } from '../components/chat/ChatSessionBackdrop';
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/Admin/AdminUsersScreen';
import AdminPushScreen from '../screens/Admin/AdminPushScreen';
import AdminTicketsScreen from '../screens/Admin/AdminTicketsScreen';
import AdminCardComScreen from '../screens/Admin/AdminCardComScreen';
import AdminPaymentsScreen from '../screens/Admin/AdminPaymentsScreen';

function withAdminShell<P extends object>(ScreenComponent: React.ComponentType<P>): React.FC<P> {
  return function Wrapped(props: P) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A' }}>
        <ChatSessionBackdrop />
        <ScreenComponent {...props} />
      </View>
    );
  };
}

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0E0A' },
        animation: 'fade',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="AdminDashboard" component={withAdminShell(AdminDashboardScreen)} />
      <Stack.Screen name="AdminUsers" component={withAdminShell(AdminUsersScreen)} />
      <Stack.Screen name="AdminPush" component={withAdminShell(AdminPushScreen)} />
      <Stack.Screen name="AdminTickets" component={withAdminShell(AdminTicketsScreen)} />
      <Stack.Screen name="AdminCardCom" component={withAdminShell(AdminCardComScreen)} />
      <Stack.Screen name="AdminPayments" component={withAdminShell(AdminPaymentsScreen)} />
    </Stack.Navigator>
  );
}
