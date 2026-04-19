import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradingScreen from '../screens/Journal/TradingScreen';
import AddTradeScreen from '../screens/Journal/AddTradeScreen';

export type JournalStackParamList = {
  JournalMain: undefined;
  AddTrade: undefined;
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
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}
