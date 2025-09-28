import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User, X, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

interface SeenByUser {
  id: string;
  full_name: string;
  profile_picture: string | null;
  read_at: string;
}

interface SeenBySheetProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  messageTimestamp: string;
}

const SeenBySheet: React.FC<SeenBySheetProps> = memo(({
  visible,
  onClose,
  messageId,
  messageTimestamp,
}) => {
  const [users, setUsers] = useState<SeenByUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🔍 SeenBySheet: useEffect triggered:', {
      visible,
      messageId
    });
    
    if (visible) {
      console.log('🎯 SeenBySheet: Modal is now visible, processing...');
      if (messageId) {
        console.log('📊 SeenBySheet: Found messageId, loading viewers...');
        loadUsers();
      } else {
        console.log('⚠️ SeenBySheet: Visible but no messageId - showing empty state');
        setUsers([]); // וודא שusers ריק
        setLoading(false); // וודא שלא מציג loading
      }
    } else {
      console.log('🚫 SeenBySheet: Modal is now hidden');
    }
  }, [visible, messageId]);

    const loadUsers = async () => {
    if (!messageId) return;
    
    setLoading(true);
    try {
      console.log('🎯 SeenBySheet: Loading message viewers using new function...');
      
      // Use the new getMessageViewers function
      const { data: viewersData, error: viewersError } = await supabase
        .rpc('get_message_viewers', { message_uuid: messageId });
      
      console.log('🔍 SeenBySheet: Viewers data:', viewersData);
      console.log('🔍 SeenBySheet: Viewers error:', viewersError);

      if (viewersData && viewersData.length > 0) {
        console.log('✅ SeenBySheet: Successfully loaded viewers from new function');
        const usersWithTimestamp: SeenByUser[] = viewersData.map(viewer => ({
          id: viewer.user_id,
          full_name: viewer.full_name || 'משתמש',
          profile_picture: viewer.profile_picture,
          read_at: viewer.viewed_at || messageTimestamp,
        }));
        
        console.log('📋 SeenBySheet: Final users with timestamp:', usersWithTimestamp);
        setUsers(usersWithTimestamp);
      } else {
        console.log('⚠️ SeenBySheet: No viewers found, showing empty state');
        setUsers([]);
      }
    } catch (error) {
      console.error('❌ SeenBySheet: Error loading viewers:', error);
      setUsers([]);
    } finally {
      setLoading(false);
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

  const renderUser = ({ item }: { item: SeenByUser }) => (
    <View className="flex-row items-center justify-between px-6 py-4 border-b border-border-light">
      <View className="flex-row items-center flex-1">
        <View className="w-12 h-12 rounded-full mr-4 overflow-hidden bg-primary/20 border border-primary/40">
          {item.profile_picture ? (
            <Image
              source={{ uri: item.profile_picture }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-primary/30 items-center justify-center">
              <User size={24} color="white" strokeWidth={2} />
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold text-base" numberOfLines={1}>
            {item.full_name || 'משתמש'}
          </Text>
          <Text className="text-text-secondary text-xs mt-1">
            ראה את ההודעה
          </Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-text-secondary text-sm font-medium">
          {formatTimeAgo(item.read_at)}
        </Text>
        <Text className="text-text-secondary text-xs mt-1">
          {new Date(item.read_at).toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })}
        </Text>
      </View>
    </View>
  );

  console.log('🔍 SeenBySheet: Rendering component, visible:', visible);
  
  if (!visible) {
    console.log('🚫 SeenBySheet: Not visible, returning null');
    return null;
  }
  
  console.log('✅ SeenBySheet: Component is visible, rendering Modal');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => console.log('🎭 SeenBySheet: Modal onShow triggered')}
      onDismiss={() => console.log('🚫 SeenBySheet: Modal onDismiss triggered')}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-6">
        {/* Backdrop */}
        <Pressable className="absolute inset-0" onPress={onClose} />
        
        {/* Center Modal */}
        <View className="bg-background rounded-3xl w-full max-w-sm max-h-[80%] min-h-[320px]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-5 border-b border-border-light">
            <Text className="text-white text-xl font-bold">נראה על ידי</Text>
            <Pressable 
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-dark items-center justify-center active:bg-gray-700"
            >
              <X size={20} color="white" strokeWidth={2} />
            </Pressable>
          </View>
          
          {/* Content */}
          {loading ? (
            <View className="flex-1 items-center justify-center py-16">
              <ActivityIndicator size="large" color="#00D84A" />
              <Text className="text-text-secondary mt-4 text-base">טוען משתמשים...</Text>
            </View>
          ) : users.length === 0 ? (
            <View className="flex-1 items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-full bg-dark items-center justify-center mb-4">
                <EyeOff size={32} color="#9CA3AF" strokeWidth={2} />
              </View>
              <Text className="text-text-secondary text-lg text-center">אף אחד לא ראה עדיין</Text>
              <Text className="text-text-secondary text-sm mt-2 text-center">
                כשמישהו יקרא את ההודעה, הוא יופיע כאן
              </Text>
            </View>
          ) : (
                         <FlatList
               data={users}
               renderItem={renderUser}
               keyExtractor={(item, index) => `${item.id}-${index}`}
               showsVerticalScrollIndicator={false}
               contentContainerStyle={{ paddingBottom: 20 }}
               className="flex-1"
             />
          )}
        </View>
      </View>
    </Modal>
  );
});

export default SeenBySheet;
