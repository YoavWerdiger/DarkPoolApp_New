import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Image, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ChatService, ChatListItem } from '../../services/chatService';

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<ChatListItem[]>([]);

  useEffect(() => {
    if (user?.id) {
      ChatService.getChatList(user.id).then(setChats);
    }
  }, [user]);

  useEffect(() => {
    if (!search) setFiltered(chats);
    else setFiltered(
      chats.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_message?.content?.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, chats]);

  const renderItem = ({ item }: { item: ChatListItem }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-800 bg-black"
      onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, isGroup: item.is_group })}
    >
      <Image
        source={{ uri: item.avatar_url || 'https://ui-avatars.com/api/?name=' + item.name }}
        className="w-12 h-12 rounded-full mr-3"
      />
      <View className="flex-1">
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-bold text-base">{item.name}</Text>
          <Text className="text-xs text-gray-400">{formatTime(item.last_message?.timestamp)}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-gray-400 text-sm" numberOfLines={1}>
            {item.last_message?.content || 'התחל שיחה חדשה'}
          </Text>
          {item.unread_count > 0 && (
            <View className="bg-green-500 rounded-full px-2 py-0.5 ml-2">
              <Text className="text-xs text-black">{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="px-4 py-2 bg-[#181818]">
        <TextInput
          className="bg-gray-900 text-white rounded-full px-4 py-2"
          placeholder="חפש צ׳אט או הודעה..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text className="text-center text-gray-500 mt-8">אין שיחות פעילות</Text>}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}

function formatTime(ts: string | undefined) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} 