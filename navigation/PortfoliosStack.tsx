import React from 'react';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PortfoliosHubScreen from '../screens/Portfolios/PortfoliosHubScreen';
import CreatePortfolioScreen from '../screens/Portfolios/CreatePortfolioScreen';
import PortfolioDetailScreen from '../screens/Portfolios/PortfolioDetailScreen';
import AddTransactionScreen from '../screens/Portfolios/AddTransactionScreen';
import ImportTransactionsScreen from '../screens/Portfolios/ImportTransactionsScreen';
import ConnectBrokerScreen from '../screens/Portfolios/ConnectBrokerScreen';
import SelectBrokerAccountScreen from '../screens/Portfolios/SelectBrokerAccountScreen';

export type PortfoliosStackParamList = {
  PortfoliosHub: { selectPortfolioId?: string } | undefined;
  CreatePortfolio: undefined;
  PortfolioDetail: { portfolioId: string };
  AddTransaction: {
    portfolioId: string;
    initialMode?: 'asset' | 'cash' | 'dividend';
    transactionId?: string;
    /** editTradeId — לעריכת trade מטבלת trades (המודל החדש) */
    editTradeId?: string;
    /** סימבול התחלתי מרשימת מעקב */
    initialSymbol?: string;
  };
  ImportTransactions: { portfolioId: string };
  ConnectBroker: undefined;
  SelectBrokerAccount: { connectionId: string };
};

const Stack = createNativeStackNavigator<PortfoliosStackParamList>();

export default function PortfoliosStack() {
  // רקע אטום בצבע הקנבס — עם רקע שקוף, בזמן המעבר המסך הקודם נראה דרך החדש
  // («רק חלק מהקומפוננטות»). סטטית נראה זהה; בתנועה נכנס מסך שלם.
  const screenCanvas = useDesignTokens().colors.background.primary;
  return (
    <Stack.Navigator
      initialRouteName="PortfoliosHub"
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        contentStyle: { backgroundColor: screenCanvas },
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
          // שיט iOS נייטיבי — סגירה בגרירה למטה
          presentation: 'modal',
          gestureEnabled: true,
          contentStyle: { backgroundColor: screenCanvas },
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
