/**
 * טאבים פנימיים של Dark Pool: פיד · חקור · חיפוש · מעקב.
 * יושבים תחת route `DarkPoolHome` ב-Stack — MainTabs לא משתנה.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkPoolBottomTabBar } from '../screens/DarkPool/components/DarkPoolBottomTabBar';
import DarkPoolHomeScreen from '../screens/DarkPool/DarkPoolHomeScreen';
import DarkPoolExploreScreen from '../screens/DarkPool/DarkPoolExploreScreen';
import DarkPoolFollowingScreen from '../screens/DarkPool/DarkPoolFollowingScreen';
import DarkPoolSearchScreen from '../screens/DarkPool/DarkPoolSearchScreen';

export type DarkPoolTabParamList = {
  DarkPoolFeed: undefined;
  DarkPoolExplore: undefined;
  DarkPoolSearch: undefined;
  DarkPoolFollowing: undefined;
};

const Tab = createBottomTabNavigator<DarkPoolTabParamList>();

export default function DarkPoolTabs() {
  return (
    <Tab.Navigator
      initialRouteName="DarkPoolExplore"
      tabBar={(props) => <DarkPoolBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // מעבר רך בין טאבים (דהייה + הזזה קלה) במקום החלפה בפריים אחד
        animation: 'shift',
        freezeOnBlur: true,
        lazy: true,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="DarkPoolFeed" component={DarkPoolHomeScreen} />
      <Tab.Screen name="DarkPoolExplore" component={DarkPoolExploreScreen} />
      <Tab.Screen name="DarkPoolSearch" component={DarkPoolSearchScreen} />
      <Tab.Screen name="DarkPoolFollowing" component={DarkPoolFollowingScreen} />
    </Tab.Navigator>
  );
}
