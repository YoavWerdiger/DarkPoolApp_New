import React, { useCallback } from 'react';
import { Platform } from 'react-native';
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

const Stack = createNativeStackNavigator();

/** Android native-stack slide יקר יותר — fade קצר כדי שה-cache ייצבע בלי 180–300ms המתנה. iOS נשאר slide. */
const THREAD_TRANSITION =
  Platform.OS === 'android'
    ? { animation: 'fade' as const, animationDuration: 90 }
    : { animation: 'slide_from_right' as const, animationDuration: 180 };

function ChatStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: '#111111',
        },
        animation: 'fade',
        gestureEnabled: true,
        animationDuration: Platform.OS === 'android' ? 90 : 200,
      }}
    >
      <Stack.Screen 
        name="ChatGroupsList" 
        component={ChatGroupsListScreen}
        options={{ freezeOnBlur: Platform.OS === 'ios' }}
      />
      <Stack.Screen 
        name="ChatGroup" 
        component={ChatGroupScreen}
        options={{
          presentation: 'card',
          ...THREAD_TRANSITION,
          freezeOnBlur: false,
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
