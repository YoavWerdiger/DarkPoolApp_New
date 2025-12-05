// ============================================
// Chat Group Info Screen - RTL + DesignTokens
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatGroupMember } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';

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

  const handleBack = () => {
    navigation.goBack();
  };

  const handleEditGroup = () => {
    Alert.alert('ערוך קבוצה', 'מסך עריכת קבוצה יפותח כאן');
  };

  const handleAddMembers = () => {
    Alert.alert('הוסף חברים', 'מסך הוספת חברים יפותח כאן');
  };

  const handleMemberPress = (member: ChatGroupMember) => {
    if (!isAdmin) return;

    const options: any[] = [
      { text: 'הצג פרופיל', onPress: () => {} },
    ];

    if (member.role === 'member') {
      options.push({ text: 'הפוך לאדמין', icon: 'star-outline', onPress: () => handlePromoteMember(member) });
    } else {
      options.push({ text: 'הורד מאדמין', icon: 'star', onPress: () => handleDemoteMember(member) });
    }

    if (member.user_id !== user?.id) {
      options.push({
        text: 'הסר מהקבוצה',
        style: 'destructive',
        icon: 'trash-outline',
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
            Alert.alert('הצלחה', 'החבר הוסר מהקבוצה');
          },
        },
      ]
    );
  };

  const handleToggleMute = async (value: boolean) => {
    setIsMuted(value);
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
    Alert.alert('גלריה', 'מסך הגלריה יפותח כאן');
  };

  // ============================================
  // Render
  // ============================================

  if (!currentGroup) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-forward" size={24} color={DesignTokens.colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>פרטי קבוצה</Text>
            <View style={styles.headerSpacer} />
          </View>
          <Text style={styles.errorText}>לא נמצאה קבוצה</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Sort members: admins first
  const sortedMembers = [...(currentGroup.members || [])].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-forward" size={24} color={DesignTokens.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>פרטי קבוצה</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Group Header */}
          <View style={styles.headerSection}>
            {currentGroup.avatar_url ? (
              <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="people" size={40} color={DesignTokens.colors.text.secondary} />
              </View>
            )}
            <Text style={styles.groupName}>{currentGroup.name}</Text>
            {currentGroup.description && (
              <Text style={styles.groupDescription}>{currentGroup.description}</Text>
            )}
            
            {isAdmin && (
              <TouchableOpacity onPress={handleEditGroup} style={styles.editButton}>
                <Ionicons name="pencil-outline" size={16} color="#FFFFFF" />
                <Text style={styles.editButtonText}>ערוך קבוצה</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הגדרות</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="notifications-off-outline" size={20} color={DesignTokens.colors.text.primary} />
                <Text style={styles.settingLabel}>השתק התראות</Text>
              </View>
              <Switch
                value={isMuted}
                onValueChange={handleToggleMute}
                trackColor={{
                  false: DesignTokens.colors.background.secondary,
                  true: DesignTokens.colors.accent.main,
                }}
              />
            </View>

            <TouchableOpacity style={styles.settingRow} onPress={handleMediaGallery}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="images-outline" size={20} color={DesignTokens.colors.text.primary} />
                <Text style={styles.settingLabel}>גלריה משותפת</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Members */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                חברים ({currentGroup.members_count || sortedMembers.length})
              </Text>
              {isAdmin && (
                <TouchableOpacity onPress={handleAddMembers} style={styles.addMemberButton}>
                  <Ionicons name="add-circle-outline" size={20} color={DesignTokens.colors.accent.main} />
                  <Text style={styles.addMemberButtonText}>הוסף</Text>
                </TouchableOpacity>
              )}
            </View>

            {sortedMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberRow}
                onPress={() => handleMemberPress(member)}
                disabled={!isAdmin && member.user_id !== user?.id}
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
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>
                      {member.user?.display_name || 'משתמש'}
                    </Text>
                    {member.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Ionicons name="star" size={12} color={DesignTokens.colors.accent.main} />
                        <Text style={styles.adminBadgeText}>אדמין</Text>
                      </View>
                    )}
                    {member.user_id === user?.id && (
                      <Text style={styles.youLabel}>(אתה)</Text>
                    )}
                  </View>
                  {member.user?.is_online ? (
                    <View style={styles.onlineIndicator}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.memberOnline}>מחובר</Text>
                    </View>
                  ) : (
                    <Text style={styles.memberOffline}>אופליין</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <TouchableOpacity onPress={handleLeaveGroup} style={styles.dangerButton}>
              <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
              <Text style={styles.dangerButtonText}>עזוב קבוצה</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  headerSpacer: {
    width: 40,
  },

  scrollView: {
    flex: 1,
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
    backgroundColor: tokens.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.accent.main,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
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
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 12,
    textAlign: 'right',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.accent.main,
  },

  settingRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  settingLabelContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  settingValue: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
  },

  memberRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 12,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.accent.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  onlineIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  memberOnline: {
    fontSize: 13,
    color: '#34C759',
    textAlign: 'right',
  },
  memberOffline: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  adminBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.accent.main + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.accent.main,
  },
  youLabel: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
  },

  dangerButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
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
