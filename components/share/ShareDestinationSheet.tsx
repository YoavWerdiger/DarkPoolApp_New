import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import UICard from '../ui/UICard';
import EntityEmbedCard from './EntityEmbedCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { getChatGroups } from '../../services/chat/chatGroupService';
import { sendChatMessage } from '../../services/chat/chatMessageService';
import { createCommunityPost } from '../../services/tweetsService';
import { ChatMessageType } from '../../types/chat.types';
import {
  serializeEntityMessageContent,
  type ShareableAttachment,
} from '../../types/shareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { appPhysicalRightText, appSheetButtonLabelStyle } from '../ui/appType';
import { legacyAlert } from '../../utils/appDialog';
import { rootNavigationRef } from '../../navigation/rootNavigationRef';

type Dest = 'menu' | 'chat';

type Props = {
  visible: boolean;
  attachment: ShareableAttachment | null;
  onClose: () => void;
  /** אחרי שיתוף לציוץ — אופציונלי לפתיחת פיד */
  onSharedTweet?: () => void;
  /** שיתוף כתמונה מעוצבת (כרטיס DarkPool) — מוצג רק כשמועבר */
  onShareAsImage?: () => void;
};

type ChatGroupRow = {
  id: string;
  name: string;
  avatar_url?: string | null;
};


