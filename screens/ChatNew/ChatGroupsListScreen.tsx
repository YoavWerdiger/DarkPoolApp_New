// ============================================
// Chat Groups List Screen - Modern Design (Exact Copy)
// ============================================

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  I18nManager,
  Image,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LinearGradient } from 'expo-linear-gradient';
import UICard from '../../components/ui/UICard';
import { useAuth } from '../../context/AuthContext';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ChatGroup } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';

// Force RTL
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// ============================================
// Design Colors (from reference design)
// ============================================
const COLORS = {
  background: {
    primary: '#111111',
    secondary: '#1a1a1a',
    tertiary: '#2a2a2a',
  },
  border: '#2a2a2a',
  text: {
    primary: '#FFFFFF',
    secondary: '#9CA3AF', // gray-400
    tertiary: '#6B7280', // gray-500
  },
  accent: '#3B82F6', // blue-500
  success: '#22C55E', // green-500
  danger: '#EF4444', // red-500
};

// Tab types
type TabType = 'all' | 'unread' | 'mentions';

interface GroupWithMembership extends ChatGroup {
  is_member: boolean;
  my_membership_id?: string;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  } | null;
}

// מיפוי תמונות לקבוצות
const GROUP_IMAGES: { [key: string]: string } = {
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
  'חדשות מתפרצות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.png',
  '⚡ חדשות מתפרצות': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/777.png',
  'סווינגים וסטאפים': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/555.PNG',
  '🔄 סווינגים וסטאפים': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/555.PNG',
  'מסחר פניסטוקס - סיכון גבוה': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/222.PNG',
  '⚠️ מסחר פניסטוקס - סיכון גבוה': 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/groups/222.PNG',
};

const getImageByGroupName = (groupName: string): string | null => {
  if (GROUP_IMAGES[groupName]) {
    return GROUP_IMAGES[groupName];
  }
  
  const nameWithoutEmoji = groupName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();
  if (GROUP_IMAGES[nameWithoutEmoji]) {
    return GROUP_IMAGES[nameWithoutEmoji];
  }
  
  return null;
};

const GROUP_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  'הכרזות': 'megaphone',
  'דיונים - כללי': 'chatbubbles',
  'נטו ניתוחים!': 'analytics',
  'דיוני - פניסטוקס': 'trending-up',
  'שאלות ותשובות בשוק': 'help-circle',
  'עסקאות מסחר יומי': 'flash',
  'רווחים והצלחות': 'trophy',
  'חדשות מתפרצות': 'newspaper',
  'סווינגים וסטאפים': 'swap-horizontal',
  'מסחר פניסטוקס - סיכון גבוה': 'warning',
};

// פורמט זמן יחסי
const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `${diffMins}ד׳`;
  if (diffHours < 24) return `${diffHours}ש׳`;
  if (diffDays < 7) return `${diffDays}י׳`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};

