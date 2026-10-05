import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminScreen } from '../components/admin/AdminSurface';
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/Admin/AdminUsersScreen';
import AdminPushScreen from '../screens/Admin/AdminPushScreen';
import AdminTicketsScreen from '../screens/Admin/AdminTicketsScreen';
import AdminCardComScreen from '../screens/Admin/AdminCardComScreen';
import AdminPaymentsScreen from '../screens/Admin/AdminPaymentsScreen';
import AdminGroupsScreen from '../screens/Admin/AdminGroupsScreen';

function withAdminShell<P extends object>(ScreenComponent: React.ComponentType<P>): React.FC<P> {
  return function Wrapped(props: P) {
    return (
      <AdminScreen>
        <ScreenComponent {...props} />
      </AdminScreen>
    );
  };
}

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="AdminDashboard" component={withAdminShell(AdminDashboardScreen)} />
      <Stack.Screen name="AdminUsers" component={withAdminShell(AdminUsersScreen)} />
      <Stack.Screen name="AdminGroups" component={withAdminShell(AdminGroupsScreen)} />
      <Stack.Screen name="AdminPush" component={withAdminShell(AdminPushScreen)} />
      <Stack.Screen name="AdminTickets" component={withAdminShell(AdminTicketsScreen)} />
      <Stack.Screen name="AdminCardCom" component={withAdminShell(AdminCardComScreen)} />
      <Stack.Screen name="AdminPayments" component={withAdminShell(AdminPaymentsScreen)} />
    </Stack.Navigator>
  );
}
