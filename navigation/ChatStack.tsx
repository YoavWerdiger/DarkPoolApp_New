import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatGroupsListScreen from '../screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from '../screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from '../screens/ChatNew/ChatGroupInfoScreen';
import ChatGroupSettingsScreen from '../screens/ChatNew/ChatGroupSettingsScreen';
import SavedMediaScreen from '../screens/ChatNew/SavedMediaScreen';
import GroupMediaGalleryScreen from '../screens/ChatNew/GroupMediaGalleryScreen';
import PrivacySupportScreen from '../screens/ChatNew/PrivacySupportScreen';
import ChatGroupStarredMessagesScreen from '../screens/ChatNew/ChatGroupStarredMessagesScreen';
import { ChatProvider } from '../context/ChatContext';

const Stack = createNativeStackNavigator();

function ChatStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: 'transparent',
        },
        animation: 'fade',
        gestureEnabled: true,
        animationDuration: 200,
      }}
    >
      <Stack.Screen 
        name="ChatGroupsList" 
        component={ChatGroupsListScreen}
      />
      <Stack.Screen 
        name="ChatGroup" 
        component={ChatGroupScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="ChatGroupInfo" 
        component={ChatGroupInfoScreen}
      />
      <Stack.Screen
        name="ChatGroupSettings"
        component={ChatGroupSettingsScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="SavedMedia" 
        component={SavedMediaScreen}
      />
      <Stack.Screen
        name="GroupMediaGallery"
        component={GroupMediaGalleryScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="PrivacySupport" 
        component={PrivacySupportScreen}
      />
      <Stack.Screen
        name="ChatGroupStarredMessages"
        component={ChatGroupStarredMessagesScreen}
      />
    </Stack.Navigator>
  );
}

export default function ChatStack() {
  return (
    <ChatProvider>
      <ChatStackNavigator />
    </ChatProvider>
  );
}
