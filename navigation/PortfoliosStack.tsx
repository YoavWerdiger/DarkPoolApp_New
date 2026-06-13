import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PortfoliosHubScreen from '../screens/Portfolios/PortfoliosHubScreen';
import CreatePortfolioScreen from '../screens/Portfolios/CreatePortfolioScreen';
import PortfolioDetailScreen from '../screens/Portfolios/PortfolioDetailScreen';
import AddTransactionScreen from '../screens/Portfolios/AddTransactionScreen';
import ImportTransactionsScreen from '../screens/Portfolios/ImportTransactionsScreen';
import ConnectBrokerScreen from '../screens/Portfolios/ConnectBrokerScreen';
import SelectBrokerAccountScreen from '../screens/Portfolios/SelectBrokerAccountScreen';

export type PortfoliosStackParamList = {
  PortfoliosHub: undefined;
  CreatePortfolio: undefined;
  PortfolioDetail: { portfolioId: string };
  AddTransaction: {
    portfolioId: string;
    initialMode?: 'asset' | 'cash' | 'dividend';
    transactionId?: string;
  };
  ImportTransactions: { portfolioId: string };
  ConnectBroker: undefined;
  SelectBrokerAccount: { connectionId: string };
};

const Stack = createNativeStackNavigator<PortfoliosStackParamList>();

export default function PortfoliosStack() {
  return (
    <Stack.Navigator
      initialRouteName="PortfoliosHub"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0E0A' },
      }}
    >
      <Stack.Screen name="PortfoliosHub" component={PortfoliosHubScreen} />
      <Stack.Screen
        name="CreatePortfolio"
        component={CreatePortfolioScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PortfolioDetail"
        component={PortfolioDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="ImportTransactions"
        component={ImportTransactionsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ConnectBroker"
        component={ConnectBrokerScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SelectBrokerAccount"
        component={SelectBrokerAccountScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
