/**
 * טאבים תחתונים — גילוי | מעקב | פיד (כמו Insider Wave)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DarkPoolFeedScreen from '../screens/DarkPool/DarkPoolFeedScreen';
import DarkPoolExploreScreen from '../screens/DarkPool/DarkPoolExploreScreen';
import DarkPoolFollowingScreen from '../screens/DarkPool/DarkPoolFollowingScreen';
import { DarkPoolBottomTabBar } from '../screens/DarkPool/components/DarkPoolBottomTabBar';

export type DarkPoolTabParamList = {
  DarkPoolExplore: undefined;
  DarkPoolFollowing: undefined;
  DarkPoolFeed: undefined;
};

const Tab = createBottomTabNavigator<DarkPoolTabParamList>();

export default function DarkPoolTabs() {
  return (
    <Tab.Navigator
      initialRouteName="DarkPoolFeed"
      tabBar={(props) => <DarkPoolBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="DarkPoolFeed" component={DarkPoolFeedScreen} />
      <Tab.Screen name="DarkPoolExplore" component={DarkPoolExploreScreen} />
      <Tab.Screen name="DarkPoolFollowing" component={DarkPoolFollowingScreen} />
    </Tab.Navigator>
  );
}
