/**
 * Dark Pool — Stack: מעטפת טאבים (בית) + push לפרופיל / טיקר / פרטי עסקה.
 */

import React from 'react';
import { Platform, View } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { darkPoolRtlRoot } from '../screens/DarkPool/darkPoolLayout';
import DarkPoolTabs, { type DarkPoolTabParamList } from './DarkPoolTabs';
import DarkPoolTickerScreen from '../screens/DarkPool/DarkPoolTickerScreen';
import DarkPoolInvestorProfileScreen from '../screens/DarkPool/DarkPoolInvestorProfileScreen';
import DarkPoolTradeDetailScreen from '../screens/DarkPool/DarkPoolTradeDetailScreen';
import type { DarkPoolTradeDetailParams } from '../screens/DarkPool/utils/tradeDetailParams';

export type { DarkPoolTradeDetailParams };

export type DarkPoolStackParamList = {
  DarkPoolHome: NavigatorScreenParams<DarkPoolTabParamList> | undefined;
  DarkPoolTicker: { ticker: string; tab?: 'holders' | 'feed' | 'insider' | 'darkpool' };
  DarkPoolInvestor: {
    id: string;
    kind: 'politician' | 'insider' | 'fund_manager';
    ticker?: string;
    nameHint?: string;
    imageHint?: string | null;
  };
  /**
   * `kind: 'congress'` — STOCK Act (טווח, שני תאריכים, PriceChange/ExcessReturn).
   * `kind: 'insider'` — Form 4 (כמות, מחיר, קוד). אין 13F כאן.
   */
  DarkPoolTradeDetail: DarkPoolTradeDetailParams;
};

const Stack = createNativeStackNavigator<DarkPoolStackParamList>();

export default function DarkPoolStack() {
  return (
    <View style={darkPoolRtlRoot}>
      <Stack.Navigator
        initialRouteName="DarkPoolHome"
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          animationDuration: Platform.OS === 'android' ? 180 : 220,
          contentStyle: { backgroundColor: 'transparent', direction: 'rtl' },
        }}
      >
        <Stack.Screen name="DarkPoolHome" component={DarkPoolTabs} />
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
        <Stack.Screen
          name="DarkPoolTradeDetail"
          component={DarkPoolTradeDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </View>
  );
}
