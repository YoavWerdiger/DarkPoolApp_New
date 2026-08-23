/**
 * Dark Pool — Stack פשוט: בית → אנשים / פרופיל / טיקר
 * בלי טאבים תחתונים.
 */

import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { darkPoolRtlRoot } from '../screens/DarkPool/darkPoolLayout';
import DarkPoolHomeScreen from '../screens/DarkPool/DarkPoolHomeScreen';
import DarkPoolExploreScreen from '../screens/DarkPool/DarkPoolExploreScreen';
import DarkPoolTickerScreen from '../screens/DarkPool/DarkPoolTickerScreen';
import DarkPoolInvestorProfileScreen from '../screens/DarkPool/DarkPoolInvestorProfileScreen';

export type DarkPoolStackParamList = {
  DarkPoolHome: undefined;
  DarkPoolPeople: undefined;
  DarkPoolTicker: { ticker: string; tab?: 'insider' | 'darkpool' };
  DarkPoolInvestor: {
    id: string;
    kind: 'politician' | 'insider' | 'fund_manager';
    ticker?: string;
    nameHint?: string;
    imageHint?: string | null;
  };
};

const Stack = createNativeStackNavigator<DarkPoolStackParamList>();

export default function DarkPoolStack() {
  return (
    <View style={darkPoolRtlRoot}>
      <Stack.Navigator
        initialRouteName="DarkPoolHome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0E0A', direction: 'rtl' },
        }}
      >
        <Stack.Screen name="DarkPoolHome" component={DarkPoolHomeScreen} />
        <Stack.Screen
          name="DarkPoolPeople"
          component={DarkPoolExploreScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DarkPoolTicker"
          component={DarkPoolTickerScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DarkPoolInvestor"
          component={DarkPoolInvestorProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </View>
  );
}
