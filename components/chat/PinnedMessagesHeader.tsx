import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Star, RefreshCw, XCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { DesignTokens } from '../ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';

interface PinnedMessage {
  id: string;
  message_id: string;
  message_content: string;
  message_type: string;
  message_created_at: string;
  pinned_by: string;
  pinned_by_name: string;
  pinned_at: string;
}

interface PinnedMessagesHeaderProps {
  channelId: string;
  onMessagePress?: (messageId: string) => void;
}

export default function PinnedMessagesHeader({ channelId, onMessagePress }: PinnedMessagesHeaderProps) {
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (channelId) {
      loadPinnedMessages();
    }
  }, [channelId]);

  // Listen for refresh requests from parent component
  useEffect(() => {
    if (channelId) {
      loadPinnedMessages();
    }
  }, [channelId]);

  const loadPinnedMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_pinned_messages', { channel_uuid: channelId });
      
      if (error) {
        console.error('❌ Error loading pinned messages:', error);
        return;
      }
      
      setPinnedMessages(data || []);
    } catch (error) {
      console.error('❌ Exception loading pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', channelId)
        .eq('message_id', messageId);
      
      if (error) {
        console.error('❌ Error unpinning message:', error);
        Alert.alert('שגיאה', 'לא ניתן להסיר את ההצמדה');
        return;
      }
      
      // Reload pinned messages
      await loadPinnedMessages();
      Alert.alert('הצלחה', 'ההודעה הוסרה מההצמדה');
      
      // Notify parent component about the change
      onMessagePress?.('refresh_pinned');
    } catch (error) {
      console.error('❌ Exception unpinning message:', error);
      Alert.alert('שגיאה', 'שגיאה בהסרת ההצמדה');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'עכשיו';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `לפני ${minutes} דקות`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `לפני ${hours} שעות`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `לפני ${days} ימים`;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'videocam';
      case 'audio':
      case 'voice':
        return 'mic';
      case 'file':
      case 'document':
        return 'document';
      case 'poll':
        return 'list';
      default:
        return 'chatbubble';
    }
  };

  if (pinnedMessages.length === 0) {
    return null;
  }

  const displayMessages = isExpanded ? pinnedMessages : pinnedMessages.slice(0, 2);

  return (
    <View className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Star size={20} color="#FFD700" strokeWidth={2} />
          <Text className="text-white font-bold text-base mr-2">
            הודעות מוצמדות ({pinnedMessages.length})
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            className="mr-3"
          >
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </Pressable>
          
          <Pressable onPress={loadPinnedMessages}>
            <RefreshCw size={20} color="#666" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Pinned Messages */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {displayMessages.map((pinnedMsg) => (
          <View 
            key={pinnedMsg.id}
            className="rounded-xl p-3 mr-3 min-w-[200px] max-w-[250px]"
            style={{ 
              backgroundColor: DesignTokens.colors.elevated,
              ...DesignTokens.shadows.sm
            }}
          >
            {/* Message Header */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Ionicons 
                  name={getMessageIcon(pinnedMsg.message_type) as any} 
                  size={16} 
                  color={DesignTokens.colors.warning} 
                />
                <Text 
                  className="text-xs font-semibold mr-2"
                  style={{ 
                    color: DesignTokens.colors.primary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    fontWeight: DesignTokens.typography.fontWeight.semibold
                  }}
                >
                  {pinnedMsg.pinned_by_name}
                </Text>
              </View>
              
              <Pressable
                onPress={() => handleUnpinMessage(pinnedMsg.message_id)}
                className="p-1"
              >
                <XCircle size={16} color={DesignTokens.colors.textMuted} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Message Content */}
            <Pressable
              onPress={() => onMessagePress?.(pinnedMsg.message_id)}
              className="mb-2"
            >
              <Text 
                className="text-sm" 
                numberOfLines={2}
                style={{ 
                  lineHeight: 18,
                  color: DesignTokens.colors.textPrimary,
                  fontSize: DesignTokens.typography.fontSize.sm
                }}
              >
                {pinnedMsg.message_content}
              </Text>
            </Pressable>

            {/* Message Footer */}
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-400 text-xs">
                {formatTimeAgo(pinnedMsg.pinned_at)}
              </Text>
              
              <View className="flex-row items-center">
                <Star size={12} color="#FFD700" strokeWidth={2} />
                <Text className="text-gray-400 text-xs mr-1">
                  מוצמד
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Show More/Less Button */}
      {pinnedMessages.length > 2 && (
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          className="mt-3 items-center"
        >
          <Text className="text-primary text-sm font-semibold">
            {isExpanded ? 'הצג פחות' : `הצג עוד ${pinnedMessages.length - 2} הודעות`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