export default function ChatGroupsListScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const { user } = useAuth();
  const mainTabsHeight = useMainTabsHeight();

  const [allGroups, setAllGroups] = useState<GroupWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const loadGroups = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('chat_groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (groupsError) {
        console.error('❌ Error loading groups:', groupsError);
        setIsLoading(false);
        return;
      }

      const { data: memberships } = await supabase
        .from('chat_group_members')
        .select('id, group_id, unread_count, mentioned_count')
        .eq('user_id', user.id);

      const myGroupIds = new Set(memberships?.map(m => m.group_id) || []);
      const membershipMap = new Map(memberships?.map(m => [m.group_id, m.id]) || []);
      const unreadCountMap = new Map(memberships?.map(m => [m.group_id, m.unread_count || 0]) || []);
      const mentionedCountMap = new Map(memberships?.map(m => [m.group_id, m.mentioned_count || 0]) || []);

      const groupsWithLastMessage = await Promise.all(
        groups.map(async (g) => {
          const { data: messages, error: lastMessageError } = await supabase
            .from('chat_messages')
            .select(`
              content,
              message_type,
              created_at,
              sender_id,
              users!chat_messages_sender_id_fkey(
                id,
                display_name,
                full_name
              )
            `)
            .eq('group_id', g.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const lastMessage = messages && messages.length > 0 ? messages[0] : null;
          
          if (lastMessageError) {
            console.error('❌ Error loading last message for group', g.id, lastMessageError);
          }

          let messageContent = '';
          let senderName = 'משתמש';
          
          if (lastMessage) {
            const users = (lastMessage as any).users;
            if (users) {
              const userData = Array.isArray(users) ? users[0] : users;
              senderName = userData?.display_name || userData?.full_name || 'משתמש';
            } else if (lastMessage.sender_id) {
              const { data: userData } = await supabase
                .from('users')
                .select('display_name, full_name')
                .eq('id', lastMessage.sender_id)
                .maybeSingle();
              
              if (userData) {
                senderName = userData.display_name || userData.full_name || 'משתמש';
              }
            }
            
            if (lastMessage.content) {
              messageContent = lastMessage.content;
            } else {
              switch (lastMessage.message_type) {
                case 'image':
                  messageContent = '📷 תמונה';
                  break;
                case 'video':
                  messageContent = '🎬 וידאו';
                  break;
                case 'audio':
                  messageContent = '🎤 הודעת קול';
                  break;
                case 'document':
                  messageContent = '📄 מסמך';
                  break;
                default:
                  messageContent = 'הודעה';
              }
            }
          }

          const unreadCount = unreadCountMap.get(g.id) || 0;
          const isMember = myGroupIds.has(g.id);

          return {
            ...g,
            is_member: isMember,
            my_membership_id: membershipMap.get(g.id),
            unread_count: unreadCount,
            mentioned_count: mentionedCountMap.get(g.id) || 0,
            last_message: lastMessage
              ? {
                  content: messageContent,
                  sender_name: senderName,
                  created_at: lastMessage.created_at,
                }
              : null,
          };
        })
      );

      setAllGroups(groupsWithLastMessage);

      const { data: allMembers, error: membersError } = await supabase
        .from('chat_group_members')
        .select('user_id');

      if (!membersError && allMembers) {
        const uniqueMembers = new Set(allMembers.map(m => m.user_id));
        setTotalMembers(uniqueMembers.size);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [user]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    let filtered = allGroups;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
      );
    }

    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(g => g.is_member && (g.unread_count || 0) > 0);
        break;
      case 'mentions':
        filtered = filtered.filter(g => g.is_member && (g.mentioned_count || 0) > 0);
        break;
      case 'all':
      default:
        filtered = [...filtered].sort((a, b) => {
          if (a.is_member && !b.is_member) return -1;
          if (!a.is_member && b.is_member) return 1;
          return 0;
        });
        break;
    }

    return filtered;
  }, [allGroups, searchQuery, activeTab]);

  const unreadCount = useMemo(() => 
    allGroups.filter(g => g.is_member && (g.unread_count || 0) > 0).length, 
    [allGroups]
  );

  const handleJoinGroup = async (group: GroupWithMembership) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'member',
        });

      if (error) {
        Alert.alert('שגיאה', 'לא הצלחנו להצטרף');
        return;
      }

      loadGroups();
    } catch (error) {
      console.error(error);
    }
  };

  const handleGroupPress = (group: GroupWithMembership) => {
    if (!group.is_member) {
      Alert.alert(
        group.name,
        'כדי לצפות בקבוצה יש להצטרף',
        [
          { text: 'ביטול', style: 'cancel' },
          { text: 'הצטרף', onPress: () => handleJoinGroup(group) },
        ]
      );
      return;
    }

    Keyboard.dismiss();
    (navigation as any).navigate('ChatGroup', { groupId: group.id });
  };

  const renderGroup = useCallback(({ item }: { item: GroupWithMembership }) => {
    const iconName = GROUP_ICONS[item.name] || 'chatbubbles';
    const hasUnread = (item.unread_count || 0) > 0;
    const hasMentions = (item.mentioned_count || 0) > 0;
    
    const imageUrl = item.avatar_url || getImageByGroupName(item.name) || null;
    const hasImageError = imageUrl ? imageErrors.has(imageUrl) : false;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {imageUrl && !hasImageError ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.avatar}
              resizeMode="cover"
              onError={() => {
                setImageErrors(prev => new Set(prev).add(imageUrl));
              }}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name={iconName} size={20} color={COLORS.text.secondary} />
            </View>
          )}
          {/* Online/Unread indicator */}
          {item.is_member && hasUnread && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        {/* Content */}
        <View style={styles.chatContent}>
          <View style={styles.topRow}>
            <Text style={[styles.chatName, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.last_message && (
              <Text style={styles.timeText}>
                {formatRelativeTime(item.last_message.created_at)}
              </Text>
            )}
          </View>
          
          <View style={styles.bottomRow}>
            {item.is_member ? (
              <Text style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
                {item.last_message 
                  ? `${item.last_message.sender_name}: ${item.last_message.content}`
                  : 'אין הודעות עדיין'
                }
              </Text>
            ) : (
              <Text style={styles.memberCountText}>
                {item.members_count || 0} חברים
              </Text>
            )}
            
            {/* Badge */}
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count! > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            ) : hasMentions ? (
              <View style={styles.mentionBadge}>
                <Text style={styles.mentionBadgeText}>@</Text>
              </View>
            ) : !item.is_member ? (
              <TouchableOpacity
                style={styles.joinButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleJoinGroup(item);
                }}
              >
                <Ionicons name="add" size={16} color={COLORS.accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [imageErrors]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={styles.emptyText}>טוען...</Text>
        </>
      ) : searchQuery ? (
        <>
          <Ionicons name="search-outline" size={64} color={COLORS.text.tertiary} />
          <Text style={styles.emptyTitle}>לא נמצאו תוצאות</Text>
          <Text style={styles.emptyText}>נסה לחפש משהו אחר</Text>
        </>
      ) : activeTab === 'unread' ? (
        <>
          <Ionicons name="checkmark-done-circle-outline" size={64} color={COLORS.success} />
          <Text style={styles.emptyTitle}>הכל נקרא! 🎉</Text>
          <Text style={styles.emptyText}>אין הודעות חדשות</Text>
        </>
      ) : (
        <>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.text.tertiary} />
          <Text style={styles.emptyTitle}>אין קבוצות</Text>
        </>
      )}
    </View>
  );

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={{ flex: 1 }}
    >
      <RNSafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          {/* Header */}
      <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: 0 }}>
        <UICard variant="blur" padding="sm">
          <View style={[styles.headerTop, { marginTop: 0 }]}>
            {/* Right side: title + members, aligned right */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.headerTitle, { marginRight: 10 }]}>
                קהילת - <Text style={styles.headerTitleBrand}>DarkPool</Text>
              </Text>
              <Text
                style={{
                  marginRight: 10, marginTop: 3,
                  fontSize: DesignTokens.typography.fontSize.sm,
                  color: DesignTokens.colors.text.secondary,
                  textAlign: 'right',
                }}
              >
                {totalMembers} חברים בקהילה
              </Text>
            </View>
            {/* Left side: big logo, centered vertically */}
            <Image
              source={{
                uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/f21d2751-1a07-4f04-bbd5-59540a4ae059-2.png',
              }}
              style={{ width: 96, height: 96, marginLeft: 10}}
              resizeMode="contain"
            />
          </View>
        </UICard>
      </View>

          {/* Tabs */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginTop: DesignTokens.spacing.md, marginBottom: DesignTokens.spacing.sm }}>
            <UICard variant="blur" padding="none" style={styles.tabsCard}>
              <View>
                <View style={styles.tabsContainer}>
                  <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('all')}>
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === 'all' && { color: DesignTokens.colors.primary.main },
                      ]}
                    >
                      הכל
                    </Text>
                    {activeTab === 'all' && (
                      <View
                        style={[
                          styles.tabIndicator,
                          { backgroundColor: DesignTokens.colors.primary.main },
                        ]}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('unread')}>
                    <View style={styles.tabContent}>
                      <Text
                        style={[
                          styles.tabText,
                          activeTab === 'unread' && { color: DesignTokens.colors.primary.main },
                        ]}
                      >
                        לא נקראו
                      </Text>
                      {unreadCount > 0 && (
                        <View
                          style={[
                            styles.tabBadge,
                            { backgroundColor: DesignTokens.colors.primary.main },
                          ]}
                        >
                          <Text style={styles.tabBadgeText}>{unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    {activeTab === 'unread' && (
                      <View
                        style={[
                          styles.tabIndicator,
                          { backgroundColor: DesignTokens.colors.primary.main },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Search Bar under tabs */}
                <View
                  style={[
                    styles.searchContainer,
                    { marginTop: 10, marginBottom: 12, marginHorizontal: 12 },
                  ]}
                >
                  <Ionicons
                    name="search"
                    size={16}
                    color={COLORS.text.tertiary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="חיפוש בקבוצות..."
                    placeholderTextColor={COLORS.text.tertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.clearButton}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={COLORS.text.tertiary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </UICard>
          </View>

          {/* Chat List */}
          <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
            <FlatList
              data={filteredGroups}
              renderItem={renderGroup}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={loadGroups} tintColor={COLORS.accent} />
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                filteredGroups.length === 0 ? styles.emptyListContainer : undefined
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </RNSafeAreaView>
    </LinearGradient>
  );
}

// ============================================
// Styles - Exact Copy from Reference Design
// ============================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  // Header - bg-[#1a1a1a] border-b border-[#2a2a2a] px-5 py-4
  header: {
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  headerTitleBrand: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 50,
  },

  // Search - bg-[#2a2a2a] rounded-full py-2.5 pl-10 pr-4
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.background.tertiary,
    borderRadius: 50,
    paddingHorizontal: 16,
    height: 42,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
    textAlign: 'right',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },

  // Tabs - flex gap-6 px-5 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]
  tabsCard: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabsContainer: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 12,
    position: 'relative',
  },
  tabContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: COLORS.accent,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  tabBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 50,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Chat Item - px-5 py-3.5 hover:bg-[#1a1a1a] border-b border-[#1a1a1a]
  chatItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarContainer: {
    position: 'relative',
    marginLeft: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Online indicator - w-3 h-3 bg-green-500 rounded-full border-2 border-[#111111]
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.background.primary,
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  // Time - text-xs text-gray-500
  timeText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginRight: 8,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Last message - text-sm text-gray-400
  lastMessage: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  lastMessageUnread: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  memberCountText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  // Badge - bg-blue-500 text-white text-xs rounded-full px-2 py-0.5
  unreadBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 50,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginRight: 8,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  mentionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  mentionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  joinButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent + '33',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  // Empty State
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
