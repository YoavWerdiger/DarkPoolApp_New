// ============================================
// Chat Group Info Screen
// ============================================
// מסך פרטי קבוצה - חברים, הגדרות, עזיבה
// ============================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatGroupMember } from '../../types/chat.types';

export default function ChatGroupInfoScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup } = useChat();

  const [isMuted, setIsMuted] = useState(currentGroup?.is_muted || false);

  const isAdmin = currentGroup?.is_admin || false;

  // ============================================
  // Handle Actions
  // ============================================

  const handleEditGroup = () => {
    // TODO: navigate to edit group screen
    Alert.alert('ערוך קבוצה', 'מסך עריכת קבוצה יפותח כאן');
  };

  const handleAddMembers = () => {
    // TODO: navigate to add members screen
    Alert.alert('הוסף חברים', 'מסך הוספת חברים יפותח כאן');
  };

  const handleMemberPress = (member: ChatGroupMember) => {
    if (!isAdmin) return;

    const options = [
      { text: 'הצג פרופיל', onPress: () => {} },
    ];

    if (member.role === 'member') {
      options.push({ text: '⭐ הפוך לאדמין', onPress: () => handlePromoteMember(member) });
    } else {
      options.push({ text: '📉 הורד מאדמין', onPress: () => handleDemoteMember(member) });
    }

    if (member.user_id !== user?.id) {
      options.push({
        text: '❌ הסר מהקבוצה',
        style: 'destructive',
        onPress: () => handleRemoveMember(member),
      });
    }

    options.push({ text: 'ביטול', style: 'cancel' });

    Alert.alert('פעולות חבר', '', options);
  };

  const handlePromoteMember = (member: ChatGroupMember) => {
    Alert.alert(
      'הפוך לאדמין',
      `האם להפוך את ${member.user?.display_name} לאדמין?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: () => {
            // TODO: call updateGroupMemberRole service
            Alert.alert('הצלחה', 'החבר הפך לאדמין');
          },
        },
      ]
    );
  };

  const handleDemoteMember = (member: ChatGroupMember) => {
    Alert.alert(
      'הורד מאדמין',
      `האם להוריד את ${member.user?.display_name} מאדמין?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: () => {
            // TODO: call updateGroupMemberRole service
            Alert.alert('הצלחה', 'החבר הורד מאדמין');
          },
        },
      ]
    );
  };

  const handleRemoveMember = (member: ChatGroupMember) => {
    Alert.alert(
      'הסר חבר',
      `האם להסיר את ${member.user?.display_name} מהקבוצה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: () => {
            // TODO: call removeGroupMember service
            Alert.alert('הצלחה', 'החבר הוסר מהקבוצה');
          },
        },
      ]
    );
  };

  const handleToggleMute = async (value: boolean) => {
    setIsMuted(value);
    // TODO: call updateGroupMemberSettings service
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'עזוב קבוצה',
      'האם אתה בטוח שברצונך לעזוב את הקבוצה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'עזוב',
          style: 'destructive',
          onPress: async () => {
            const { success } = await leaveGroup(groupId);
            if (success) {
              navigation.goBack();
            } else {
              Alert.alert('שגיאה', 'לא הצלחנו לעזוב את הקבוצה');
            }
          },
        },
      ]
    );
  };

  const handleMediaGallery = () => {
    // TODO: navigate to media gallery
    Alert.alert('גלריה', 'מסך הגלריה יפותח כאן');
  };

  // ============================================
  // Render
  // ============================================

  if (!currentGroup) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>לא נמצאה קבוצה</Text>
      </View>
    );
  }

  // Sort members: admins first
  const sortedMembers = [...currentGroup.members].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  return (
    <ScrollView style={styles.container}>
      {/* Group Header */}
      <View style={styles.headerSection}>
        {currentGroup.avatar_url ? (
          <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{currentGroup.name.charAt(0)}</Text>
          </View>
        )}
        <Text style={styles.groupName}>{currentGroup.name}</Text>
        {currentGroup.description && (
          <Text style={styles.groupDescription}>{currentGroup.description}</Text>
        )}
        
        {isAdmin && (
          <TouchableOpacity onPress={handleEditGroup} style={styles.editButton}>
            <Text style={styles.editButtonText}>✏️ ערוך קבוצה</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הגדרות</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>השתק התראות</Text>
          <Switch
            value={isMuted}
            onValueChange={handleToggleMute}
            trackColor={{
              false: DesignTokens.colors.background.secondary,
              true: DesignTokens.colors.accent.primary,
            }}
          />
        </View>

        <TouchableOpacity style={styles.settingRow} onPress={handleMediaGallery}>
          <Text style={styles.settingLabel}>📷 גלריה משותפת</Text>
          <Text style={styles.settingValue}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Members */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            חברים ({currentGroup.members_count})
          </Text>
          {isAdmin && (
            <TouchableOpacity onPress={handleAddMembers}>
              <Text style={styles.addMemberButton}>➕ הוסף</Text>
            </TouchableOpacity>
          )}
        </View>

        {sortedMembers.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberRow}
            onPress={() => handleMemberPress(member)}
            disabled={!isAdmin}
          >
            {member.user?.profile_picture ? (
              <Image
                source={{ uri: member.user.profile_picture }}
                style={styles.memberAvatar}
              />
            ) : (
              <View style={styles.memberAvatarPlaceholder}>
                <Text style={styles.memberAvatarText}>
                  {member.user?.display_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {member.user?.display_name || 'משתמש'}
              </Text>
              {member.user?.is_online ? (
                <Text style={styles.memberOnline}>🟢 מחובר</Text>
              ) : (
                <Text style={styles.memberOffline}>אופליין</Text>
              )}
            </View>

            {member.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>אדמין</Text>
              </View>
            )}

            {member.user_id === user?.id && (
              <Text style={styles.youLabel}>(אתה)</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <TouchableOpacity onPress={handleLeaveGroup} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>🚪 עזוב קבוצה</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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

  headerSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: tokens.colors.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 12,
  },
  addMemberButton: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.accent.primary,
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  settingLabel: {
    fontSize: 16,
    color: tokens.colors.text.primary,
  },
  settingValue: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  memberOnline: {
    fontSize: 13,
    color: '#34C759',
  },
  memberOffline: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
  },
  adminBadge: {
    backgroundColor: tokens.colors.accent.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.accent.primary,
  },
  youLabel: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
    marginLeft: 8,
  },

  dangerButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  errorText: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginTop: 32,
  },
});

