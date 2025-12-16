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
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

// מיפוי תמונות לקבוצות - עם ובלי אימוג'ים
const GROUP_IMAGES: Record<string, string> = {
  'הכרזות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/111.png',
  '🔔 הכרזות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/111.png',
  'דיונים - כללי': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.PNG',
  '💬 דיונים - כללי': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.PNG',
  'נטו ניתוחים!': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/666.PNG',
  '📊 נטו ניתוחים!': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/666.PNG',
  'דיוני - פניסטוקס': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/999.PNG',
  '💰 דיוני - פניסטוקס': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/999.PNG',
  'שאלות ותשובות בשוק': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/888.PNG',
  '❓ שאלות ותשובות בשוק': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/888.PNG',
  'עסקאות מסחר יומי': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/111%20(1).PNG',
  '📈 עסקאות מסחר יומי': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/111%20(1).PNG',
  'רווחים והצלחות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/333.PNG',
  '🎯 רווחים והצלחות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/333.PNG',
  'חדשות מתפרצות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.png', // לשמירת תאימות
  '⚡ חדשות מתפרצות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.png', // לשמירת תאימות
  'סווינגים וסטאפים': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/555.PNG',
  '🔄 סווינגים וסטאפים': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/555.PNG',
  'מסחר פניסטוקס - סיכון גבוה': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/222.PNG',
  '⚠️ מסחר פניסטוקס - סיכון גבוה': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/222.PNG',
};

// פונקציה שמסירה אימוג'ים משם הקבוצה לבדיקה
const getImageByGroupName = (groupName: string): string | null => {
  // נבדוק תחילה עם השם המלא
  if (GROUP_IMAGES[groupName]) {
    return GROUP_IMAGES[groupName];
  }
  
  // אם לא מצאנו, נסיר אימוג'ים ונבדוק שוב
  const nameWithoutEmoji = groupName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();
  if (GROUP_IMAGES[nameWithoutEmoji]) {
    return GROUP_IMAGES[nameWithoutEmoji];
  }
  
  return null;
};

const groupIcons: Record<string, string> = {
  'דיונים - כללי': 'home',
  'פינטוקס (סיכון גבוה)': 'warning',
  'קריפטו': 'star',
  'שאלות תשובות בשוק': 'people',
  'רווחים והצלחות': 'trophy',
  'חדשות מתפרצות': 'newspaper', // לשמירת תאימות
  'איתותים וסטאפים': 'notifications',
  'השקעות וכלים פיננסיים': 'briefcase',
};

