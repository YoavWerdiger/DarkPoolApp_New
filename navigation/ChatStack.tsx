import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatGroupsListScreen from '../screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from '../screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from '../screens/ChatNew/ChatGroupInfoScreen';
import SavedMediaScreen from '../screens/ChatNew/SavedMediaScreen';
import PrivacySupportScreen from '../screens/ChatNew/PrivacySupportScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  const DesignTokens = useDesignTokens();
  
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
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
    </Stack.Navigator>
  );
}
