// ============================================
// Chat Groups List Screen - קבוצות זמינות
// ============================================
// מסך רשימת קבוצות קבועות - המשתמש בוחר להצטרף
// ============================================

import React, { useMemo, useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ChatGroup } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';

interface GroupWithMembership extends ChatGroup {
  is_member: boolean;
  my_membership_id?: string;
}

// מיפוי אייקונים לקבוצות
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

const GROUP_COLORS: { [key: string]: string } = {
  'הכרזות': '#FF9500',
  'דיונים - כללי': '#007AFF',
  'נטו ניתוחים!': '#34C759',
  'דיוני - פניסטוקס': '#5856D6',
  'שאלות ותשובות בשוק': '#FF2D55',
  'עסקאות מסחר יומי': '#FF3B30',
  'חדשות מתפרצות': '#FF9500',
  'סווינגים וסטאפים': '#30B0C7',
  'מסחר פניסטוקס - סיכון גבוה': '#FF3B30',
};

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
        group.name,
        `כדי לצפות בקבוצה יש להצטרף תחילה`,
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
    const iconColor = GROUP_COLORS[item.name] || DesignTokens.colors.accent.primary;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
      >
        {/* אייקון */}
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName} size={28} color={iconColor} />
        </View>

        {/* מידע */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
        </View>

        {/* כפתור */}
        {item.is_member ? (
          <TouchableOpacity
            style={[styles.statusButton, styles.memberButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleLeaveGroup(item);
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={DesignTokens.colors.accent.primary} />
            <Text style={styles.memberButtonText}>חבר</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.statusButton, styles.joinButton]}
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

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>קבוצות הקהילה</Text>
      <Text style={styles.headerSubtitle}>
        {allGroups.filter(g => g.is_member).length} מתוך {allGroups.length} קבוצות
      </Text>
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
        <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.secondary} />
        <Text style={styles.emptyTitle}>אין קבוצות זמינות</Text>
        <Text style={styles.emptyText}>הקבוצות יווספו בקרוב</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FlatList
        data={allGroups}
        renderItem={renderGroup}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadGroups}
            tintColor={DesignTokens.colors.accent.primary}
          />
        }
        contentContainerStyle={allGroups.length === 0 && styles.emptyListContent}
      />
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: tokens.colors.background.primary,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
    fontWeight: '500',
  },
  
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  
  groupInfo: {
    flex: 1,
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
  },
  
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  
  joinButton: {
    backgroundColor: tokens.colors.background.secondary,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
  },
  
  memberButton: {
    backgroundColor: tokens.colors.accent.primary + '20',
  },
  memberButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.accent.primary,
  },
  
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
});
