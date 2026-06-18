// ============================================
// Chat Group Info Screen - Modern Design
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { ChatGroupMember, ChatMemberRole } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';
import { chatGroupService } from '../../services/chat';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatRtlRoot, chatRtlRow, chatRtlText } from '../../components/chat/chatDesignTokens';

export default function ChatGroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup, updateGroup, messages, refreshCurrentGroupDetails } = useChat();

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

  const galleryVideoCornerStyle = useMemo(
    () => ({
      top: DesignTokens.spacing.xs,
      right: DesignTokens.spacing.xs,
    }),
    [DesignTokens.spacing.xs],
  );

  /** בתוך עץ RTL — chevron-back בקצה השמאלי (סוף השורה) */
  const settingsDisclosureIcon = 'chevron-back' as const;

  useFocusEffect(
    useCallback(() => {
      void refreshCurrentGroupDetails();
    }, [refreshCurrentGroupDetails])
  );

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
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const renderSectionCaption = (label: string, inline = false) => (
    <View style={inline ? styles.membersCaptionWrap : styles.sectionCaptionWrap}>
      <Text style={[styles.sectionCaption, inline && styles.sectionCaptionInline]}>{label}</Text>
    </View>
  );

  const renderSettingIcon = (name: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.settingIconWrap}>
      <Ionicons name={name} size={20} color={DesignTokens.colors.primary.main} />
    </View>
  );

  const handleAddMembers = () => {
    showPrompt('הוסף חבר', '', async (inputUserId) => {
      if (!inputUserId?.trim() || !user?.id) return;
      const { error } = await chatGroupService.addGroupMember(groupId, inputUserId.trim(), user.id);
      if (error) {
        legacyAlert('שגיאה', error.message || 'לא ניתן להוסיף את המשתמש');
      } else {
        legacyAlert('הצלחה', 'המשתמש נוסף לקבוצה');
        void refreshCurrentGroupDetails();
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
                (navigation as any).popToTop
                  ? (navigation as any).popToTop()
                  : (navigation as any).navigate('ChatGroupsList');
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
          <ChatSubScreenHeader title="פרטי קבוצה" onBack={handleBack} />
          <View style={styles.errorStateBody}>
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
        <ChatSubScreenHeader title="פרטי קבוצה" onBack={handleBack} />

        <View style={styles.rtlRoot}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
          <UICard variant="glass" glassIntensity="light" padding="lg" style={[styles.sectionCard, styles.sectionBlock]}>
            <View style={styles.heroBlock}>
              <View style={styles.avatarContainer}>
                {currentGroup.avatar_url ? (
                  <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="people" size={48} color={DesignTokens.colors.text.secondary} />
                  </View>
                )}
              </View>
              <Text style={styles.groupName} numberOfLines={2}>
                {currentGroup.name}
              </Text>
              <Text style={styles.groupStatus}>{sortedMembers.length} חברים</Text>
            </View>
          </UICard>

          {currentGroup.description ? (
            <View style={styles.sectionBlock}>
              {renderSectionCaption('תיאור')}
              <UICard variant="glass" glassIntensity="light" padding="lg" style={styles.sectionCard}>
                <Text style={styles.aboutText}>{currentGroup.description}</Text>
              </UICard>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            {renderSectionCaption('גלריה')}
            <UICard variant="glass" glassIntensity="light" padding="lg" style={styles.sectionCard}>
              {groupMediaItems.length > 0 ? (
                <View style={styles.mediaGrid}>
                  {groupMediaItems.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.mediaItem} activeOpacity={0.85}>
                      <Image
                        source={{ uri: gallerySignedThumbs[item.id] || item.thumbnail }}
                        style={styles.mediaImage}
                      />
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
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionCaption('הגדרות')}
            <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
              <View style={styles.settingRow}>
                {renderSettingIcon('notifications-outline')}
                <Text style={styles.settingText}>השתק התראות</Text>
                <Switch
                  value={isMuted}
                  onValueChange={handleToggleMute}
                  trackColor={{
                    false: DesignTokens.colors.background.tertiary,
                    true: DesignTokens.colors.primary.main,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => { void HapticFeedback.selection(); handlePinnedMessages(); }}
                activeOpacity={0.7}
              >
                {renderSettingIcon('pin-outline')}
                <Text style={styles.settingText}>הודעות מוצמדות</Text>
                <Ionicons name={settingsDisclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => { void HapticFeedback.selection(); handleSearchMessages(); }}
                activeOpacity={0.7}
              >
                {renderSettingIcon('search-outline')}
                <Text style={styles.settingText}>חפש בהודעות</Text>
                <Ionicons name={settingsDisclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => { void HapticFeedback.selection(); handleSavedMedia(); }}
                activeOpacity={0.7}
              >
                {renderSettingIcon('folder-outline')}
                <Text style={styles.settingText}>שמירת מדיה</Text>
                <Ionicons name={settingsDisclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
              {isAdmin && (
                <>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => { void HapticFeedback.selection(); handleGroupSettings(); }}
                    activeOpacity={0.7}
                  >
                    {renderSettingIcon('settings-outline')}
                    <Text style={styles.settingText}>הגדרות קבוצה</Text>
                    <Ionicons name={settingsDisclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                </>
              )}
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => { void HapticFeedback.selection(); handlePrivacyAndSupport(); }}
                activeOpacity={0.7}
              >
                {renderSettingIcon('shield-outline')}
                <Text style={styles.settingText}>פרטיות ותמיכה</Text>
                <Ionicons name={settingsDisclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            </UICard>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.membersSectionHeader}>
              {renderSectionCaption(`חברים (${sortedMembers.length})`, true)}
              {isAdmin ? (
                <TouchableOpacity
                  onPress={() => { void HapticFeedback.selection(); handleAddMembers(); }}
                  style={styles.addButton}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={18} color={DesignTokens.colors.primary.main} />
                  <Text style={styles.addButtonText}>הוסף</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
              {sortedMembers.map((member, index) => (
                <React.Fragment key={member.id}>
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => handleMemberPress(member)}
                    disabled={!isAdmin && member.user_id !== user?.id}
                    activeOpacity={0.7}
                  >
                    {member.user?.profile_picture ? (
                      <Image source={{ uri: member.user.profile_picture }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberAvatarText}>
                          {member.user?.display_name?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
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
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { void HapticFeedback.impactLight(); handleLeaveGroup(); }}
            style={styles.leaveButtonWrap}
          >
            <UICard variant="glass" glassIntensity="light" padding="md" style={styles.leaveCard}>
              <Text style={styles.leaveButtonText}>עזוב קבוצה</Text>
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

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  rtlRoot: chatRtlRoot,
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.base,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing['3xl'],
  },
  errorStateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.base,
  },
  heroBlock: {
    alignItems: 'center',
    paddingBottom: 0,
  },
  sectionBlock: {
    marginBottom: tokens.spacing.lg,
  },
  sectionCard: {
    borderRadius: tokens.borderRadius.lg,
  },
  sectionCaptionWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  sectionCaption: {
    ...chatRtlText,
    fontSize: tokens.typography.caption.size,
    fontWeight: tokens.typography.fontWeight.bold as '700',
    lineHeight: tokens.typography.caption.lineHeight,
    color: tokens.colors.text.tertiary,
    marginBottom: tokens.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: tokens.typography.letterSpacing.wide,
  },
  sectionCaptionInline: {
    marginBottom: 0,
  },
  membersCaptionWrap: {
    flex: 1,
    alignSelf: 'stretch',
  },
  avatarContainer: {
    marginBottom: tokens.spacing.md,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border.subtle,
  },
  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border.subtle,
  },
  groupName: {
    ...chatRtlText,
    fontSize: tokens.typography.title2.size,
    fontWeight: tokens.typography.title2.weight as '700',
    lineHeight: tokens.typography.title2.lineHeight,
    letterSpacing: tokens.typography.title2.letterSpacing,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  groupStatus: {
    ...chatRtlText,
    fontSize: tokens.typography.subhead.size,
    fontWeight: tokens.typography.subhead.weight as '500',
    lineHeight: tokens.typography.subhead.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  aboutText: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as '400',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
  },
  mediaGrid: {
    ...chatRtlRow,
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: tokens.borderRadius.md,
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
    borderRadius: tokens.borderRadius.sm,
    padding: 4,
  },
  emptyMediaText: {
    ...chatRtlText,
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.bodySmall.weight as '400',
    lineHeight: tokens.typography.bodySmall.lineHeight,
    color: tokens.colors.text.tertiary,
  },
  settingRow: {
    ...chatRtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: `${tokens.colors.primary.main}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    ...chatRtlText,
    flex: 1,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: tokens.spacing.base,
  },
  membersSectionHeader: {
    ...chatRtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  memberRow: {
    ...chatRtlRow,
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.primary.dim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: tokens.typography.subhead.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    color: tokens.colors.primary.main,
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  memberNameRow: {
    ...chatRtlRow,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: 2,
  },
  memberName: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
  },
  adminBadge: {
    ...chatRtlRow,
    alignItems: 'center',
    backgroundColor: tokens.colors.warning.main + '20',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.md,
    gap: 4,
  },
  adminBadgeText: {
    ...chatRtlText,
    fontSize: tokens.typography.caption2.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    color: tokens.colors.warning.main,
  },
  youLabel: {
    ...chatRtlText,
    fontSize: tokens.typography.footnote.size,
    color: tokens.colors.text.tertiary,
  },
  onlineStatus: {
    ...chatRtlRow,
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.success.main,
  },
  onlineText: {
    ...chatRtlText,
    fontSize: tokens.typography.footnote.size,
    lineHeight: tokens.typography.footnote.lineHeight,
    color: tokens.colors.success.main,
  },
  offlineText: {
    ...chatRtlText,
    fontSize: tokens.typography.footnote.size,
    lineHeight: tokens.typography.footnote.lineHeight,
    color: tokens.colors.text.tertiary,
  },
  addButton: {
    ...chatRtlRow,
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  addButtonText: {
    ...chatRtlText,
    fontSize: tokens.typography.buttonSmall.size,
    fontWeight: tokens.typography.buttonSmall.weight as '600',
    lineHeight: tokens.typography.buttonSmall.lineHeight,
    color: tokens.colors.primary.main,
  },
  leaveButtonWrap: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  leaveCard: {
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.danger.main}40`,
  },
  leaveButtonText: {
    ...chatRtlText,
    fontSize: tokens.typography.buttonSmall.size,
    fontWeight: tokens.typography.buttonSmall.weight as '600',
    lineHeight: tokens.typography.buttonSmall.lineHeight,
    color: tokens.colors.danger.main,
    textAlign: 'center',
  },
  errorText: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  promptOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.overlay,
  },
  promptContainer: {
    width: '85%',
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border.subtle,
    direction: 'rtl',
  },
  promptTitle: {
    ...chatRtlText,
    fontSize: tokens.typography.subtitle.size,
    fontWeight: tokens.typography.subtitle.weight as '600',
    lineHeight: tokens.typography.subtitle.lineHeight,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.base,
  },
  promptInput: {
    ...chatRtlText,
    backgroundColor: tokens.colors.background.input,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border.subtle,
  },
  promptButtons: {
    ...chatRtlRow,
    justifyContent: 'flex-start',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  promptBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm + 2,
    borderRadius: tokens.borderRadius.md,
  },
  promptBtnCancel: {
    ...chatRtlText,
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.callout.size,
    fontWeight: tokens.typography.fontWeight.medium as '500',
  },
  promptBtnConfirmBg: {
    backgroundColor: tokens.colors.primary.main,
  },
  promptBtnConfirm: {
    color: tokens.colors.text.inverse,
    fontSize: tokens.typography.callout.size,
    fontWeight: tokens.typography.fontWeight.semibold as any,
  },
});
