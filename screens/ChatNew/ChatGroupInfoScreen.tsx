// ============================================
// Chat Group Info Screen - Modern Design
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Modal, TextInput, KeyboardAvoidingView, Platform, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { ChatGroupMember, ChatMemberRole } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';
import { chatGroupService } from '../../services/chat';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';

export default function ChatGroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup, updateGroup, messages } = useChat();

  const [isMuted, setIsMuted] = useState(currentGroup?.is_muted || false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptCallback, setPromptCallback] = useState<((value: string) => void) | null>(null);

  const showPrompt = (title: string, defaultValue: string, callback: (value: string) => void) => {
    setPromptTitle(title);
    setPromptValue(defaultValue);
    setPromptCallback(() => callback);
    setPromptVisible(true);
  };
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
        id: msg.id,
        url: msg.media_url!,
        thumbnail: msg.media_thumbnail_url || msg.media_url!,
        type: msg.message_type,
      }))
      .slice(0, 9); // Show max 9 items in grid
  }, [messages, groupId]);

  const [gallerySignedThumbs, setGallerySignedThumbs] = useState<Record<string, string>>({});

  const avatarOnlineCornerStyle = useMemo(
    () => ({ ...(I18nManager.isRTL ? { left: 8 } : { right: 8 }) }),
    [],
  );
  const galleryVideoCornerStyle = useMemo(
    () => ({
      top: DesignTokens.spacing.xs,
      ...(I18nManager.isRTL
        ? { left: DesignTokens.spacing.xs }
        : { right: DesignTokens.spacing.xs }),
    }),
    [DesignTokens.spacing.xs],
  );

  /** בשורות הגדרות ממוסגרות ב־RTL האייקון צריך להצביע כמו בשאר האפליקציה */
  const settingsDisclosureIcon = I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of groupMediaItems) {
        const t = await getChatMediaDisplayUri(item.thumbnail);
        next[item.id] = t || item.thumbnail;
      }
      if (!cancelled) setGallerySignedThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupMediaItems]);

  const isAdmin = currentGroup?.is_admin || false;

  // ============================================
  // Handle Actions
  // ============================================

  const handleBack = () => {
    navigation.goBack();
  };

  const handleEditGroup = () => {
    if (!currentGroup) return;
    showPrompt('ערוך תיאור קבוצה', currentGroup.description || '', async (newDesc) => {
      if (!newDesc.trim()) return;
      const { success, error } = await updateGroup(groupId, { description: newDesc.trim() });
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן לעדכן את הקבוצה');
      }
    });
  };

  const handleAddMembers = () => {
    showPrompt('הוסף חבר', '', async (inputUserId) => {
      if (!inputUserId?.trim() || !user?.id) return;
      const { error } = await chatGroupService.addGroupMember(groupId, inputUserId.trim(), user.id);
      if (error) {
        legacyAlert('שגיאה', error.message || 'לא ניתן להוסיף את המשתמש');
      } else {
        legacyAlert('הצלחה', 'המשתמש נוסף לקבוצה');
      }
    });
  };

  const handleMemberPress = (member: ChatGroupMember) => {
    if (!isAdmin) return;

    const options: any[] = [
      { text: 'הצג פרופיל', onPress: () => { (navigation as any).navigate('Profile', { screen: 'ProfileMain', params: { userId: member.user_id } }); } },
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

    legacyAlert('פעולות חבר', '', options);
  };

  const handlePromoteMember = (member: ChatGroupMember) => {
    legacyAlert(
      'הפוך לאדמין',
      `האם להפוך את ${member.user?.display_name} לאדמין?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            if (!user?.id) return;
            const { error } = await chatGroupService.updateGroupMemberRole(groupId, member.user_id, ChatMemberRole.ADMIN, user.id);
            if (error) {
              legacyAlert('שגיאה', 'לא ניתן לקדם את החבר');
            }
          },
        },
      ]
    );
  };

  const handleDemoteMember = (member: ChatGroupMember) => {
    legacyAlert(
      'הורד מאדמין',
      `האם להוריד את ${member.user?.display_name} מאדמין?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          onPress: async () => {
            if (!user?.id) return;
            const { error } = await chatGroupService.updateGroupMemberRole(groupId, member.user_id, ChatMemberRole.MEMBER, user.id);
            if (error) {
              legacyAlert('שגיאה', 'לא ניתן להוריד את החבר מאדמין');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (member: ChatGroupMember) => {
    legacyAlert(
      'הסר חבר',
      `האם להסיר את ${member.user?.display_name} מהקבוצה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            const { error } = await chatGroupService.removeGroupMember(groupId, member.user_id, user.id);
            if (error) {
              legacyAlert('שגיאה', 'לא ניתן להסיר את החבר מהקבוצה');
            }
          },
        },
      ]
    );
  };

  const handleToggleMute = async (value: boolean) => {
    setIsMuted(value);
    if (!user?.id) return;
    const { success } = await chatGroupService.toggleGroupMute(groupId, user.id, value);
    if (!success) {
      setIsMuted(!value);
      legacyAlert('שגיאה', 'לא ניתן לשנות את הגדרות ההשתקה');
    }
  };

  const handlePinnedMessages = () => {
    (navigation as any).navigate('ChatGroupPinnedMessages', { groupId });
  };

  const handleSearchMessages = () => {
    setSearchVisible(true);
  };

  const handleSavedMedia = () => {
    (navigation as any).navigate('SavedMedia', { groupId });
  };

  const handleGroupSettings = () => {
    if (!isAdmin || !currentGroup) return;
    showPrompt('שנה שם קבוצה', currentGroup.name || '', async (newName) => {
      if (!newName?.trim()) return;
      const { success, error } = await updateGroup(groupId, { name: newName.trim() });
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן לעדכן את הקבוצה');
      }
    });
  };

  const handlePrivacyAndSupport = () => {
    (navigation as any).navigate('PrivacySupport');
  };

  const handleJumpToMessage = (messageId: string) => {
    (navigation as any).navigate('ChatGroup', { groupId, scrollToMessageId: messageId });
  };

  const handleLeaveGroup = () => {
    legacyAlert(
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
                legacyAlert('שגיאה', result.error || 'לא הצלחנו לעזוב את הקבוצה');
              }
            } catch (error) {
              legacyAlert('שגיאה', 'אירעה שגיאה בעת עזיבת הקבוצה');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // Render
  // ============================================

  if (!groupId) {
    navigation.goBack();
    return null;
  }

  if (!currentGroup) {
    return (
      <ChatScreenShell>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            <ChatSubScreenHeader title="פרטי קבוצה" onBack={handleBack} />
            <Text style={styles.errorText}>לא נמצאה קבוצה</Text>
          </View>
        </SafeAreaView>
      </ChatScreenShell>
    );
  }

  // Sort members: admins first
  const sortedMembers = [...(currentGroup.members || [])].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return 0;
  });

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <ChatSubScreenHeader title="פרטי קבוצה" onBack={handleBack} />

          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg, paddingBottom: DesignTokens.spacing['3xl'], direction: 'rtl' }}
          >
          {/* Profile Header - UICard blur כמו בפרופיל */}
          <UICard variant="surface" padding="lg" style={[styles.sectionCard, { marginBottom: DesignTokens.spacing.lg }]}>
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
                <View style={[styles.onlineIndicator, avatarOnlineCornerStyle]} />
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
            <UICard variant="surface" padding="lg" style={[styles.sectionCard, { marginBottom: DesignTokens.spacing.lg }]}>
              <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>תיאור הקבוצה</Text>
              <Text style={styles.aboutText}>{currentGroup.description}</Text>
            </UICard>
          )}

          {/* גלריית המדיה - UICard blur */}
          <UICard variant="surface" padding="lg" style={[styles.sectionCard, { marginBottom: DesignTokens.spacing.lg }]}>
            <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>גלריית הקבוצה</Text>
            {groupMediaItems.length > 0 ? (
              <View style={styles.mediaGrid}>
                {groupMediaItems.map((item, index) => (
                  <TouchableOpacity key={item.id} style={styles.mediaItem}>
                    <Image source={{ uri: gallerySignedThumbs[item.id] || item.thumbnail }} style={styles.mediaImage} />
                    {item.type === 'video' && (
                      <View style={[styles.videoBadge, galleryVideoCornerStyle]}>
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
          <UICard variant="surface" padding="lg" style={[styles.sectionCard, { marginBottom: DesignTokens.spacing.lg }]}>
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>השתק התראות</Text>
              </View>
              <Switch
                value={isMuted}
                onValueChange={handleToggleMute}
                trackColor={{ false: DesignTokens.colors.background.tertiary, true: DesignTokens.colors.primary.main }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handlePinnedMessages}>
              <View style={styles.settingLeft}>
                <Ionicons name="pin-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>הודעות מוצמדות</Text>
              </View>
              <Ionicons name={settingsDisclosureIcon} size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handleSearchMessages}>
              <View style={styles.settingLeft}>
                <Ionicons name="search-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>חפש בהודעות</Text>
              </View>
              <Ionicons name={settingsDisclosureIcon} size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handleSavedMedia}>
              <View style={styles.settingLeft}>
                <Ionicons name="folder-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>שמירת מדיה</Text>
              </View>
              <Ionicons name={settingsDisclosureIcon} size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            {isAdmin && (
              <>
                <View style={styles.separator} />
                <TouchableOpacity style={styles.settingRow} onPress={handleGroupSettings}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="settings-outline" size={20} color={DesignTokens.colors.text.secondary} />
                    <Text style={styles.settingText}>הגדרות קבוצה</Text>
                  </View>
                  <Ionicons name={settingsDisclosureIcon} size={18} color={DesignTokens.colors.text.tertiary} />
                </TouchableOpacity>
              </>
            )}
            <View style={styles.separator} />
            <TouchableOpacity style={styles.settingRow} onPress={handlePrivacyAndSupport}>
              <View style={styles.settingLeft}>
                <Ionicons name="shield-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.settingText}>פרטיות ותמיכה</Text>
              </View>
              <Ionicons name={settingsDisclosureIcon} size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* Members - UICard blur */}
          <UICard variant="surface" padding="lg" style={[styles.sectionCard, { marginBottom: DesignTokens.spacing.lg }]}>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionLabel, styles.sectionLabelInHeader]}
                numberOfLines={1}
              >
                חברים ({currentGroup.members_count || sortedMembers.length})
              </Text>
              {isAdmin ? (
                <TouchableOpacity onPress={handleAddMembers} style={styles.addButton} hitSlop={8}>
                  <Ionicons name="add" size={18} color={DesignTokens.colors.primary.main} />
                  <Text style={styles.addButtonText}>הוסף</Text>
                </TouchableOpacity>
              ) : null}
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

          {/* עזיבת קבוצה - UICard blur */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLeaveGroup}
            style={{
              marginTop: DesignTokens.spacing.lg,
              marginBottom: DesignTokens.spacing.lg,
              marginHorizontal: DesignTokens.spacing.lg,
            }}
          >
            <UICard
              variant="surface"
              padding="md"
              style={{
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: `${DesignTokens.colors.danger.main}40`,
              }}
            >
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.base,
                fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                color: DesignTokens.colors.danger.main,
              }}>
                עזוב קבוצה
              </Text>
            </UICard>
          </TouchableOpacity>
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

      {/* Cross-platform prompt modal */}
      <Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => setPromptVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.promptOverlay}>
          <View style={styles.promptContainer}>
            <Text style={styles.promptTitle}>{promptTitle}</Text>
            <TextInput
              style={styles.promptInput}
              value={promptValue}
              onChangeText={setPromptValue}
              autoFocus
              placeholderTextColor="rgba(148,163,184,0.6)"
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setPromptVisible(false)} style={styles.promptBtn}>
                <Text style={styles.promptBtnCancel}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPromptVisible(false);
                  promptCallback?.(promptValue);
                }}
                style={[styles.promptBtn, styles.promptBtnConfirmBg]}
              >
                <Text style={styles.promptBtnConfirm}>אישור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ChatScreenShell>
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
    direction: 'rtl',
  },

  scrollView: {
    flex: 1,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Profile Header Content
  profileHeaderContent: {
    alignItems: 'stretch',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: DesignTokens.spacing.md,
    alignSelf: 'center',
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
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  groupStatus: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  infoItem: {
    flexDirection: 'row',
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
    textAlign: 'left',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: DesignTokens.borderRadius.sm,
    padding: 4,
  },
  emptyMediaText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'left',
    marginTop: DesignTokens.spacing.sm,
    fontStyle: 'italic',
    writingDirection: 'rtl',
  },
  leaveButton: {
    flexDirection: 'row',
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

  // Sections — כותרות מיושרות לשמאל (הצד השני)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.spacing.md,
    width: '100%',
  },
  sectionLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.secondary,
    textAlign: 'left',
    marginBottom: DesignTokens.spacing.md,
    writingDirection: 'rtl',
  },
  /** כותרת מלאה ברוחב הכרטיס (תיאור / גלריה) */
  sectionLabelStandalone: {
    alignSelf: 'stretch',
  },
  sectionLabelInHeader: {
    flex: 1,
    marginBottom: 0,
    textAlign: 'left',
  },
  aboutText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.primary,
    textAlign: 'left',
    lineHeight: 22,
    writingDirection: 'rtl',
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  settingText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.primary,
    textAlign: 'left',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: DesignTokens.spacing.xs,
  },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginEnd: DesignTokens.spacing.md,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DesignTokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: DesignTokens.spacing.md,
  },
  memberAvatarText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.bold as any,
    color: DesignTokens.colors.text.primary,
  },
  memberInfo: {
    flex: 1,
    alignItems: 'stretch',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
  },
  memberName: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.primary,
    textAlign: 'left',
  },
  adminBadge: {
    flexDirection: 'row',
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
    textAlign: 'left',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.xs,
    alignSelf: 'flex-start',
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
    textAlign: 'left',
  },
  offlineText: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'left',
  },
  addButton: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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

  promptOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  promptContainer: {
    width: '85%',
    backgroundColor: DesignTokens.colors.background.tertiary,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: DesignTokens.colors.border.main,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: DesignTokens.colors.text.primary,
    textAlign: 'left',
    marginBottom: 16,
  },
  promptInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    color: DesignTokens.colors.text.primary,
    fontSize: 15,
    textAlign: 'left',
    borderWidth: 1,
    borderColor: DesignTokens.colors.border.main,
  },
  promptButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginTop: 20,
  },
  promptBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  promptBtnCancel: {
    color: DesignTokens.colors.text.secondary,
    fontSize: 15,
  },
  promptBtnConfirmBg: {
    backgroundColor: DesignTokens.colors.primary.main,
  },
  promptBtnConfirm: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
