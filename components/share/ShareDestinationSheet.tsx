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
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { Image as ImageIcon, MessageSquareText, Send } from 'lucide-react-native';
import { SettingsActionRow, SettingsGlassCard } from '../profile/ProfileSettingsUI';
import { APP_LAYOUT } from '../ui/appLayout';
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
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
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

  const noChevron = <View />;

  return (
    // לפי הטופו (כמו 3 הנקודות ביומן): קנבס ערכת הנושא, פינות xl, כותרת עם שברון, שורות פעולה בכרטיס
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.62, 0.9]}
      enablePanDownToClose={!busy}
      showHandle
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
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
            glass={false}
            style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
            accessibilityLabel={dest === 'chat' ? 'חזרה' : 'סגור'}
            disabled={busy}
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>
              {dest === 'chat' ? 'בחר קבוצה' : 'שיתוף'}
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <View style={styles.preview}>
          <EntityEmbedCard attachment={attachment} onPress={() => undefined} />
        </View>

        {dest === 'menu' ? (
          <View style={styles.actions}>
            <SettingsGlassCard style={{ marginBottom: 0 }}>
              {onShareAsImage ? (
                <SettingsActionRow
                  title="שתף כתמונה"
                  icon={ImageIcon}
                  trailing={noChevron}
                  onPress={() => {
                    if (busy) return;
                    void HapticFeedback.selection();
                    onShareAsImage();
                  }}
                />
              ) : null}
              <SettingsActionRow
                title={busy ? 'מפרסם…' : 'פרסם בציוצים'}
                icon={MessageSquareText}
                trailing={busy ? <ActivityIndicator size="small" color={tokens.colors.text.secondary} /> : noChevron}
                onPress={() => {
                  if (busy) return;
                  void shareTweet();
                }}
              />
              <SettingsActionRow
                title="שלח לצ׳אט"
                icon={Send}
                showDivider={false}
                onPress={() => {
                  if (busy) return;
                  void HapticFeedback.selection();
                  setDest('chat');
                  void loadGroups();
                }}
              />
            </SettingsGlassCard>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.text.secondary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: tokens.colors.text.secondary }]}>אין קבוצות זמינות</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
            )}
            renderItem={({ item }) => {
              const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);
              return (
                <TouchableOpacity
                  style={styles.groupRow}
                  activeOpacity={0.7}
                  disabled={busy}
                  onPress={() => void shareToGroup(item.id, item.name)}
                >
                  {avatar ? (
                    <Image source={avatar} style={styles.groupAvatar} />
                  ) : (
                    <View style={[styles.groupAvatar, styles.groupAvatarPh]}>
                      <Ionicons name="people" size={20} color={tokens.colors.text.secondary} />
                    </View>
                  )}
                  <Text style={[styles.groupName, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                    {chatGroupDisplayName(item.name)}
                  </Text>
                  <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
                </TouchableOpacity>
              );
            }}
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
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
      gap: 10,
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
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      direction: 'ltr',
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    preview: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginTop: APP_LAYOUT.cardTitleToBodyGap + 4,
      marginBottom: APP_LAYOUT.componentGap,
    },
    actions: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyText: {
      ...appPhysicalRightText,
      textAlign: 'center',
      fontSize: APP_TYPE.cardBody.fontSize,
    },
    listContent: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 24,
    },
    divider: { height: StyleSheet.hairlineWidth },
    groupRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
    },
    groupAvatar: { width: 44, height: 44, borderRadius: tokens.borderRadius.full },
    groupAvatarPh: {
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: {
      ...appPhysicalRightText,
      flex: 1,
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
    },
  });
}
