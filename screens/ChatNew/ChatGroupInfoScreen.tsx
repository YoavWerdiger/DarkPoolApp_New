// ============================================
// Chat Group Info Screen - Modern Design
// ============================================

import React, { useState, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatGroupMember } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';

// ============================================
// Design Colors (from reference design)
// ============================================
const COLORS = {
  background: {
    primary: 'transparent',
    secondary: 'rgba(6, 18, 12, 0.85)',
    tertiary: 'rgba(10, 24, 16, 0.9)',
    hover: 'rgba(20, 32, 26, 0.9)',
  },
  border: 'rgba(255, 255, 255, 0.08)',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(209, 213, 219, 0.9)',
    tertiary: 'rgba(148, 163, 184, 0.9)',
  },
  accent: '#0FB96E',
  success: '#22C55E', // green-500
  warning: '#EAB308', // yellow-500
  danger: '#EF4444', // red-500
};

export default function ChatGroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup, messages } = useChat();

  const [isMuted, setIsMuted] = useState(currentGroup?.is_muted || false);
  const [searchVisible, setSearchVisible] = useState(false);
  
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
  // Extract media from group messages
  const groupMediaItems = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    
    return messages
      .filter(msg => 
        msg.group_id === groupId && 
        msg.media_url && 
        (msg.message_type === 'image' || msg.message_type === 'video')
      )
      .map(msg => ({
        url: msg.media_url!,
        thumbnail: msg.media_thumbnail_url || msg.media_url!,
        type: msg.message_type,
      }))
      .slice(0, 9); // Show max 9 items in grid
  }, [messages, groupId]);

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
      options.push({ text: 'הפוך לאדמין', onPress: () => handlePromoteMember(member) });
    } else {
      options.push({ text: 'הורד מאדמין', onPress: () => handleDemoteMember(member) });
    }

    if (member.user_id !== user?.id) {
      options.push({
        text: 'הסר מהקבוצה',
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
        { text: 'אישור', onPress: () => Alert.alert('הצלחה', 'החבר הפך לאדמין') },
      ]
    );
  };

  const handleDemoteMember = (member: ChatGroupMember) => {
    Alert.alert(
      'הורד מאדמין',
      `האם להוריד את ${member.user?.display_name} מאדמין?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'אישור', onPress: () => Alert.alert('הצלחה', 'החבר הורד מאדמין') },
      ]
    );
  };

  const handleRemoveMember = (member: ChatGroupMember) => {
    Alert.alert(
      'הסר חבר',
      `האם להסיר את ${member.user?.display_name} מהקבוצה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'הסר', style: 'destructive', onPress: () => Alert.alert('הצלחה', 'החבר הוסר מהקבוצה') },
      ]
    );
  };

  const handleToggleMute = async (value: boolean) => {
    setIsMuted(value);
    // TODO: Implement mute/unmute API call
  };

  const handlePinnedMessages = () => {
    // TODO: Navigate to pinned messages screen
    Alert.alert('הודעות מוצמדות', 'מסך הודעות מוצמדות יפותח כאן');
  };

  const handleSearchMessages = () => {
    setSearchVisible(true);
  };

  const handleSavedMedia = () => {
    (navigation as any).navigate('SavedMedia', { groupId });
  };

  const handleGroupSettings = () => {
    if (!isAdmin) return;
    // TODO: Navigate to group settings screen
    Alert.alert('הגדרות קבוצה', 'מסך הגדרות קבוצה יפותח כאן');
  };

  const handlePrivacyAndSupport = () => {
    (navigation as any).navigate('PrivacySupport');
  };

  const handleJumpToMessage = (messageId: string) => {
    // Navigate back to chat and jump to message
    navigation.goBack();
    // The message jump will be handled by ChatGroupScreen when it receives focus
    // TODO: Pass messageId via navigation params
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
            try {
              const result = await leaveGroup(groupId);
              if (result.success) {
                // Go back to previous screen (Chat screen), which should automatically handle navigation
                // The ChatContext will clear the group, causing navigation to go back to groups list
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              } else {
                Alert.alert('שגיאה', result.error || 'לא הצלחנו לעזוב את הקבוצה');
              }
            } catch (error) {
              console.error('❌ Error leaving group:', error);
              Alert.alert('שגיאה', 'אירעה שגיאה בעת עזיבת הקבוצה');
            }
          },
        },
      ]
    );
  };


  // ============================================
  // Render
  // ============================================

  if (!currentGroup) {
    return (
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-forward" size={22} color={COLORS.text.secondary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>פרטי קבוצה</Text>
            </View>
            <Text style={styles.errorText}>לא נמצאה קבוצה</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Sort members: admins first
  const sortedMembers = [...(currentGroup.members || [])].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Header - UICard blur, צמוד למעלה עם פינות תחתונות מעוגלות */}
          <UICard
            variant="blur"
            padding="md"
            style={{
              marginHorizontal: 0,
              marginTop: 0,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: DesignTokens.borderRadius['2xl'],
              borderBottomRightRadius: DesignTokens.borderRadius['2xl'],
            }}
          >
            <View style={styles.header}>
              {/* כפתור חזור (ימין) */}
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-forward" size={22} color={COLORS.text.secondary} />
              </TouchableOpacity>

              {/* כותרת */}
              <Text style={styles.headerTitle}>פרטי קבוצה</Text>

              {/* רווח/placeholder לשמירת יישור */}
              <View style={{ width: 32 }} />
            </View>
          </UICard>

          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg, paddingBottom: DesignTokens.spacing['3xl'] }}
          >
          {/* Profile Header - UICard blur כמו בפרופיל */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <View style={styles.profileHeaderContent}>
              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {currentGroup.avatar_url ? (
                  <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="people" size={48} color={DesignTokens.colors.text.secondary} />
                  </View>
                )}
                {/* Online indicator - for groups, show if there are online members */}
                <View style={styles.onlineIndicator} />
              </View>

              {/* Name & Status */}
              <Text style={styles.groupName}>{currentGroup.name}</Text>
              <Text style={styles.groupStatus}>
                {currentGroup.members_count} חברים
              </Text>
            </View>
          </UICard>

          {/* תיאור הקבוצה - UICard blur */}
          {currentGroup.description && (
            <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
              <Text style={styles.sectionLabel}>תיאור הקבוצה</Text>
              <Text style={styles.aboutText}>{currentGroup.description}</Text>
            </UICard>
          )}

          {/* גלריית המדיה - UICard blur */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionLabel}>גלריית הקבוצה</Text>
            {groupMediaItems.length > 0 ? (
              <View style={styles.mediaGrid}>
                {groupMediaItems.map((item, index) => (
                  <TouchableOpacity key={index} style={styles.mediaItem}>
                    <Image source={{ uri: item.thumbnail }} style={styles.mediaImage} />
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyMediaText}>אין מדיה בקבוצה זו</Text>
            )}
          </UICard>

          {/* הגדרות - UICard blur */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>השתק התראות</Text>
              </View>
              <Switch
                value={isMuted}
                onValueChange={handleToggleMute}
                trackColor={{ false: COLORS.background.tertiary, true: DesignTokens.colors.primary.main }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handlePinnedMessages}>
              <View style={styles.settingLeft}>
                <Ionicons name="pin-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>הודעות מוצמדות</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handleSearchMessages}>
              <View style={styles.settingLeft}>
                <Ionicons name="search-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>חפש בהודעות</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handleSavedMedia}>
              <View style={styles.settingLeft}>
                <Ionicons name="folder-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>שמירת מדיה</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            {isAdmin && (
              <>
                <View style={styles.separator} />
                <TouchableOpacity style={styles.settingRow} onPress={handleGroupSettings}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="settings-outline" size={20} color={DesignTokens.colors.text.secondary} />
                    <Text style={styles.settingText}>הגדרות קבוצה</Text>
                  </View>
                  <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
                </TouchableOpacity>
              </>
            )}
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handlePrivacyAndSupport}>
              <View style={styles.settingLeft}>
                <Ionicons name="shield-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>פרטיות ותמיכה</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* Members - UICard blur */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                חברים ({currentGroup.members_count || sortedMembers.length})
              </Text>
              {isAdmin && (
                <TouchableOpacity onPress={handleAddMembers} style={styles.addButton}>
                  <Ionicons name="add" size={18} color={DesignTokens.colors.primary.main} />
                  <Text style={styles.addButtonText}>הוסף</Text>
                </TouchableOpacity>
              )}
            </View>

            {sortedMembers.map((member, index) => (
              <React.Fragment key={member.id}>
                <TouchableOpacity
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
                          <Ionicons name="star" size={10} color={DesignTokens.colors.warning.main} />
                          <Text style={styles.adminBadgeText}>אדמין</Text>
                        </View>
                      )}
                      {member.user_id === user?.id && (
                        <Text style={styles.youLabel}>(אתה)</Text>
                      )}
                    </View>
                    {member.user?.is_online ? (
                      <View style={styles.onlineStatus}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>מחובר</Text>
                      </View>
                    ) : (
                      <Text style={styles.offlineText}>אופליין</Text>
                    )}
                  </View>
                </TouchableOpacity>
                {index < sortedMembers.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </UICard>

          {/* עזיבת קבוצה - UICard blur, קטן וממורכז */}
          <View style={{ alignItems: 'center', marginBottom: DesignTokens.spacing.lg }}>
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
              <Ionicons name="exit-outline" size={18} color={DesignTokens.colors.danger.main} />
              <Text style={styles.leaveButtonText}>עזוב קבוצה</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Chat Search Bottom Sheet */}
      <ChatSearchBottomSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        groupId={groupId}
        onMessagePress={handleJumpToMessage}
      />
    </LinearGradient>
  );
}

