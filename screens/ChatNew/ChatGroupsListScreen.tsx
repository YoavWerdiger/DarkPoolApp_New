// ============================================
// Chat Groups List Screen - קבוצות זמינות
// ============================================
// מסך רשימת קבוצות קבועות - המשתמש בוחר להצטרף
// ============================================

import React, { useMemo, useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ChatGroup } from '../../types/chat.types';

interface GroupWithMembership extends ChatGroup {
  is_member: boolean;
  my_membership_id?: string;
}

export default function ChatGroupsListScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const { user } = useAuth();

  const [allGroups, setAllGroups] = useState<GroupWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // טעינת קבוצות
  const loadGroups = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // קבלת כל הקבוצות
      const { data: groups, error: groupsError } = await supabase
        .from('chat_groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (groupsError) {
        console.error('❌ Error loading groups:', groupsError);
        setIsLoading(false);
        return;
      }

      // קבלת החברויות שלי
      const { data: memberships } = await supabase
        .from('chat_group_members')
        .select('id, group_id')
        .eq('user_id', user.id);

      const myGroupIds = new Set(memberships?.map(m => m.group_id) || []);
      const membershipMap = new Map(memberships?.map(m => [m.group_id, m.id]) || []);

      const groupsWithMembership: GroupWithMembership[] = groups.map(g => ({
        ...g,
        is_member: myGroupIds.has(g.id),
        my_membership_id: membershipMap.get(g.id),
      }));

      setAllGroups(groupsWithMembership);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [user]);

  // הצטרפות לקבוצה
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
        Alert.alert('שגיאה', 'לא הצלחנו להצטרף לקבוצה');
        console.error(error);
        return;
      }

      Alert.alert('הצלחה', `הצטרפת לקבוצה "${group.name}"`);
      loadGroups();
    } catch (error) {
      console.error(error);
    }
  };

  // עזיבת קבוצה
  const handleLeaveGroup = async (group: GroupWithMembership) => {
    if (!user || !group.my_membership_id) return;

    Alert.alert(
      'עזוב קבוצה',
      `האם אתה בטוח שברצונך לעזוב את "${group.name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'עזוב',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('chat_group_members')
              .delete()
              .eq('id', group.my_membership_id!);

            if (error) {
              Alert.alert('שגיאה', 'לא הצלחנו לעזוב את הקבוצה');
              return;
            }

            Alert.alert('הצלחה', `עזבת את הקבוצה "${group.name}"`);
            loadGroups();
          },
        },
      ]
    );
  };

  // פתיחת קבוצה
  const handleGroupPress = (group: GroupWithMembership) => {
    if (!group.is_member) {
      Alert.alert(
        'הצטרף לקבוצה',
        `כדי לצפות בקבוצה "${group.name}" עליך להצטרף אליה תחילה.`,
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
  const renderGroup = ({ item }: { item: GroupWithMembership }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.memberCount}>
            👥 {item.members_count || 0} חברים
          </Text>
          {item.settings?.onlyAdminsCanSend && (
            <Text style={styles.adminOnly}>🔒 רק אדמינים</Text>
          )}
        </View>
      </View>

      {item.is_member ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => handleGroupPress(item)}
          >
            <Text style={styles.openButtonText}>פתח →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={() => handleLeaveGroup(item)}
          >
            <Text style={styles.leaveButtonText}>עזוב</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleJoinGroup(item)}
        >
          <Text style={styles.joinButtonText}>+ הצטרף</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>קבוצות קהילה</Text>
        <Text style={styles.headerSubtitle}>
          בחר את הקבוצות שמעניינות אותך
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.accent.primary} />
          <Text style={styles.emptyText}>טוען קבוצות...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>אין קבוצות זמינות</Text>
        <Text style={styles.emptyText}>הקבוצות יווספו בקרוב</Text>
      </View>
    );
  };

  // חלוקה לקבוצות - קבוצות שלי וזמינות
  const myGroups = allGroups.filter(g => g.is_member);
  const availableGroups = allGroups.filter(g => !g.is_member);

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={allGroups}
        renderItem={renderGroup}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadGroups}
            tintColor={DesignTokens.colors.accent.primary}
          />
        }
        ListHeaderComponent={
          myGroups.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                📌 הקבוצות שלי ({myGroups.length})
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={allGroups.length === 0 && styles.emptyListContent}
      />
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
  },
  
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.background.secondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  
  groupInfo: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    marginBottom: 8,
  },
  
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberCount: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
  },
  adminOnly: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  
  joinButton: {
    backgroundColor: tokens.colors.accent.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  openButton: {
    backgroundColor: tokens.colors.accent.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  openButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  leaveButton: {
    backgroundColor: tokens.colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
  },
  
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
});
