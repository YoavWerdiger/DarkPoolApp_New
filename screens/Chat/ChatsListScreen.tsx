import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, TextInput, Pressable, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { ChatService, ChatListItem } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, ChevronLeft, AlertTriangle, Bitcoin, Users, Newspaper, Trophy, Bell, Briefcase, Home, Star } from 'lucide-react-native';
import UnreadCounter from '../../components/chat/UnreadCounter';
import UIBottomSheet from '../../components/ui/UIBottomSheet';
import { useDesignTokens } from '../../components/ui/DesignTokens';

const groupIcons: Record<string, string> = {
  'דיונים - כללי': 'home',
  'פינטוקס (סיכון גבוה)': 'warning',
  'קריפטו': 'star',
  'שאלות תשובות בשוק': 'people',
  'חדשות מתפרצות': 'newspaper',
  'רווחים והצלחות!': 'trophy',
  'איתותים וסטאפים': 'notifications',
  'השקעות וכלים פיננסיים': 'briefcase',
};

export default function ChatsListScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<ChatListItem[]>([]);
  const [communityMembersCount, setCommunityMembersCount] = useState<number>(0);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const loadChats = async (userId?: string) => {
    const currentUserId = userId || user?.id;
    if (!currentUserId) {
      console.log('⚠️ ChatsListScreen: No user ID');
      return;
    }
    
    console.log('🔄 ChatsListScreen: Loading chats for user:', currentUserId);
    try {
      const chats = await ChatService.getChatList(currentUserId);
      console.log('📋 ChatsListScreen: Loaded chats:', chats);
      setChats(chats);
      setFiltered(chats); // עדכן גם את הרשימה המסוננת
    } catch (error) {
      console.error('❌ ChatsListScreen: Error loading chats:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadChats(user.id);
      loadCommunityMembersCount();
      loadAvailableGroups();
    }
  }, [user]);

  // רענון הרשימה כשחוזרים למסך
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔄 ChatsListScreen: Screen focused - refreshing chats');
      if (user?.id) {
        loadChats(user.id);
        loadAvailableGroups(); // גם טען קבוצות זמינות
      }
    });

    return unsubscribe;
  }, [navigation, user?.id]);

  // Realtime subscription לעדכון unread counts
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 ChatsListScreen: Setting up realtime subscriptions');
    
    // Subscribe to changes in user_channel_state to update unread counts
    const stateSubscription = supabase
      .channel('user-channel-state-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_channel_state',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('📥 ChatsListScreen: user_channel_state changed:', payload);
          // Refresh chats when last_read_message_id changes
          loadChats(user.id);
        }
      )
      .subscribe();

    // Subscribe to new messages to update chat list immediately
    const messagesSubscription = supabase
      .channel('new-messages-for-chat-list')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages'
        }, 
        (payload) => {
          console.log('📥 ChatsListScreen: New message received:', payload);
          // Refresh chats to update unread counts and last message
          loadChats(user.id);
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 ChatsListScreen: Cleaning up realtime subscriptions');
      stateSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
    };
  }, [user?.id]);

  const loadCommunityMembersCount = async () => {
    try {
      console.log('🔄 ChatsListScreen: Loading community members count...');
      
      // מחפש קבוצה קהילתית לפי התמונה או שם
      const { data: communityChannel, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .or('image_url.ilike.%/111.png,name.eq.דיונים כללי')
        .limit(1)
        .single();
      
      if (channelError) {
        console.error('❌ ChatsListScreen: Error loading community channel:', channelError);
        return;
      }
      
      if (communityChannel?.id) {
        console.log('🏘️ ChatsListScreen: Found community channel:', communityChannel.id);
        const { count, error: countError } = await ChatService.getChannelMembersCount(communityChannel.id);
        if (countError) {
          console.error('❌ ChatsListScreen: Error loading community members count:', countError);
          return;
        }
        if (typeof count === 'number') {
          console.log('👥 ChatsListScreen: Community members count:', count);
          setCommunityMembersCount(count);
        }
      } else {
        console.log('⚠️ ChatsListScreen: No community channel found');
      }
    } catch (error) {
      console.error('❌ ChatsListScreen: Error loading community members count:', error);
    }
  };

  const loadAvailableGroups = async () => {
    console.log('🔄 ChatsListScreen: loadAvailableGroups called');
    if (!user?.id) {
      console.log('⚠️ ChatsListScreen: No user ID for loadAvailableGroups');
      return;
    }
    
    try {
      console.log('🔄 ChatsListScreen: Loading available groups for user:', user.id);
      
      // שלוף את כל הקבוצות הציבוריות
      const { data: groups, error: groupsError } = await supabase
        .from('channels')
        .select('*')
        .eq('is_public', true)
        .order('created_at');

      if (groupsError) {
        console.error('❌ ChatsListScreen: Error loading groups:', groupsError);
        return;
      }

      console.log('📋 ChatsListScreen: Found public groups:', groups?.length || 0);
      console.log('📋 ChatsListScreen: Public groups details:', groups?.map(g => ({ id: g.id, name: g.name, is_public: g.is_public })));

      // שלוף את הקבוצות שהמשתמש כבר חבר בהן
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (userGroupsError) {
        console.error('❌ ChatsListScreen: Error loading user groups:', userGroupsError);
        return;
      }

      const memberGroupIds = userGroups?.map(g => g.channel_id) || [];
      console.log('👥 ChatsListScreen: User is member of groups:', memberGroupIds);
      console.log('👥 ChatsListScreen: User groups details:', userGroups);
      
      // סנן רק קבוצות שהמשתמש לא חבר בהן
      const available = groups?.filter(group => !memberGroupIds.includes(group.id)) || [];
      console.log('✅ ChatsListScreen: Available groups for joining:', available.length);
      console.log('✅ ChatsListScreen: Available groups details:', available.map(g => ({ id: g.id, name: g.name })));
      setAvailableGroups(available);
    } catch (error) {
      console.error('❌ ChatsListScreen: Error loading available groups:', error);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user?.id) {
      console.log('⚠️ ChatsListScreen: No user ID for handleJoinGroup');
      return;
    }
    
    console.log('🔄 ChatsListScreen: Joining group:', groupId);
    setJoining(groupId);
    
    try {
      // בדיקה אם המשתמש כבר חבר בקבוצה
      const { data: existingMember, error: checkError } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', groupId)
        .eq('user_id', user.id)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ ChatsListScreen: Error checking existing membership:', checkError);
        return;
      }
      
      if (existingMember) {
        console.log('ℹ️ ChatsListScreen: User is already a member of this group');
        // המשתמש כבר חבר, נסגור את המודל ונעדכן את הרשימה
        setShowModal(false);
        return;
      }
      
      // המשתמש לא חבר, נוסיף אותו
      const { error: insertError } = await supabase.from('channel_members').insert({ 
        channel_id: groupId, 
        user_id: user.id 
      });
      
      if (insertError) {
        console.error('❌ ChatsListScreen: Error joining group:', insertError);
        return;
      }
      
      console.log('✅ ChatsListScreen: Successfully joined group:', groupId);
      
      // רענן את הרשימות
      console.log('🔄 ChatsListScreen: Refreshing chat list...');
      ChatService.getChatList(user.id).then((chats) => {
        console.log('📋 ChatsListScreen: Refreshed chats:', chats);
        setChats(chats);
        setFiltered(chats); // עדכן גם את הרשימה המסוננת
      }).catch((error) => {
        console.error('❌ ChatsListScreen: Error refreshing chats:', error);
      });
      
      loadAvailableGroups();
      setShowModal(false);
    } catch (error) {
      console.error('❌ ChatsListScreen: Error joining group:', error);
    } finally {
      setJoining(null);
    }
  };

  const openGroupModal = async (group: any) => {
    console.log('🎯 ChatsListScreen: openGroupModal called', { groupId: group.id, groupName: group.name });
    
    // הגדר את הקבוצה הבסיסית מיד כדי שהמודל יוכל להציג משהו
    setSelectedGroup(group);
    // פתח את המודל מיד עם הנתונים הבסיסיים
    setShowModal(true);
    
    // טען את כל הנתונים המלאים של הקבוצה ברקע
    try {
      // טען את נתוני הקבוצה
      const { data: fullGroupData, error: groupError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', group.id)
        .single();
      
      if (groupError) {
        console.error('❌ ChatsListScreen: Error loading full group data:', groupError);
        // נשתמש בנתונים הבסיסיים שכבר הגדרנו
        return;
      }
      
      // טען את מספר החברים
      const { count: membersCount, error: countError } = await supabase
        .from('channel_members')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', group.id);
      
      if (countError) {
        console.error('❌ ChatsListScreen: Error loading members count:', countError);
      }
      
      // נשתמש בנתונים המלאים
      const groupWithCount = {
        ...fullGroupData,
        member_count: membersCount || fullGroupData.member_count || 0
      };
      
      console.log('✅ ChatsListScreen: Full group data loaded:', {
        name: groupWithCount.name,
        image_url: groupWithCount.image_url,
        description: groupWithCount.description,
        member_count: groupWithCount.member_count
      });
      
      // עדכן את הנתונים המלאים (המודל כבר פתוח)
      setSelectedGroup(groupWithCount);
    } catch (error) {
      console.error('❌ ChatsListScreen: Exception loading group data:', error);
      // נשתמש בנתונים הבסיסיים שכבר הגדרנו
    }
  };

  const closeModal = () => {
    console.log('🔴 ChatsListScreen: closeModal called');
    setShowModal(false);
    setSelectedGroup(null);
  };

  // Debug: Track modal state changes
  useEffect(() => {
    console.log('🔍 ChatsListScreen: Modal state changed:', {
      showModal,
      hasSelectedGroup: !!selectedGroup,
      selectedGroupName: selectedGroup?.name
    });
  }, [showModal, selectedGroup]);

  useEffect(() => {
    if (!search) setFiltered(chats);
    else setFiltered(
      chats.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_message?.content?.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, chats]);

  const handlePin = async (chat: ChatListItem) => {
    await ChatService.togglePinChat(chat.id, chat.is_pinned);
    if (user?.id) {
      ChatService.getChatList(user.id).then(setChats);
    }
  };

  const renderItem = ({ item }: { item: ChatListItem }) => {
    const iconName = groupIcons[item.name] || 'home';
    let lastMsgPrefix = '';
    if (item.last_message) {
      if (item.last_message.sender_id === user?.id) {
        lastMsgPrefix = 'אתה: ';
      } else if (item.last_message.sender_name) {
        lastMsgPrefix = item.last_message.sender_name + ': ';
      }
    }
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 15,
          backgroundColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: DesignTokens.colors.border.primary
        }}
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, isGroup: item.is_group })}
      >
        {item.avatar_url ? (
          <Image 
            source={{ uri: item.avatar_url }} 
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              marginRight: 12,
              borderWidth: 2,
              borderColor: DesignTokens.colors.primary.main,
              shadowColor: DesignTokens.colors.primary.main,
              shadowOpacity: 0.3,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 }
            }}
          />
        ) : (
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: DesignTokens.colors.background.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
            borderWidth: 1,
            borderColor: DesignTokens.colors.border.main,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 }
          }}>
            <Text style={{ color: DesignTokens.colors.primary.main, fontSize: 16, fontWeight: 'bold' }}>
              {item.name.charAt(0)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontWeight: '600',
              fontSize: 15,
              textAlign: 'right',
              marginRight: 12,
              flex: 1
            }}>{item.name}</Text>
            <Text style={{
              color: DesignTokens.colors.text.tertiary,
              fontSize: 11,
              marginRight: 22,
              textAlign: 'right'
            }}>{formatTime(item.last_message?.timestamp)}</Text>
          </View>
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4
          }}>
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: 1
            }}>
              <Text style={{
                color: DesignTokens.colors.text.tertiary,
                fontSize: 13,
                textAlign: 'right',
                marginRight: 12,
                flex: 1
              }} numberOfLines={1}>
                {item.last_message ? lastMsgPrefix + item.last_message.content : 'התחל שיחה חדשה'}
              </Text>
              {item.has_unread_mentions && (
                <Text style={{
                  color: DesignTokens.colors.primary.main,
                  fontWeight: 'bold',
                  fontSize: 14,
                  marginLeft: 12
                }}>@</Text>
              )}
            </View>
            <UnreadCounter count={item.unread_count || 0} size="medium" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      {/* Background Gradient removed - SwiftUI style: clean backgrounds */}
      {/* Community Header */}
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: 50,
          paddingBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: DesignTokens.colors.border.primary,
          position: 'relative',
          minHeight: 100
        }}>
        <LinearGradient
          colors={[`${DesignTokens.colors.success.main}14`, `${DesignTokens.colors.success.main}08`, `${DesignTokens.colors.success.main}0D`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.3
          }}
          resizeMode="cover"
        />
        <Text style={{
          color: DesignTokens.colors.text.primary,
          fontWeight: '700',
          fontSize: 24,
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}>קהילת DarkPool</Text>
        <Text style={{
          color: DesignTokens.colors.text.secondary,
          fontSize: 15,
          marginTop: 6,
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}>{communityMembersCount} חברים בקהילה</Text>
      </View>
      
      
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 340 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text className="text-center text-gray-500 mt-8">אין שיחות פעילות</Text>}
        ListFooterComponent={() => (
          availableGroups.length > 0 ? (
            <View style={{ marginHorizontal: 0, marginBottom: 16 }}>
              {/* Divider with Title */}
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: DesignTokens.colors.background.secondary,
                borderBottomWidth: 1,
                borderBottomColor: `${DesignTokens.colors.success.main}33`
              }}>
                <Text style={{
                  color: DesignTokens.colors.primary.main,
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'right',
                  marginRight: 8
                }}>
                  קבוצות להצטרפות
                </Text>
                <View style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: `${DesignTokens.colors.success.main}4D`,
                  marginRight: 12
                }} />
                <Text style={{
                  color: DesignTokens.colors.primary.main,
                  fontSize: 14,
                  fontWeight: '500',
                  marginRight: 12
                }}>
                  {availableGroups.length}
                </Text>
              </View>

              {/* Groups List */}
              {availableGroups.map((group, index) => (
                <TouchableOpacity 
                  key={group.id} 
                  onPress={() => openGroupModal(group)}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    backgroundColor: 'transparent',
                    borderBottomWidth: index < availableGroups.length - 1 ? 1 : 0,
                    borderBottomColor: DesignTokens.colors.border.primary
                  }}
                >
                  {group.image_url ? (
                    <Image 
                      source={{ uri: group.image_url }} 
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginRight: 1,
                        borderWidth: 2,
                        borderColor: DesignTokens.colors.primary.main,
                        shadowColor: DesignTokens.colors.primary.main,
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 }
                      }}
                    />
                  ) : (
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: DesignTokens.colors.primary.main,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                      shadowColor: DesignTokens.colors.primary.main,
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 }
                    }}>
                      <MessageCircle size={24} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: DesignTokens.colors.text.primary,
                      fontSize: 15,
                      fontWeight: '600',
                      textAlign: 'right',
                      marginRight: 12,
                      marginBottom: 4
                    }}>
                      {group.name}
                    </Text>
                    <Text style={{
                      color: DesignTokens.colors.text.tertiary,
                      fontSize: 13,
                      textAlign: 'right',
                      marginRight: 12,
                    }}>
                      {group.member_count} חברים
                    </Text>
                  </View>
                  <ChevronLeft size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        )}
      />

      {/* Bottom Sheet Modal - SwiftUI style */}
      <UIBottomSheet
        visible={showModal}
        onClose={closeModal}
        showHandle={true}
        dragToClose={true}
        maxHeight="70%"
      >
        {selectedGroup ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}>
            {/* תמונת הקבוצה */}
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              {selectedGroup.image_url ? (
                <View style={{
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <Image 
                    source={{ uri: selectedGroup.image_url }} 
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      borderWidth: 3,
                      borderColor: DesignTokens.colors.primary.main,
                    }}
                  />
                </View>
              ) : (
                <View style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: `${DesignTokens.colors.success.main}26`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: DesignTokens.colors.primary.main,
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <MessageCircle size={48} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
                </View>
              )}
              
              <Text style={{
                color: DesignTokens.colors.text.primary,
                fontSize: 28,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 24,
                marginBottom: 12,
                letterSpacing: -0.5
              }}>
                {selectedGroup.name}
              </Text>
              
              {selectedGroup.description && (
                <Text style={{ 
                  color: DesignTokens.colors.text.secondary, 
                  fontSize: 16, 
                  textAlign: 'center',
                  lineHeight: 24,
                  marginBottom: 20,
                  paddingHorizontal: 16
                }}>
                  {selectedGroup.description}
                </Text>
              )}
              
              <LinearGradient
                colors={[`${DesignTokens.colors.success.main}26`, `${DesignTokens.colors.success.main}14`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: `${DesignTokens.colors.success.main}4D`
                }}
              >
                <Users size={16} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
                <Text style={{ 
                  color: DesignTokens.colors.primary.main, 
                  fontSize: 15, 
                  fontWeight: '600',
                  marginLeft: 10
                }}>
                  {selectedGroup.members_count || selectedGroup.member_count || communityMembersCount} משתתפים
                </Text>
              </LinearGradient>
            </View>

            {/* כפתורי פעולה - SwiftUI style */}
            <View style={{ gap: 14 }}>
              <TouchableOpacity
                onPress={() => handleJoinGroup(selectedGroup.id)}
                disabled={joining === selectedGroup.id}
                style={{
                  backgroundColor: DesignTokens.colors.primary.main,
                  paddingVertical: 18,
                  borderRadius: 14,
                  alignItems: 'center',
                  opacity: joining === selectedGroup.id ? 0.7 : 1,
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                {joining === selectedGroup.id ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={{
                    color: '#000',
                    fontSize: 18,
                    fontWeight: '700',
                    letterSpacing: 0.3
                  }}>
                    הצטרף לקבוצה
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeModal}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  borderRadius: 14,
                  backgroundColor: DesignTokens.colors.background.secondary,
                }}
              >
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontSize: 17,
                  fontWeight: '600',
                }}>
                  ביטול
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </UIBottomSheet>
    </View>
  );
}

function formatTime(ts: string | undefined) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} 