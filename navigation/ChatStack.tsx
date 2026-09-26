import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import {
  lockAndroidChatSoftInput,
  releaseAndroidChatSoftInput,
} from '../components/chat/androidChatKeyboard';
import {
  CHAT_STACK_ANIMATION,
  chatStackScreenListeners,
  createChatStackScreenOptions,
} from './chatStackTransition';

const Stack = createNativeStackNavigator();

function ChatStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={createChatStackScreenOptions()}
      screenListeners={chatStackScreenListeners}
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
          animation: CHAT_STACK_ANIMATION,
        }}
      />
      <Stack.Screen
        name="ChatGroupInfo"
        component={ChatGroupInfoScreen}
        options={{ animation: CHAT_STACK_ANIMATION }}
      />
      <Stack.Screen
        name="ChatGroupSettings"
        component={ChatGroupSettingsScreen}
        options={{
          presentation: 'card',
          animation: CHAT_STACK_ANIMATION,
        }}
      />
      <Stack.Screen
        name="SavedMedia"
        component={SavedMediaScreen}
        options={{ animation: CHAT_STACK_ANIMATION }}
      />
      <Stack.Screen
        name="GroupMediaGallery"
        component={GroupMediaGalleryScreen}
        options={{
          presentation: 'card',
          animation: CHAT_STACK_ANIMATION,
        }}
      />
      <Stack.Screen
        name="PrivacySupport"
        component={PrivacySupportScreen}
        options={{ animation: CHAT_STACK_ANIMATION }}
      />
      <Stack.Screen
        name="ChatGroupStarredMessages"
        component={ChatGroupStarredMessagesScreen}
        options={{ animation: CHAT_STACK_ANIMATION }}
      />
    </Stack.Navigator>
  );
}

export default function ChatStack() {
  useFocusEffect(
    useCallback(() => {
      lockAndroidChatSoftInput();
      return () => {
        releaseAndroidChatSoftInput();
      };
    }, []),
  );

  return (
    <ChatProvider>
      <ChatStackNavigator />
    </ChatProvider>
  );
}
