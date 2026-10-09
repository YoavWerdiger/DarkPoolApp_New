// ============================================
// Chat Group Info Screen - Modern Design
// ============================================

import { isAnnouncementGroup } from '../../utils/isAnnouncementGroup';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupChatIcon } from '../../assets/chatGroups/groupChatIcons';
import { CommonActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { scheduleAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import { ChatGroupMember, ChatMemberRole } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { Bell, BellOff, ChevronDown, ChevronLeft, LogOut, Plus, Star, Users } from 'lucide-react-native';
import { Collapsible } from '../../components/ui/Collapsible';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatGroupService } from '../../services/chat';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { openUserProfile } from '../../lib/openUserProfile';
import { chatRtlRoot, chatRtlRow } from '../../components/chat/chatDesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  formatUserPresenceLabel,
  isUserPresenceOnline,
} from '../../utils/userPresence';
import { isolateNumericRuns } from '../DarkPool/utils/bidi';
import { useGroupNotificationMute } from '../../hooks/useGroupNotificationMute';
import { UserBadges, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import {
  settingsHeroType,
  settingsGroupLabelStyle,
  settingsRowType,
  settingsBodyType,
  settingsMetaType,
  settingsCaptionType,
  settingsCaption2Type,
  settingsHebrewText,
} from '../../components/profile/settingsType';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ChatGroupInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, leaveGroup, messages, refreshCurrentGroupDetails } = useChat();

  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptCallback, setPromptCallback] = useState<((value: string) => void) | null>(null);
  const { muted: isMuted, toggleMuted } = useGroupNotificationMute(
    groupId,
    !!currentGroup?.is_muted,
  );
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
      let interval: ReturnType<typeof setInterval> | undefined;
      const stop = scheduleAfterNavigationTransition(navigation, () => {
        void refreshCurrentGroupDetails();
        interval = setInterval(() => setPresenceTick((t) => t + 1), 30_000);
      });
      return () => {
        stop();
        if (interval) clearInterval(interval);
      };
    }, [navigation, refreshCurrentGroupDetails])
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

  const currentUserId = user?.id;

  const { activeMembers, otherRows } = useMemo(() => {
    let me: ChatGroupMember | null = null;
    const admins: ChatGroupMember[] = [];
    const others: ChatGroupMember[] = [];
    for (const member of sortedMembers) {
      if (currentUserId && member.user_id === currentUserId) {
        me = member;
        continue;
      }
      if (member.role === 'admin') {
        admins.push(member);
      } else {
        others.push(member);
      }
    }
    return {
      activeMembers: me ? [me, ...admins] : admins,
      otherRows: others,
    };
  }, [sortedMembers, currentUserId]);

  const [expandedMembers, setExpandedMembers] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggleExpandedMembers = useCallback(() => {
    void HapticFeedback.selection();
    setExpandedMembers((prev) => {
      const next = !prev;
      Animated.timing(chevronAnim, {
        toValue: next ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
      return next;
    });
  }, [chevronAnim]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // ============================================
  // Handle Actions
  // ============================================

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const renderSectionHeader = (
    title: string,
    action?: React.ReactNode,
  ) => (
    <View style={styles.sectionHeader}>
      {action}
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
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
      { text: 'הצג פרופיל', onPress: () => { openUserProfile(member.user_id, { currentUserId: user?.id }); } },
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
    void HapticFeedback.selection();
    const { success } = await toggleMuted(value);
    if (!success) {
      legacyAlert('שגיאה', 'לא ניתן לשנות את הגדרות ההשתקה');
      return;
    }
    await refreshCurrentGroupDetails();
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
                // Reset so Back cannot return into the left group
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'ChatGroupsList' }],
                  })
                );
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

  const renderMemberRow = (member: ChatGroupMember) => {
    const { isOnline, label } = getMemberPresence(member);
    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() => handleMemberPress(member)}
        disabled={!isAdmin && member.user_id !== user?.id}
        activeOpacity={0.7}
      >
        {label ? (
          <Text
            style={isOnline ? styles.onlineText : styles.lastSeenText}
            numberOfLines={1}
          >
            {isolateNumericRuns(label)}
          </Text>
        ) : null}
        <View style={styles.menuTextCol}>
          <View style={styles.memberNameRow}>
            {member.user_id === user?.id ? (
              <Text style={styles.youLabel}>(אתה)</Text>
            ) : null}
            {member.role === 'admin' ? (
              <View style={styles.adminBadge}>
                <Star size={10} color={DesignTokens.colors.warning.main} strokeWidth={2} />
                <Text style={styles.adminBadgeText}>אדמין</Text>
              </View>
            ) : null}
            <UserBadges
              userId={member.user_id}
              size={badgeSizeForLineHeight(20)}
              style={styles.memberBadges}
            />
            <Text style={styles.memberName} numberOfLines={1}>
              {member.user?.display_name || 'משתמש'}
            </Text>
          </View>
        </View>
        <View style={styles.leadingIcon}>
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
        </View>
      </TouchableOpacity>
    );
  };

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

  const groupAvatar =
    groupChatIcon(currentGroup.name, isDarkMode) ||
    (currentGroup.avatar_url ? { uri: currentGroup.avatar_url } : null);

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
          <UICard variant="soft" padding="none" style={[styles.heroCard, styles.sectionBlock]}>
            <View style={styles.heroBlock}>
              {groupAvatar ? (
                <Image source={groupAvatar} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Users size={44} color={DesignTokens.colors.text.secondary} strokeWidth={2} />
                </View>
              )}
              <Text style={styles.groupName} numberOfLines={2}>
                {chatGroupDisplayName(currentGroup.name)}
              </Text>
              <Text style={styles.groupStatus}>
                {isolateNumericRuns(`${sortedMembers.length} חברים`)}
              </Text>
              {currentGroup.description ? (
                <>
                  <View style={styles.heroDivider} />
                  <Text style={styles.aboutText}>{currentGroup.description}</Text>
                </>
              ) : null}
            </View>
          </UICard>

          <View style={styles.sectionBlock}>
            {renderSectionHeader(
              'מדיה',
              groupMediaItems.length > 0 ? (
                <TouchableOpacity
                  onPress={() => handleOpenGallery()}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.sectionHeaderAction}>הצג הכל</Text>
                </TouchableOpacity>
              ) : undefined,
            )}
            <UICard variant="soft" padding="none" style={styles.sectionSurface}>
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
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionHeader(
              'חברים',
              isAdmin ? (
                <TouchableOpacity
                  onPress={() => { void HapticFeedback.selection(); handleAddMembers(); }}
                  style={styles.addButton}
                  hitSlop={8}
                >
                  <Plus size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  <Text style={styles.addButtonText}>הוסף</Text>
                </TouchableOpacity>
              ) : undefined,
            )}
            <UICard variant="soft" padding="none" style={styles.sectionSurface}>
              {activeMembers.map((member, index) => (
                <React.Fragment key={member.id}>
                  {renderMemberRow(member)}
                  {index < activeMembers.length - 1 ? <View style={styles.separator} /> : null}
                </React.Fragment>
              ))}
              {otherRows.length > 0 ? (
                <>
                  {activeMembers.length > 0 ? <View style={styles.separator} /> : null}
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={toggleExpandedMembers}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandedMembers }}
                  >
                    <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                      <ChevronDown
                        size={20}
                        color={DesignTokens.colors.text.tertiary}
                        strokeWidth={2}
                      />
                    </Animated.View>
                    <View style={styles.menuTextCol}>
                      <Text style={styles.menuTitle}>
                        {isolateNumericRuns(`חברים נוספים · ${otherRows.length}`)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Collapsible open={expandedMembers}>
                    {otherRows.map((member) => (
                      <React.Fragment key={member.id}>
                        <View style={styles.separator} />
                        {renderMemberRow(member)}
                      </React.Fragment>
                    ))}
                  </Collapsible>
                </>
              ) : null}
            </UICard>
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionHeader('פעולות')}
            <UICard variant="soft" padding="none" style={styles.sectionSurface}>
              <View style={styles.menuRow}>
                <AppSwitch
                  value={isMuted}
                  onValueChange={(v) => { void handleToggleMute(v); }}
                  trackColor={{
                    false: theme.switchTrackOff,
                    true: DesignTokens.colors.primary.main,
                  }}
                  thumbColor={isMuted ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                  ios_backgroundColor={theme.switchTrackOff}
                  style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
                />
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>התראות</Text>
                </View>
                <View style={styles.leadingIcon}>
                  {isMuted ? (
                    <BellOff size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  ) : (
                    <Bell size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                  )}
                </View>
              </View>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { void HapticFeedback.selection(); handleStarredMessages(); }}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuTitle}>הודעות מסומנות</Text>
                </View>
                <View style={styles.leadingIcon}>
                  <Star size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              {/* הכרזות — כל המשתמשים חברים קבועים, אין יציאה */}
              {!isAnnouncementGroup(currentGroup?.name, groupId) ? (
              <>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { void HapticFeedback.impactLight(); handleLeaveGroup(); }}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                <View style={styles.menuTextCol}>
                  <Text style={[styles.menuTitle, styles.menuTitleDanger]}>יציאה מהקבוצה</Text>
                </View>
                <View style={styles.leadingIcon}>
                  <LogOut size={20} color={DesignTokens.colors.danger.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              </>
              ) : null}
            </UICard>
          </View>
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
              placeholderTextColor={DesignTokens.colors.text.tertiary}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setPromptVisible(false)} style={styles.promptBtn}>
                <Text style={styles.promptBtnCancel}>ביטול</Text>
              </TouchableOpacity>
              <UIButton
                title="אישור"
                variant="primary"
                size="sm"
                haptic={false}
                onPress={() => {
                  setPromptVisible(false);
                  promptCallback?.(promptValue);
                }}
              />
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
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing['3xl'],
  },
  errorStateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  heroCard: {
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.cardSolid,
  },
  heroBlock: {
    alignItems: 'center',
    padding: APP_LAYOUT.cardPadding,
  },
  sectionBlock: {
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  sectionSurface: {
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.cardSolid,
  },
  sectionHeader: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: APP_LAYOUT.groupLabelToContent,
  },
  sectionHeaderTitle: {
    ...settingsHebrewText,
    ...(({ width: _width, marginBottom: _marginBottom, ...label }) => label)(settingsGroupLabelStyle),
    flex: 1,
    minWidth: 0,
    color: tokens.colors.text.secondary,
  },
  sectionHeaderAction: {
    ...settingsHebrewText,
    ...settingsCaptionType,
    color: tokens.colors.text.primary,
  },
  sectionBody: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: APP_LAYOUT.cardPadding,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  avatarPlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: APP_LAYOUT.cardStackGap,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    ...settingsHeroType,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.titleSubtitleGap,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: tokens.spacing.sm,
  },
  groupStatus: {
    ...settingsMetaType,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    marginBottom: APP_LAYOUT.cardTitleToBodyGap,
  },
  aboutText: {
    ...settingsBodyType,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    writingDirection: 'rtl',
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
    ...settingsHebrewText,
    ...settingsMetaType,
    color: tokens.colors.text.tertiary,
  },
  menuRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  memberRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  menuTextCol: {
    flex: 1,
    minWidth: 0,
  },
  leadingIcon: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    ...settingsHebrewText,
    ...settingsRowType,
    lineHeight: 20,
    color: tokens.colors.text.primary,
  },
  menuTitleDanger: {
    color: tokens.colors.danger.main,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: APP_LAYOUT.cardPadding,
  },
  memberAvatarWrap: {
    position: 'relative',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    ...settingsMetaType,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    end: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.success.main,
    borderWidth: 2,
    borderColor: tokens.colors.background.cardSolid,
  },
  memberNameRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  memberBadges: {
    marginRight: 4,
  },
  memberName: {
    ...settingsHebrewText,
    ...settingsRowType,
    lineHeight: 20,
    flexShrink: 1,
    color: tokens.colors.text.primary,
  },
  adminBadge: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    backgroundColor: tokens.colors.warning.main + '20',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.md,
    marginRight: 4,
  },
  adminBadgeText: {
    ...settingsHebrewText,
    ...settingsCaption2Type,
    marginLeft: 4,
    color: tokens.colors.warning.main,
  },
  youLabel: {
    ...settingsHebrewText,
    ...settingsMetaType,
    marginRight: 4,
    color: tokens.colors.text.secondary,
  },
  onlineText: {
    ...settingsHebrewText,
    ...settingsMetaType,
    flexShrink: 1,
    marginRight: 12,
    color: tokens.colors.text.secondary,
  },
  lastSeenText: {
    ...settingsHebrewText,
    ...settingsMetaType,
    flexShrink: 1,
    marginRight: 12,
    color: tokens.colors.text.secondary,
  },
  addButton: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
  },
  addButtonText: {
    ...settingsHebrewText,
    ...settingsCaptionType,
    marginLeft: 12,
    color: tokens.colors.text.primary,
  },
  errorText: {
    ...settingsBodyType,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  promptOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.overlay,
  },
  promptContainer: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: UI_CARD_RADIUS,
    padding: APP_LAYOUT.cardPadding,
    borderWidth: 0,
    direction: 'ltr',
  },
  promptTitle: {
    ...settingsHebrewText,
    ...settingsRowType,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.cardTitleToBodyGap,
  },
  promptInput: {
    ...settingsHebrewText,
    ...settingsBodyType,
    backgroundColor: tokens.colors.background.input,
    borderRadius: tokens.borderRadius.full,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
    color: tokens.colors.text.primary,
    borderWidth: 0,
  },
  promptButtons: {
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: APP_LAYOUT.cardStackGap,
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
  },
  promptBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm + 2,
  },
  promptBtnCancel: {
    ...settingsHebrewText,
    ...settingsBodyType,
    color: tokens.colors.text.secondary,
  },
});