export default function ChatsListScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const mainTabsHeight = useMainTabsHeight();
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
    const startTime = Date.now();
    try {
      const chats = await ChatService.getChatList(currentUserId);
      const loadTime = Date.now() - startTime;
      console.log(`📋 ChatsListScreen: Loaded ${chats.length} chats in ${loadTime}ms`);
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
    if (!user?.id) {
      return;
    }
    
    try {
      // שלוף את כל הקבוצות הציבוריות והחברויות במקביל
      const [
        { data: groups, error: groupsError },
        { data: userGroups, error: userGroupsError }
      ] = await Promise.all([
        supabase
          .from('channels')
          .select('*')
          .eq('is_public', true)
          .order('created_at'),
        supabase
          .from('channel_members')
          .select('channel_id')
          .eq('user_id', user.id)
      ]);

      if (groupsError || userGroupsError) {
        console.error('❌ ChatsListScreen: Error loading groups:', groupsError || userGroupsError);
        return;
      }

      const memberGroupIds = userGroups?.map(g => g.channel_id) || [];
      // סנן רק קבוצות שהמשתמש לא חבר בהן
      const available = groups?.filter(group => !memberGroupIds.includes(group.id)) || [];
      setAvailableGroups(available);
    } catch (error) {
      console.error('❌ ChatsListScreen: Error loading available groups:', error);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user?.id) {
      return;
    }
    
    setJoining(groupId);
    
    try {
      // RLS כבר בודק הרשאות - אין צורך בבדיקה מקדימה
      const { error: insertError } = await supabase.from('channel_members').insert({ 
        channel_id: groupId, 
        user_id: user.id 
      });
      
      if (insertError) {
        // אם זה שגיאה של duplicate - המשתמש כבר חבר, זה בסדר
        if (insertError.code === '23505') { // Unique violation
          setShowModal(false);
          return;
        }
        console.error('❌ ChatsListScreen: Error joining group:', insertError);
        return;
      }
      
      // רענן את הרשימות במקביל
      Promise.all([
        ChatService.getChatList(user.id).then((chats) => {
          setChats(chats);
          setFiltered(chats);
        }),
        loadAvailableGroups()
      ]);
      
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
      // טען את נתוני הקבוצה ומספר החברים במקביל
      const [
        { data: fullGroupData, error: groupError },
        { count: membersCount, error: countError }
      ] = await Promise.all([
        supabase
          .from('channels')
          .select('*')
          .eq('id', group.id)
          .single(),
        supabase
          .from('channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', group.id)
      ]);
      
      if (groupError) {
        console.error('❌ ChatsListScreen: Error loading full group data:', groupError);
        // נשתמש בנתונים הבסיסיים שכבר הגדרנו
        return;
      }
      
      // נשתמש בנתונים המלאים
      const groupWithCount = {
        ...fullGroupData,
        member_count: membersCount || fullGroupData.member_count || 0
      };
      
      // עדכן את הנתונים המלאים (המודל כבר פתוח)
      setSelectedGroup(groupWithCount);
    } catch (error) {
      console.error('❌ ChatsListScreen: Exception loading group data:', error);
      // נשתמש בנתונים הבסיסיים שכבר הגדרנו
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedGroup(null);
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
    const hasUnread = (item.unread_count || 0) > 0;
    let lastMsgPrefix = '';
    if (item.last_message) {
      if (item.last_message.sender_id === user?.id) {
        lastMsgPrefix = 'אתה: ';
      } else if (item.last_message.sender_name) {
        lastMsgPrefix = item.last_message.sender_name + ': ';
      }
    }
    
    // השתמש בתמונה מ-GROUP_IMAGES אם אין avatar_url
    const imageUrl = item.avatar_url || getImageByGroupName(item.name) || null;
    
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 15,
          backgroundColor: 'transparent',
          borderBottomWidth: 3,
          borderBottomColor: DesignTokens.colors.border?.primary || 'rgba(180, 180, 180, 0.9)'
        }}
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, isGroup: item.is_group })}
      >
        {imageUrl ? (
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            marginRight: 12,
            overflow: 'hidden',
            backgroundColor: DesignTokens.colors.background.primary,
            borderWidth: 3,
            borderColor: '#2d5016',
          }}>
            <Image 
              source={{ uri: imageUrl }} 
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode="cover"
              onError={(e) => {
                console.log('❌ Image load error for chat:', item.name, 'URL:', imageUrl);
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully for chat:', item.name);
              }}
            />
          </View>
        ) : (
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: DesignTokens.colors.background.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}>
            <Ionicons 
              name={iconName as any} 
              size={24} 
              color={DesignTokens.colors.text.secondary} 
            />
          </View>
        )}
        
        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 2
          }}>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontWeight: hasUnread ? '700' : '600',
              fontSize: 16,
              textAlign: 'right',
              flex: 1
            }} numberOfLines={1}>{item.name}</Text>
            {item.last_message && (
              <Text style={{
                color: DesignTokens.colors.text.tertiary,
                fontSize: 12,
                marginRight: 12,
                textAlign: 'right'
              }}>{formatTime(item.last_message.timestamp)}</Text>
            )}
          </View>
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{
              color: hasUnread ? DesignTokens.colors.text.primary : DesignTokens.colors.text.secondary,
              fontSize: 14,
              textAlign: 'right',
              flex: 1,
              fontWeight: hasUnread ? '500' : '400',
              marginRight: 12,
            }} numberOfLines={1}>
              {item.last_message ? lastMsgPrefix + item.last_message.content : 'התחל שיחה חדשה'}
            </Text>
            {item.has_unread_mentions && (
              <Text style={{
                color: DesignTokens.colors.primary.main,
                fontWeight: 'bold',
                fontSize: 14,
                marginLeft: 8
              }}>@</Text>
            )}
            {hasUnread && (
              <UnreadCounter count={item.unread_count || 0} size="medium" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      {/* Community Header */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 50,
        paddingBottom: 20,
        backgroundColor: DesignTokens.colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: DesignTokens.colors.border.primary,
      }}>
        <Text style={{
          color: DesignTokens.colors.text.primary,
          fontWeight: '700',
          fontSize: 24,
          textAlign: 'center',
          marginBottom: 6
        }}>
          קהילת DarkPool
        </Text>
        <Text style={{
          color: DesignTokens.colors.text.secondary,
          fontSize: 15,
          textAlign: 'center',
        }}>
          {communityMembersCount} חברים בקהילה
        </Text>
      </View>
      
      
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ 
          paddingTop: 16,
          paddingBottom: mainTabsHeight 
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 80,
            paddingHorizontal: 40
          }}>
            <Ionicons 
              name="chatbubbles-outline" 
              size={64} 
              color={DesignTokens.colors.text.secondary} 
            />
            <Text style={{
              color: DesignTokens.colors.text.secondary,
              fontSize: 18,
              fontWeight: '600',
              marginTop: 16,
              textAlign: 'center'
            }}>
              אין שיחות פעילות
            </Text>
            <Text style={{
              color: DesignTokens.colors.text.tertiary,
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center'
            }}>
              הצטרף לקבוצות כדי להתחיל
            </Text>
          </View>
        }
        ListFooterComponent={() => (
          availableGroups.length > 0 ? (
            <View style={{ marginHorizontal: 0, marginBottom: 16 }}>
              {/* Section Header */}
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: DesignTokens.colors.background.secondary,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                <Text style={{
                  color: DesignTokens.colors.text.primary,
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
                  backgroundColor: DesignTokens.colors.border.primary,
                  marginRight: 12
                }} />
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontSize: 14,
                  fontWeight: '500',
                  marginRight: 12
                }}>
                  {availableGroups.length}
                </Text>
              </View>

              {/* Groups List */}
              {availableGroups.map((group, index) => {
                const iconName = groupIcons[group.name] || 'home';
                const imageUrl = group.image_url || getImageByGroupName(group.name) || null;
                return (
                  <TouchableOpacity 
                    key={group.id} 
                    activeOpacity={0.7}
                    onPress={() => openGroupModal(group)}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      backgroundColor: 'transparent',
                        borderBottomWidth: index < availableGroups.length - 1 ? 2 : 0,
                        borderBottomColor: DesignTokens.colors.border?.primary || 'rgba(150, 150, 150, 0.8)'
                    }}
                  >
                    {imageUrl ? (
                      <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        marginRight: 12,
                        overflow: 'hidden',
                        backgroundColor: DesignTokens.colors.background.primary,
                        borderWidth: 2,
                        borderColor: DesignTokens.colors.border?.primary || 'rgba(150, 150, 150, 0.6)',
                      }}>
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={{
                            width: '100%',
                            height: '100%',
                          }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: DesignTokens.colors.background.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <Ionicons 
                          name={iconName as any} 
                          size={24} 
                          color={DesignTokens.colors.text.secondary} 
                        />
                      </View>
                    )}
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 15,
                        fontWeight: '600',
                        textAlign: 'right',
                        marginRight: 12,
                        marginBottom: 2
                      }} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={{
                        color: DesignTokens.colors.text.tertiary,
                        fontSize: 13,
                        textAlign: 'right',
                        marginRight: 12,
                      }}>
                        {group.member_count || 0} חברים
                      </Text>
                    </View>
                    <ChevronLeft size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null
        )}
      />

      {/* Bottom Sheet Modal - SwiftUI style */}
      <BottomSheet
        isOpen={showModal}
        onClose={closeModal}
        snapPoints={[0.6, 0.75]}
        enablePanDownToClose={true}
        backdropOpacity={0.5}
        showHandle={true}
      >
        {selectedGroup ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 200 }}>
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
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 24,
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
                  <ActivityIndicator color={DesignTokens.colors.text.primary} size="small" />
                ) : (
                  <Text style={{
                    color: DesignTokens.colors.text.primary,
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: 0.3
                  }}>
                    הצטרף לקבוצה
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function formatTime(ts: string | undefined) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} 