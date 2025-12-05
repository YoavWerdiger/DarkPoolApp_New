// ============================================
// Chat Groups List Screen - RTL + DesignTokens
// ============================================

import React, { useMemo, useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, I18nManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ChatGroup } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';

// Force RTL
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

interface GroupWithMembership extends ChatGroup {
  is_member: boolean;
  my_membership_id?: string;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  } | null;
}

// מיפוי אייקונים
const GROUP_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  'הכרזות': 'megaphone',
  'דיונים - כללי': 'chatbubbles',
  'נטו ניתוחים!': 'analytics',
  'דיוני - פניסטוקס': 'trending-up',
  'שאלות ותשובות בשוק': 'help-circle',
  'עסקאות מסחר יומי': 'flash',
  'חדשות מתפרצות': 'newspaper',
  'סווינגים וסטאפים': 'swap-horizontal',
  'מסחר פניסטוקס - סיכון גבוה': 'warning',
};

export default function ChatGroupsListScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const { user } = useAuth();

  const [allGroups, setAllGroups] = useState<GroupWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);

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
        .select('id, group_id')
        .eq('user_id', user.id);

      const myGroupIds = new Set(memberships?.map(m => m.group_id) || []);
      const membershipMap = new Map(memberships?.map(m => [m.group_id, m.id]) || []);

      // טעינת ההודעה האחרונה לכל קבוצה
      const groupsWithLastMessage = await Promise.all(
        groups.map(async (g) => {
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select(`
              content,
              message_type,
              created_at,
              sender:users!chat_messages_sender_id_fkey(display_name)
            `)
            .eq('group_id', g.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // טיפול בתוכן ההודעה לפי סוג
          let messageContent = '';
          if (lastMessage) {
            if (lastMessage.content) {
              messageContent = lastMessage.content;
            } else {
              // הודעת מדיה
              switch (lastMessage.message_type) {
                case 'image':
                  messageContent = 'תמונה';
                  break;
                case 'video':
                  messageContent = 'וידאו';
                  break;
                case 'audio':
                  messageContent = 'הודעת קול';
                  break;
                case 'document':
                  messageContent = 'מסמך';
                  break;
                default:
                  messageContent = 'הודעה';
              }
            }
          }

          return {
            ...g,
            is_member: myGroupIds.has(g.id),
            my_membership_id: membershipMap.get(g.id),
            last_message: lastMessage
              ? {
                  content: messageContent,
                  sender_name: (lastMessage.sender as any)?.display_name || 'משתמש',
                  created_at: lastMessage.created_at,
                }
              : null,
          };
        })
      );

      setAllGroups(groupsWithLastMessage);

      // חישוב סך החברים הייחודיים בקהילה
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

  const handleLeaveGroup = async (group: GroupWithMembership) => {
    if (!user || !group.my_membership_id) return;

    Alert.alert(
      'עזוב קבוצה',
      `האם לעזוב את "${group.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'עזוב',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('chat_group_members')
              .delete()
              .eq('id', group.my_membership_id!);
            loadGroups();
          },
        },
      ]
    );
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

    navigation.navigate('ChatGroup' as never, { groupId: group.id } as never);
  };

  // רינדור קבוצה
  const renderGroup = ({ item }: { item: GroupWithMembership }) => {
    const iconName = GROUP_ICONS[item.name] || 'chatbubbles';

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
      >
        {/* אייקון */}
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={24} color={DesignTokens.colors.text.primary} />
        </View>

        {/* מידע */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          {item.is_member ? (
            // הודעה אחרונה אם המשתמש חבר
            item.last_message ? (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message.sender_name}: {item.last_message.content}
              </Text>
            ) : (
              <Text style={styles.lastMessage}>אין הודעות</Text>
            )
          ) : (
            // מספר חברים אם המשתמש לא חבר
            <Text style={styles.memberCount}>
              {item.members_count || 0} חברים
            </Text>
          )}
        </View>

        {/* כפתור הצטרפות (רק אם לא חבר) */}
        {!item.is_member && (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={(e) => {
              e.stopPropagation();
              handleJoinGroup(item);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={DesignTokens.colors.text.secondary} />
            <Text style={styles.joinButtonText}>הצטרף</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // הפרדה
  const myGroups = allGroups.filter(g => g.is_member);
  const availableGroups = allGroups.filter(g => !g.is_member);

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );

  const renderContent = () => {
    if (isLoading && allGroups.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.accent.main} />
          <Text style={styles.emptyText}>טוען...</Text>
        </View>
      );
    }

    if (allGroups.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.secondary} />
          <Text style={styles.emptyTitle}>אין קבוצות</Text>
        </View>
      );
    }

    return (
      <View>
        {myGroups.length > 0 && (
          <>
            {renderSectionHeader('הקבוצות שלי', myGroups.length)}
            {myGroups.map(group => (
              <View key={group.id}>{renderGroup({ item: group })}</View>
            ))}
          </>
        )}

        {availableGroups.length > 0 && (
          <>
            {renderSectionHeader('קבוצות זמינות', availableGroups.length)}
            {availableGroups.map(group => (
              <View key={group.id}>{renderGroup({ item: group })}</View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            קהילת - <Text style={styles.headerTitleBrand}>DarkPool</Text>
          </Text>
          <Text style={styles.headerSubtitle}>
            {totalMembers} חברים בקהילה
          </Text>
        </View>

        <FlatList
          data={[{ key: 'content' }]}
          renderItem={renderContent}
          keyExtractor={item => item.key}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadGroups}
              tintColor={DesignTokens.colors.accent.main}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

// ============================================
// Styles - RTL + DesignTokens
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: tokens.colors.background.primary,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 4,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  headerTitleBrand: {
    fontSize: 32,
    fontWeight: '600',
    color: tokens.colors.primary.main,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: tokens.colors.background.secondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: tokens.colors.background.tertiary || tokens.colors.background.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    marginRight: 0,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text.secondary,
  },
  
  groupCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 0,
  },
  
  groupInfo: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 4,
    textAlign: 'right',
  },
  memberCount: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  lastMessage: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginTop: 2,
  },
  
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 4,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
  },
  
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.accent.main + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  memberBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.accent.main,
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
});
