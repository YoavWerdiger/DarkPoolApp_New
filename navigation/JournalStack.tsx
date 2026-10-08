import React from 'react';
import { useDesignTokens } from '../components/ui/DesignTokens';
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
  // רקע אטום בצבע הקנבס — עם רקע שקוף, בזמן המעבר המסך הקודם נראה דרך החדש
  // («רק חלק מהקומפוננטות»). סטטית נראה זהה; בתנועה נכנס מסך שלם.
  const screenCanvas = useDesignTokens().colors.background.primary;
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        contentStyle: { backgroundColor: screenCanvas },
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