// ============================================
// Styles - Exact Design from Reference
// ============================================

const createStyles = (DesignTokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
  },

  // Header
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 50,
  },
  headerTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
    color: DesignTokens.colors.text.primary,
    textAlign: 'center',
  },

  scrollView: {
    flex: 1,
  },

  // Profile Header Content
  profileHeaderContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: DesignTokens.spacing.md,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  avatarPlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: DesignTokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DesignTokens.colors.success.main,
    borderWidth: 4,
    borderColor: DesignTokens.colors.background.secondary,
  },
  groupName: {
    fontSize: DesignTokens.typography.fontSize['2xl'],
    fontWeight: DesignTokens.typography.fontWeight.bold as any,
    color: DesignTokens.colors.text.primary,
    marginBottom: DesignTokens.spacing.xs,
    textAlign: 'center',
  },
  groupStatus: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.sm,
  },
  infoContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.text.tertiary,
    marginBottom: DesignTokens.spacing.xs / 2,
  },
  infoValue: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.xs,
    marginTop: DesignTokens.spacing.md,
  },
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: DesignTokens.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: DesignTokens.spacing.xs,
    right: DesignTokens.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: DesignTokens.borderRadius.sm,
    padding: 4,
  },
  emptyMediaText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'center',
    marginTop: DesignTokens.spacing.md,
    fontStyle: 'italic',
  },
  leaveButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.xs,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.sm,
    borderRadius: DesignTokens.borderRadius.md,
    borderWidth: 1,
    borderColor: DesignTokens.colors.danger.main + '40',
    backgroundColor: DesignTokens.colors.danger.main + '10',
  },
  leaveButtonText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.danger.main,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.md,
  },
  sectionLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'right',
    marginBottom: DesignTokens.spacing.md,
  },
  aboutText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 22,
  },

  // Settings
  settingRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  settingLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  settingText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.primary,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: DesignTokens.spacing.xs,
  },

  // Members
  memberRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: DesignTokens.spacing.md,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DesignTokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: DesignTokens.spacing.md,
  },
  memberAvatarText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.bold as any,
    color: DesignTokens.colors.text.primary,
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
  },
  memberName: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.primary,
  },
  adminBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.warning.main + '20',
    paddingHorizontal: DesignTokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: DesignTokens.borderRadius.md,
    gap: DesignTokens.spacing.xs,
  },
  adminBadgeText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
    color: DesignTokens.colors.warning.main,
  },
  youLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
  },
  onlineStatus: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.xs,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DesignTokens.colors.success.main,
  },
  onlineText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.success.main,
  },
  offlineText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
  },
  addButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.xs,
  },
  addButtonText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
    color: DesignTokens.colors.primary.main,
  },

  // Danger Zone
  dangerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.md,
  },
  dangerText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.danger.main,
  },

  errorText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'center',
    marginTop: DesignTokens.spacing.xl,
  },
});
