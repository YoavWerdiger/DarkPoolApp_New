import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, TextInput, Pressable, Image, ImageBackground, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { ChatService, ChatListItem } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, ChevronLeft, AlertTriangle, Bitcoin, Users, Newspaper, Trophy, Bell, Briefcase, Home, Star } from 'lucide-react-native';
import UnreadCounter from '../../components/chat/UnreadCounter';

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
  const [slideAnimation] = useState(new Animated.Value(0));

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

  const openGroupModal = (group: any) => {
    setSelectedGroup(group);
    setShowModal(true);
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowModal(false);
      setSelectedGroup(null);
    });
  };

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
          borderBottomColor: 'rgba(255,255,255,0.05)'
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
              borderColor: '#00E654',
              shadowColor: '#00E654',
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
            backgroundColor: '#181818',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
            borderWidth: 1,
            borderColor: '#2a2a2a',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 }
          }}>
            <Text style={{ color: '#00E654', fontSize: 16, fontWeight: 'bold' }}>
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
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: 15,
              textAlign: 'right',
              marginRight: 12,
              flex: 1
            }}>{item.name}</Text>
            <Text style={{
              color: '#666666',
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
                color: '#999999',
                fontSize: 13,
                textAlign: 'right',
                marginRight: 12,
                flex: 1
              }} numberOfLines={1}>
                {item.last_message ? lastMsgPrefix + item.last_message.content : 'התחל שיחה חדשה'}
              </Text>
              {item.has_unread_mentions && (
                <Text style={{
                  color: '#00E654',
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
    <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}

      />
      {/* Community Header */}
        <View style={{
          flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 50, // Add top padding for status bar
        paddingBottom: 16, // Reduced padding
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,230,84,0.2)',
        position: 'relative',
        minHeight: 80 // Set minimum height
      }}>
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 20, // Move down to avoid notch
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.3
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={{
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: 18,
            marginRight: 20,
            textAlign: 'right'
          }}>קהילת - DarkPool</Text>
          <Text style={{
            color: '#B0B0B0',
            fontSize: 14,
            marginTop: 4,
            marginRight: 20,
            textAlign: 'right'
          }}>{communityMembersCount} חברים בקהילה</Text>
        </View>
        <Image
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/9.png' }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: '#00E654',
            shadowColor: '#00E654',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 }
          }}
        />
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
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0,230,84,0.2)'
              }}>
                <Text style={{
                  color: '#00E654',
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
                  backgroundColor: 'rgba(0,230,84,0.3)',
                  marginRight: 12
                }} />
                <Text style={{
                  color: '#00E654',
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
                    borderBottomColor: 'rgba(255,255,255,0.05)'
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
                        borderColor: '#00E654',
                        shadowColor: '#00E654',
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
                      backgroundColor: '#00E654',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                      shadowColor: '#00E654',
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 }
                    }}>
                      <MessageCircle size={24} color="#000000" strokeWidth={2} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: '600',
                      textAlign: 'right',
                      marginRight: 12,
                      marginBottom: 4
                    }}>
                      {group.name}
                    </Text>
                    <Text style={{
                      color: '#999999',
                      fontSize: 13,
                      textAlign: 'right',
                      marginRight: 12,
                    }}>
                      {group.member_count} חברים
                    </Text>
                  </View>
                  <ChevronLeft size={18} color="#666666" strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        )}
      />

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            onPress={closeModal}
          />
          <Animated.View
            style={{
              backgroundColor: '#1a1a1a',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 40,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              transform: [{
                translateY: slideAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                })
              }]
            }}
          >
            {/* Handle Bar */}
            <View style={{ 
              width: 40, 
              height: 4, 
              backgroundColor: '#333', 
              borderRadius: 2,
              alignSelf: 'center', 
              marginBottom: 20 
            }} />

            {selectedGroup && (
              <>
                {/* Group Header */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  {selectedGroup.image_url ? (
                    <Image 
                      source={{ uri: selectedGroup.image_url }} 
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        marginBottom: 16,
                        borderWidth: 2,
                        borderColor: '#00E654',
                        shadowColor: '#00E654',
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 4 }
                      }}
                    />
                  ) : (
                    <View style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: '#00E654',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      borderWidth: 2,
                      borderColor: '#00E654',
                      shadowColor: '#00E654',
                      shadowOpacity: 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 }
                    }}>
                      <MessageCircle size={32} color="#000000" strokeWidth={2} />
                    </View>
                  )}
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 22,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    marginBottom: 8
                  }}>
                    {selectedGroup.name}
                  </Text>
                  {selectedGroup.description && (
                    <Text style={{
                      color: '#B0B0B0',
                      fontSize: 14,
                      textAlign: 'center',
                      marginBottom: 16,
                      paddingHorizontal: 16,
                      lineHeight: 20
                    }}>
                      {selectedGroup.description}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={{ gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => handleJoinGroup(selectedGroup.id)}
                    disabled={joining === selectedGroup.id}
                    style={{
                      backgroundColor: '#00E654',
                      paddingVertical: 16,
                      paddingHorizontal: 32,
                      borderRadius: 12,
                      alignItems: 'center',
                      shadowColor: '#00E654',
                      shadowOpacity: 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4
                    }}
                  >
                    <Text style={{
                      color: '#000000',
                      fontSize: 16,
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      {joining === selectedGroup.id ? 'מצטרף לקבוצה...' : 'הצטרף לקבוצה'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={closeModal}
                    style={{
                      backgroundColor: '#333',
                      paddingVertical: 16,
                      paddingHorizontal: 32,
                      borderRadius: 12,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>ביטול</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function formatTime(ts: string | undefined) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} 