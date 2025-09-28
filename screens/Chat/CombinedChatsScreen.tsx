import React from 'react';
import { ScrollView, View } from 'react-native';
import ChannelsList from '../../components/chat/ChannelsList';
import ChatsListScreen from './ChatsListScreen';

export default function CombinedChatsScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: 'black' }}>
      <ChannelsList />
      <View style={{ height: 32 }} />
      <ChatsListScreen />
    </ScrollView>
  );
} 