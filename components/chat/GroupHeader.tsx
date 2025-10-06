import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';

export default function GroupHeader({ chatId }: { chatId: string | null }) {
  const navigation = useNavigation<any>();
  const [group, setGroup] = useState<any>(null);
  const [membersCount, setMembersCount] = useState<number>(0);

  useEffect(() => {
    if (!chatId) return;
    const load = async () => {
      const { data } = await supabase
        .from('channels')
        .select('id, name, image_url, icon_name')
        .eq('id', chatId)
        .single();
      setGroup(data);
      const { count } = await ChatService.getChannelMembersCount(chatId);
      if (typeof count === 'number') setMembersCount(count);
    };
    load();
  }, [chatId]);

  const imageUrl = group?.image_url || null;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('GroupInfo', { chatId })}
      activeOpacity={0.85}
      className="flex-row-reverse items-center px-4 py-3 bg-[#181818] min-h-[80px]"
      style={{ 
        paddingTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#666666'
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="w-16 h-16 rounded-full ml-3 border-2 border-primary"
          style={{ shadowColor: '#00E654', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
        />
      ) : (
        <View className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-[#00ff88] items-center justify-center ml-3 border-2 border-primary">
          <Text className="text-3xl text-white font-bold" style={{ fontSize: 26 }}>
            {group?.name ? group.name[0] : '?'}
          </Text>
        </View>
      )}
      <View className="flex-1 justify-center min-h-[120px]">
        <Text className="text-xl text-white font-bold" numberOfLines={1} style={{ textAlign: 'right', fontSize: 20 }}>
          {group?.name || 'קבוצה'}
        </Text>
                 <Text className="text-xs text-gray-400 mt-1" numberOfLines={1} style={{ textAlign: 'right' }}>
           מס׳ משתתפים: {membersCount ?? 0}
         </Text>
      </View>
    </TouchableOpacity>
  );
}