export default function ShareDestinationSheet({
  visible,
  attachment,
  onClose,
  onSharedTweet,
  onShareAsImage,
}: Props) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [dest, setDest] = useState<Dest>('menu');
  const [groups, setGroups] = useState<ChatGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDest('menu');
      setGroups([]);
      setLoading(false);
      setBusy(false);
    }
  }, [visible]);

  const loadGroups = useCallback(async () => {
    if (!user?.id) {
      legacyAlert('שגיאה', 'יש להתחבר כדי לשתף לצ׳אט');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await getChatGroups(user.id);
      if (error) {
        legacyAlert('שגיאה', error.message || 'לא ניתן לטעון קבוצות');
        return;
      }
      setGroups(
        (data || []).map((g: any) => ({
          id: g.id,
          name: g.name || 'קבוצה',
          avatar_url: g.avatar_url,
        }))
      );
    } catch {
      legacyAlert('שגיאה', 'שגיאה בטעינת קבוצות');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const shareTweet = useCallback(async () => {
    if (!attachment || busy) return;
    if (!user?.id) {
      legacyAlert('שגיאה', 'יש להתחבר כדי לצייץ');
      return;
    }
    setBusy(true);
    void HapticFeedback.impactLight();
    try {
      const body =
        (attachment.preview.title ?? '').trim() ||
        (attachment.preview.subtitle ?? '').trim() ||
        'שיתוף מהאפליקציה';
      await createCommunityPost({
        body,
        attachments: [attachment],
        attachment,
      });
      void HapticFeedback.success();
      legacyAlert('הצלחה', 'התוכן פורסם בציוצים');
      onSharedTweet?.();
      onClose();
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('Main', {
          screen: 'Tweets',
        } as never);
      }
    } catch (e: any) {
      legacyAlert('שגיאה', e?.message || 'לא ניתן לפרסם ציוץ');
    } finally {
      setBusy(false);
    }
  }, [attachment, busy, onClose, onSharedTweet, user?.id]);

  const shareToGroup = useCallback(
    async (groupId: string, groupName: string) => {
      if (!attachment || !user?.id || busy) return;
      setBusy(true);
      void HapticFeedback.medium();
      try {
        const content = serializeEntityMessageContent(attachment);
        const { data: sent, error } = await sendChatMessage(
          {
            group_id: groupId,
            message_type: ChatMessageType.ENTITY,
            content,
          },
          user.id
        );
        if (error || !sent) {
          legacyAlert('שגיאה', error?.message || 'לא ניתן לשתף לקבוצה');
          return;
        }
        void HapticFeedback.success();
        legacyAlert('הצלחה', `שותף לקבוצה "${groupName}"`);
        onClose();
      } catch {
        legacyAlert('שגיאה', 'לא ניתן לשתף לקבוצה');
      } finally {
        setBusy(false);
      }
    },
    [attachment, busy, onClose, user?.id]
  );

  if (!attachment) return null;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.62, 0.9]}
      enablePanDownToClose={!busy}
      showHandle
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      topCornerRadius={28}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={() => {
              if (busy) return;
              if (dest === 'chat') {
                setDest('menu');
                return;
              }
              onClose();
            }}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="סגור"
            disabled={busy}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>
              {dest === 'chat' ? 'בחר קבוצה' : 'שתף'}
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <View style={styles.preview}>
          <EntityEmbedCard attachment={attachment} onPress={() => undefined} />
        </View>

        {dest === 'menu' ? (
          <View style={styles.actions}>
            {onShareAsImage ? (
              <UICard
                variant="blur"
                glassIntensity="medium"
                padding="none"
                onPress={
                  busy
                    ? undefined
                    : () => {
                        void HapticFeedback.selection();
                        onShareAsImage();
                      }
                }
                style={styles.actionBtn}
                contentContainerStyle={styles.actionBtnContent}
                accessibilityLabel="שתף כתמונה"
              >
                <Ionicons name="image-outline" size={22} color={tokens.colors.primary.main} />
                <Text style={[styles.actionText, { color: tokens.colors.text.primary }]}>
                  שתף כתמונה
                </Text>
              </UICard>
            ) : null}
            <UICard
              variant="blur"
              glassIntensity={onShareAsImage ? 'light' : 'medium'}
              padding="none"
              onPress={busy ? undefined : () => void shareTweet()}
              style={styles.actionBtn}
              contentContainerStyle={styles.actionBtnContent}
              accessibilityLabel="פרסם בציוצים"
            >
              {busy ? (
                <ActivityIndicator color={tokens.colors.primary.main} />
              ) : (
                <>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={22}
                    color={tokens.colors.primary.main}
                  />
                  <Text style={[styles.actionText, { color: tokens.colors.text.primary }]}>
                    פרסם בציוצים
                  </Text>
                </>
              )}
            </UICard>
            <UICard
              variant="blur"
              glassIntensity="light"
              padding="none"
              onPress={
                busy
                  ? undefined
                  : () => {
                      void HapticFeedback.selection();
                      setDest('chat');
                      void loadGroups();
                    }
              }
              style={styles.actionBtn}
              contentContainerStyle={styles.actionBtnContent}
              accessibilityLabel="שלח לצ׳אט"
            >
              <Ionicons name="people-outline" size={22} color={tokens.colors.text.primary} />
              <Text style={[styles.actionText, { color: tokens.colors.text.primary }]}>
                שלח לצ׳אט
              </Text>
            </UICard>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ color: tokens.colors.text.secondary, writingDirection: 'rtl' }}>
              אין קבוצות זמינות
            </Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.groupRow}
                disabled={busy}
                onPress={() => void shareToGroup(item.id, item.name)}
              >
                {groupAvatarSource(item.name, item.avatar_url, isDarkMode) ? (
                  <Image
                    source={groupAvatarSource(item.name, item.avatar_url, isDarkMode)!}
                    style={styles.groupAvatar}
                  />
                ) : (
                  <View style={[styles.groupAvatar, styles.groupAvatarPh]}>
                    <Ionicons name="people" size={20} color={tokens.colors.text.secondary} />
                  </View>
                )}
                <Text style={[styles.groupName, { color: tokens.colors.text.primary }]}>
                  {chatGroupDisplayName(item.name)}
                </Text>
                <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    container: { flex: 1, minHeight: 0, direction: 'rtl' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    preview: { paddingHorizontal: 16, marginBottom: 12, marginTop: 12 },
    actions: { paddingHorizontal: 16, gap: 10 },
    actionBtn: {
      borderRadius: 999,
      minHeight: 52,
      overflow: 'hidden',
    },
    actionBtnContent: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    actionText: {
      flex: 1,
      ...appSheetButtonLabelStyle,
      ...appPhysicalRightText,
      textAlign: 'right',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    groupRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    groupAvatar: { width: 44, height: 44, borderRadius: tokens.borderRadius.full },
    groupAvatarPh: {
      backgroundColor: tokens.colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
