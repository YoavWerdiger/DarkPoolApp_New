  import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatsListScreen from '../screens/Chat/ChatsListScreen';
import ChatRoomScreen from '../screens/Chat/ChatRoomScreen';
import GroupInfoScreen from '../screens/Chat/GroupInfoScreen';
import MediaGalleryScreen from '../screens/Chat/MediaGalleryScreen';
import ChannelsScreen from '../screens/Chat/ChannelsScreen';
import { ChatProvider } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

function ChatRoomScreenWithProvider({ route }: any) {
  const { user } = useAuth();
  const { chatId } = route.params;
  
  console.log('🔧 ChatStack: ChatRoomScreenWithProvider rendered with:', { user: user?.id, chatId });
  
  if (!user) {
    console.log('❌ ChatStack: No user found');
    return null;
  }
  
  if (!chatId) {
    console.log('⚠️ ChatStack: No chatId provided');
  }
  
  return (
    <ChatProvider userId={user.id} initialChatId={chatId}>
      <ChatRoomScreen />
    </ChatProvider>
  );
}

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatsList" component={ChatsListScreen} />
      <Stack.Screen name="Channels" component={ChannelsScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreenWithProvider} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} />
    </Stack.Navigator>
  );
}