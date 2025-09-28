import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  full_name: string | null;
  display_name: string | null;
  profile_picture: string | null;
}

interface MentionPickerProps {
  visible: boolean;
  onSelectUser: (user: { id: string; display: string }) => void;
  onClose: () => void;
  channelId: string;
  searchQuery: string;
}

const MentionPicker: React.FC<MentionPickerProps> = ({
  visible,
  onSelectUser,
  onClose,
  channelId,
  searchQuery,
}) => {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible && channelId) {
      loadChannelMembers();
    }
  }, [visible, channelId]);

  useEffect(() => {
    setSearchText(searchQuery);
  }, [searchQuery]);

  const loadChannelMembers = async () => {
    if (!channelId) return;
    
    try {
      console.log('🔄 MentionPicker: Loading channel members for chat:', channelId);
      
      // שלוף חברי הערוץ עם הנתונים המלאים
      const { data: membersData, error: membersError } = await supabase
        .from('channel_members')
        .select('user_id, role, user_data')
        .eq('channel_id', channelId);
      
      if (membersError) {
        console.error('❌ MentionPicker: Error loading channel members:', membersError);
        return;
      }
      
      console.log('✅ MentionPicker: Channel members loaded:', membersData?.length || 0);
      console.log('📋 MentionPicker: First few members:', membersData?.slice(0, 3));
      
      if (membersData && membersData.length > 0) {
        // המר את הנתונים לפורמט הנכון
        const formattedMembers = membersData.map(member => ({
          id: member.user_id,
          full_name: member.user_data?.full_name || `User ${member.user_id.slice(0, 8)}`,
          profile_picture: member.user_data?.profile_picture || null,
          phone: member.user_data?.phone || null,
          display_name: member.user_data?.display_name || member.user_data?.full_name || `User ${member.user_id.slice(0, 8)}`,
          role: member.role
        }));
        
        console.log('🔗 MentionPicker: Formatted members data:', formattedMembers.slice(0, 2));
        setMembers(formattedMembers);
      } else {
        console.log('⚠️ MentionPicker: No channel members found');
        setMembers([]);
      }
    } catch (error) {
      console.error('❌ MentionPicker: Exception in loadChannelMembers:', error);
      setMembers([]);
    }
  };

  // פונקציה נפרדת לפתרון החלופי
  const loadFallbackMembers = async (altMemberData: any) => {
    try {
      console.log('🔍 MentionPicker: Loading fallback members from channel_members...');
      
      const { data: fallbackMemberData, error: fallbackError } = await supabase
        .from('channel_members')
        .select('user_id, role, joined_at')
        .eq('channel_id', channelId);
      
      if (fallbackError) {
        console.error('❌ MentionPicker: Fallback approach failed:', fallbackError);
        return;
      }
      
      // יצירת אובייקטים פשוטים עם המידע שיש לנו
      const fallbackMembers = fallbackMemberData.map(member => ({
        id: member.user_id,
        full_name: `User ${member.user_id.slice(0, 8)} (${member.role || 'member'})`,
        display_name: `User ${member.user_id.slice(0, 8)}`,
        profile_picture: null
      }));
      
      console.log('🔍 MentionPicker: Using fallback members:', fallbackMembers.length);
      setMembers(fallbackMembers);
    } catch (error) {
      console.error('❌ MentionPicker: Error in fallback approach:', error);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchText) return members;
    
    const query = searchText.toLowerCase().replace('@', '');
    return members.filter(member => {
      const name = (member.full_name || member.display_name || '').toLowerCase();
      return name.includes(query);
    });
  }, [members, searchText]);

  const handleSelectUser = (member: User) => {
    const displayName = member.display_name || member.full_name || 'משתמש';
    onSelectUser({
      id: member.id,
      display: `@${displayName}`,
    });
    onClose();
  };

  const renderMember = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.memberRow}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      <Image
        source={
          item.profile_picture
            ? { uri: item.profile_picture }
            : require('../../assets/icon.png')
        }
        style={styles.avatar}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.display_name || item.full_name || 'משתמש'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.picker}>
        <View style={styles.header}>
          <Text style={styles.title}>בחר משתמש</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="חפש משתמש..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>טוען...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            renderItem={renderMember}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    position: 'absolute',
    bottom: 80, // מעל ל-MessageInputBar
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  picker: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    maxHeight: 300, // גובה קבוע
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  searchInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 16,
  },
  list: {
    maxHeight: 200, // גובה מקסימלי לרשימה
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MentionPicker;
