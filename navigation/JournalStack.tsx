import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradingScreen from '../screens/Journal/TradingScreen';
import AddTradeScreen from '../screens/Journal/AddTradeScreen';
import TradeDetailScreen from '../screens/Journal/TradeDetailScreen';

export type JournalStackParamList = {
  JournalMain: undefined;
  AddTrade:
    | {
        initialSymbol?: string;
        initialEntryPrice?: number;
        initialNotes?: string;
      }
    | undefined;
  TradeDetail: { tradeId: string };
};

const Stack = createNativeStackNavigator<JournalStackParamList>();

export default function JournalStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0E0A' },
      }}
    >
      <Stack.Screen name="JournalMain" component={TradingScreen} />
      <Stack.Screen
        name="AddTrade"
        component={AddTradeScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="TradeDetail"
        component={TradeDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
