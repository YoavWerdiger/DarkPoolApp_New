import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatGroupsListScreen from '../screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from '../screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from '../screens/ChatNew/ChatGroupInfoScreen';
import SavedMediaScreen from '../screens/ChatNew/SavedMediaScreen';
import PrivacySupportScreen from '../screens/ChatNew/PrivacySupportScreen';
import ChatGroupPinnedMessagesScreen from '../screens/ChatNew/ChatGroupPinnedMessagesScreen';
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
        name="SavedMedia" 
        component={SavedMediaScreen}
      />
      <Stack.Screen 
        name="PrivacySupport" 
        component={PrivacySupportScreen}
      />
      <Stack.Screen 
        name="ChatGroupPinnedMessages" 
        component={ChatGroupPinnedMessagesScreen}
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
