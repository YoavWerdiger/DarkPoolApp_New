// ============================================
// Chat Group Info Screen - Modern Design
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
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
import { chatGroupService } from '../../services/chat';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatRtlRoot, chatRtlRow, chatRtlText } from '../../components/chat/chatDesignTokens';
import {
  formatUserPresenceLabel,
  isUserPresenceOnline,
} from '../../utils/userPresence';

export default function ChatGroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup, messages, refreshCurrentGroupDetails } = useChat();

  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptCallback, setPromptCallback] = useState<((value: string) => void) | null>(null);
  const [isMuted, setIsMuted] = useState(!!currentGroup?.is_muted);
  const [presenceTick, setPresenceTick] = useState(0);

  const showPrompt = (title: string, defaultValue: string, callback: (value: string) => void) => {
    setPromptTitle(title);
    setPromptValue(defaultValue);
    setPromptCallback(() => callback);
    setPromptVisible(true);
  };
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

  useFocusEffect(
    useCallback(() => {
      void refreshCurrentGroupDetails();
      const timer = setInterval(() => setPresenceTick((t) => t + 1), 30_000);
      return () => clearInterval(timer);
    }, [refreshCurrentGroupDetails])
  );

  useEffect(() => {
    setIsMuted(!!currentGroup?.is_muted);
  }, [currentGroup?.is_muted]);

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

  const presenceNow = Date.now() + presenceTick * 0;

  const getMemberPresence = useCallback(
    (member: ChatGroupMember) => {
      const isSelf = member.user_id === user?.id;
      const isOnline = isSelf
        ? true
        : isUserPresenceOnline(member.user?.is_online, member.user?.last_active, presenceNow);
      const label = isSelf
        ? 'מחובר/ת'
        : formatUserPresenceLabel(member.user?.is_online, member.user?.last_active, presenceNow);
      return { isOnline, label };
    },
    [user?.id, presenceNow],
  );

  const sortedMembers = useMemo(() => {
    const list = [...(currentGroup?.members || [])];
    return list.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;

      const aOnline = getMemberPresence(a).isOnline;
      const bOnline = getMemberPresence(b).isOnline;
      if (aOnline !== bOnline) return aOnline ? -1 : 1;

      return (a.user?.display_name || '').localeCompare(b.user?.display_name || '', 'he');
    });
  }, [currentGroup?.members, getMemberPresence]);

  // ============================================
  // Handle Actions
  // ============================================

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const renderCardHeader = (
    title: string,
    action?: React.ReactNode,
  ) => (
    <View style={styles.cardHeader}>
      <Text style={styles.cardHeaderTitle}>{title}</Text>
      {action}
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

  const handleStarredMessages = () => {
    (navigation as any).navigate('ChatGroupStarredMessages', { groupId });
  };

  const handleToggleMute = async (value: boolean) => {
    if (!user?.id) return;
    setIsMuted(value);
    void HapticFeedback.selection();
    const { success } = await chatGroupService.toggleGroupMute(groupId, user.id, value);
    if (!success) {
      setIsMuted(!value);
      legacyAlert('שגיאה', 'לא ניתן לשנות את הגדרות ההשתקה');
    }
  };

  const handleOpenGallery = (initialMediaId?: string) => {
    void HapticFeedback.selection();
    (navigation as any).navigate('GroupMediaGallery', {
      groupId,
      ...(initialMediaId ? { initialMediaId } : {}),
    });
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
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={[styles.heroCard, styles.sectionBlock]}
          >
            <View style={styles.heroBlock}>
              {currentGroup.avatar_url ? (
                <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="people" size={44} color={DesignTokens.colors.text.secondary} />
                </View>
              )}
              <Text style={styles.groupName} numberOfLines={2}>
                {currentGroup.name}
              </Text>
              <Text style={styles.groupStatus}>
                {sortedMembers.length} חברים
              </Text>
              {currentGroup.description ? (
                <>
                  <View style={styles.heroDivider} />
                  <Text style={styles.aboutText}>{currentGroup.description}</Text>
                </>
              ) : null}
            </View>
          </UICard>

          <UICard
            variant="glass"
            glassIntensity="subtle"
            padding="none"
            showGlassBorder={false}
            style={[styles.sectionSurface, styles.sectionBlock]}
          >
            {renderCardHeader(
              'מדיה',
              groupMediaItems.length > 0 ? (
                <TouchableOpacity
                  onPress={() => handleOpenGallery()}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.cardHeaderAction}>הצג הכל</Text>
                </TouchableOpacity>
              ) : undefined,
            )}
            <View style={styles.sectionBody}>
              {groupMediaItems.length > 0 ? (
                <View style={styles.mediaGrid}>
                  {groupMediaItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.mediaItem}
                      activeOpacity={0.85}
                      onPress={() => handleOpenGallery(item.id)}
                    >
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
            </View>
          </UICard>

          <UICard
            variant="glass"
            glassIntensity="subtle"
            padding="none"
            showGlassBorder={false}
            style={[styles.sectionSurface, styles.sectionBlock]}
          >
            {renderCardHeader('פעולות')}
            <View style={styles.quickPanel}>
              <View style={styles.quickPanelRow}>
                <View style={styles.quickMuteBlock}>
                  <View style={styles.quickMuteIconWrap}>
                    <Ionicons
                      name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
                      size={20}
                      color={DesignTokens.colors.primary.main}
                    />
                  </View>
                  <View style={styles.quickMuteTextWrap}>
                    <Text style={styles.quickPanelTitle}>התראות</Text>
                    <Text style={styles.quickPanelHint}>
                      {isMuted ? 'מושתק' : 'פעילות'}
                    </Text>
                  </View>
                  <Switch
                    value={isMuted}
                    onValueChange={(v) => { void handleToggleMute(v); }}
                    trackColor={{
                      false: DesignTokens.colors.background.tertiary,
                      true: DesignTokens.colors.primary.main,
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.quickStarRow}
                onPress={() => { void HapticFeedback.selection(); handleStarredMessages(); }}
                activeOpacity={0.7}
              >
                <View style={styles.quickMuteIconWrap}>
                  <Ionicons name="star" size={20} color={DesignTokens.colors.primary.main} />
                </View>
                <Text style={styles.quickPanelTitleGrow}>הודעות מסומנות</Text>
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </UICard>

          <UICard
            variant="glass"
            glassIntensity="subtle"
            padding="none"
            showGlassBorder={false}
            style={[styles.sectionSurface, styles.sectionBlock]}
          >
            {renderCardHeader(
              `חברים · ${sortedMembers.length}`,
              isAdmin ? (
                <TouchableOpacity
                  onPress={() => { void HapticFeedback.selection(); handleAddMembers(); }}
                  style={styles.addButton}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={18} color={DesignTokens.colors.primary.main} />
                  <Text style={styles.addButtonText}>הוסף</Text>
                </TouchableOpacity>
              ) : undefined,
            )}
            {sortedMembers.map((member, index) => {
              const { isOnline, label } = getMemberPresence(member);

              return (
                <React.Fragment key={member.id}>
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => handleMemberPress(member)}
                    disabled={!isAdmin && member.user_id !== user?.id}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberAvatarWrap}>
                      {member.user?.profile_picture ? (
                        <Image source={{ uri: member.user.profile_picture }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                          <Text style={styles.memberAvatarText}>
                            {member.user?.display_name?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                      {isOnline ? <View style={styles.avatarOnlineDot} /> : null}
                    </View>
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
                      {label ? (
                        <Text style={isOnline ? styles.onlineText : styles.lastSeenText} numberOfLines={1}>
                          {label}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  {index < sortedMembers.length - 1 ? <View style={styles.separator} /> : null}
                </React.Fragment>
              );
            })}
          </UICard>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { void HapticFeedback.impactLight(); handleLeaveGroup(); }}
            style={styles.leaveButton}
          >
            <Text style={styles.leaveButtonText}>עזוב קבוצה</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>

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
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing['3xl'],
  },
  errorStateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.base,
  },
  heroCard: {
    borderRadius: tokens.borderRadius.xl,
    overflow: 'hidden',
  },
  heroBlock: {
    alignItems: 'center',
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.base,
  },
  sectionBlock: {
    marginBottom: tokens.spacing.md,
  },
  sectionSurface: {
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    ...chatRtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.base,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border.divider,
  },
  cardHeaderTitle: {
    ...chatRtlText,
    flex: 1,
    fontSize: tokens.typography.subhead.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    lineHeight: tokens.typography.subhead.lineHeight,
    color: tokens.colors.text.secondary,
  },
  cardHeaderAction: {
    ...chatRtlText,
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    color: tokens.colors.primary.main,
  },
  sectionBody: {
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.md,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: tokens.spacing.md,
  },
  avatarPlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
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
  heroDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.lg,
  },
  aboutText: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight as '400',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.xs,
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
  quickPanel: {
    paddingVertical: tokens.spacing.xs,
  },
  quickPanelRow: {
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.sm,
  },
  quickMuteBlock: {
    ...chatRtlRow,
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  quickMuteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: `${tokens.colors.primary.main}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMuteTextWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  quickPanelTitle: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
  },
  quickPanelTitleGrow: {
    ...chatRtlText,
    flex: 1,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.semibold as '600',
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
  },
  quickPanelHint: {
    ...chatRtlText,
    fontSize: tokens.typography.footnote.size,
    lineHeight: tokens.typography.footnote.lineHeight,
    color: tokens.colors.text.tertiary,
    marginTop: 1,
  },
  quickStarRow: {
    ...chatRtlRow,
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: tokens.spacing.base,
  },
  memberRow: {
    ...chatRtlRow,
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  memberAvatarWrap: {
    position: 'relative',
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
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: tokens.colors.success.main,
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
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
  onlineText: {
    ...chatRtlText,
    fontSize: tokens.typography.footnote.size,
    lineHeight: tokens.typography.footnote.lineHeight,
    color: tokens.colors.success.main,
  },
  lastSeenText: {
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
  leaveButton: {
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
    backgroundColor: `${tokens.colors.danger.main}1A`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.danger.main}55`,
  },
  leaveButtonText: {
    ...chatRtlText,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.buttonSmall.weight as '600',
    lineHeight: tokens.typography.body.lineHeight,
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
