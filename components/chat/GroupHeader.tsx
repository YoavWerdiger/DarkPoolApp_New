import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { useDesignTokens } from '../ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';

export default function GroupHeader({ chatId }: { chatId: string | null }) {
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
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
      style={{ 
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: DesignTokens.colors.background.secondary,
        minHeight: 80,
        paddingTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: DesignTokens.colors.border.main
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ 
            width: 64, 
            height: 64, 
            borderRadius: 32, 
            marginLeft: 12, 
            borderWidth: 2, 
            borderColor: DesignTokens.colors.primary.main,
            shadowColor: DesignTokens.colors.success.main, 
            shadowOpacity: 0.35, 
            shadowRadius: 8, 
            shadowOffset: { width: 0, height: 2 } 
          }}
        />
      ) : (
        <View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: DesignTokens.colors.primary.main, 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginLeft: 12, 
          borderWidth: 2, 
          borderColor: DesignTokens.colors.primary.main
        }}>
          <Text style={{ fontSize: 26, color: isDarkMode ? DesignTokens.colors.text.primary : '#000000', fontWeight: 'bold' }}>
            {group?.name ? group.name[0] : '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 120 }}>
        <Text style={{ fontSize: 20, color: isDarkMode ? DesignTokens.colors.text.primary : '#000000', fontWeight: 'bold', textAlign: 'right' }} numberOfLines={1}>
          {group?.name || 'קבוצה'}
        </Text>
        <Text style={{ fontSize: 12, color: isDarkMode ? DesignTokens.colors.text.tertiary : '#333333', marginTop: 4, textAlign: 'right' }} numberOfLines={1}>
           מס׳ משתתפים: {membersCount ?? 0}
         </Text>
      </View>
    </TouchableOpacity>
  );
}


