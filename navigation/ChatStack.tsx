import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// מערכת צ'אט חדשה
import ChatGroupsListScreen from '../screens/ChatNew/ChatGroupsListScreen';
import ChatGroupScreen from '../screens/ChatNew/ChatGroupScreen';
import ChatGroupInfoScreen from '../screens/ChatNew/ChatGroupInfoScreen';
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
      <Stack.Screen name="ChatGroupsList" component={ChatGroupsListScreen} />
      <Stack.Screen name="ChatGroup" component={ChatGroupScreen} />
      <Stack.Screen name="ChatGroupInfo" component={ChatGroupInfoScreen} />
    </Stack.Navigator>
  );
}
