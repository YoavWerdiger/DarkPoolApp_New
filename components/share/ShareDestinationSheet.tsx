import { ROOT_DIR, UI_DIR, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { SkeletonBox, SkeletonLine } from '../ui/SkeletonLoader';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { Image as ImageIcon, MessageSquareText, Send } from 'lucide-react-native';
import { SettingsActionRow, SettingsGlassCard } from '../profile/ProfileSettingsUI';
import { APP_LAYOUT } from '../ui/appLayout';
import { useChatFitContentSnap, useChatSheetDismiss } from '../chat/ChatBottomSheet';
import EntityEmbedCard from './EntityEmbedCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { getChatGroups } from '../../services/chat/chatGroupService';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { legacyAlert } from '../../utils/appDialog';
import { rootNavigationRef } from '../../navigation/rootNavigationRef';
import { setEntityShareForGroup } from '../../lib/pendingShare';

type Dest = 'menu' | 'chat';

type Props = {
  visible: boolean;
  attachment: ShareableAttachment | null;
  onClose: () => void;
  /** אחרי שיתוף לציוץ — אופציונלי לפתיחת פיד */
  onSharedTweet?: () => void;
  /** שיתוף כתמונה מעוצבת (כרטיס DarkPool) — מוצג רק כשמועבר */
  onShareAsImage?: () => void;
  /** אחרי שיתוף בפועל (צ׳אט / ציוץ) — לסגירת שיט אב שהשיט נפתח מעליו */
  onShared?: () => void;
};

type ChatGroupRow = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

/** הקבוצות האחרונות לכל משתמש — שיתוף חוזר מציג את הרשימה מיד */
const groupsCache = new Map<string, ChatGroupRow[]>();


export default function ShareDestinationSheet({
  visible,
  attachment,
  onClose,
  onSharedTweet,
  onShareAsImage,
  onShared,
}: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  // השיט בגובה התוכן (תפריט / רשימת קבוצות) — נמדד מחדש במעבר בין המסכים
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.45, 0.92, 0.12);
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [dest, setDest] = useState<Dest>('menu');
  const [groups, setGroups] = useState<ChatGroupRow[]>(() => (user?.id ? groupsCache.get(user.id) ?? [] : []));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDest('menu');
      setLoading(false);
      setBusy(false);
    }
  }, [visible]);

  const loadGroups = useCallback(async () => {
    if (!user?.id) {
      legacyAlert(i18n.t('auto.components__share__ShareDestinationSheet.s1'), i18n.t('auto.components__share__ShareDestinationSheet.s2'));
      return;
    }
    // יש רשימה מהקאש — מרעננים בשקט (בלי שלד)
    if (!groupsCache.get(user.id)?.length) setLoading(true);
    try {
      const { data, error } = await getChatGroups(user.id);
      if (error) {
        legacyAlert(i18n.t('auto.components__share__ShareDestinationSheet.s1'), error.message || i18n.t('auto.components__share__ShareDestinationSheet.s3'));
        return;
      }
      const rows: ChatGroupRow[] = (data || []).map((g: any) => ({
        id: g.id,
        name: g.name || i18n.t('auto.components__share__ShareDestinationSheet.s4'),
        avatar_url: g.avatar_url,
      }));
      groupsCache.set(user.id, rows);
      setGroups(rows);
    } catch {
      legacyAlert(i18n.t('auto.components__share__ShareDestinationSheet.s1'), i18n.t('auto.components__share__ShareDestinationSheet.s5'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // טעינה מוקדמת כשהשיט נפתח — כשבוחרים «צ'אט» הקבוצות כבר שם
  useEffect(() => {
    if (!visible || !user?.id) return;
    const cached = groupsCache.get(user.id);
    if (cached?.length) setGroups(cached);
    void loadGroups();
  }, [visible, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ציוץ: פותחים את מסך הכתיבה של הציוצים עם הכרטיס מצורף — כותבים שם ומפרסמים
  const shareTweet = useCallback(() => {
    if (!attachment || busy) return;
    if (!user?.id) {
      legacyAlert(i18n.t('auto.components__share__ShareDestinationSheet.s1'), i18n.t('auto.components__share__ShareDestinationSheet.s6'));
      return;
    }
    void HapticFeedback.selection();
    onClose();
    onSharedTweet?.();
    onShared?.();
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate('Main', {
        screen: 'Tweets',
        params: { composeAttachment: attachment, composeKey: Date.now() },
      } as never);
    }
  }, [attachment, busy, onClose, onSharedTweet, user?.id]);

  // צ׳אט: הכרטיס נכנס לשורת הכתיבה של הקבוצה (כיתוב אופציונלי) — כמו העברה בוואטסאפ
  const shareToGroup = useCallback(
    (groupId: string) => {
      if (!attachment || !user?.id || busy) return;
      void HapticFeedback.selection();
      setEntityShareForGroup(groupId, attachment);
      onClose();
      onShared?.();
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('Main', {
          screen: 'Chat',
          params: { screen: 'ChatGroup', params: { groupId }, initial: false },
        } as never);
      }
    },
    [attachment, busy, onClose, onShared, user?.id]
  );

  if (!attachment) return null;

  const noChevron = <View />;
  const windowHeight = Dimensions.get('window').height;

  return (
    // לפי הטופו (כמו 3 הנקודות ביומן): קנבס ערכת הנושא, פינות xl, כותרת עם שברון, שורות פעולה בכרטיס
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      // גובה לפי התוכן — בלי שטח מת מתחת לאפשרויות
      snapPoints={[snapPoint]}
      fitContent
      enablePanDownToClose={!busy}
      showHandle
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]} onLayout={onContentLayout}>
        <View style={styles.header}>
          <ShareHeaderBack
            disabled={busy}
            label={dest === 'chat' ? i18n.t('auto.components__share__ShareDestinationSheet.s7') : i18n.t('auto.components__share__ShareDestinationSheet.s8')}
            onBack={dest === 'chat' ? () => setDest('menu') : undefined}
            onClose={onClose}
          />
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>
              {dest === 'chat' ? i18n.t('auto.components__share__ShareDestinationSheet.s9') : i18n.t('auto.components__share__ShareDestinationSheet.s10')}
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <View style={styles.preview}>
          <EntityEmbedCard attachment={attachment} onPress={() => undefined} />
        </View>

        {dest === 'menu' ? (
          <View style={styles.actions}>
            {/* סדר: צ׳אט → ציוצים → תמונה */}
            <SettingsGlassCard style={{ marginBottom: 0 }}>
              <SettingsActionRow
                title={i18n.t('auto.components__share__ShareDestinationSheet.s11')}
                icon={Send}
                trailing={noChevron}
                onPress={() => {
                  if (busy) return;
                  void HapticFeedback.selection();
                  setDest('chat');
                }}
              />
              <SettingsActionRow
                title={i18n.t('auto.components__share__ShareDestinationSheet.s12')}
                icon={MessageSquareText}
                trailing={busy ? <ActivityIndicator size="small" color={tokens.colors.text.secondary} /> : noChevron}
                showDivider={!!onShareAsImage}
                onPress={() => {
                  if (busy) return;
                  shareTweet();
                }}
              />
              {onShareAsImage ? (
                <SettingsActionRow
                  title={i18n.t('auto.components__share__ShareDestinationSheet.s13')}
                  icon={ImageIcon}
                  trailing={noChevron}
                  showDivider={false}
                  onPress={() => {
                    if (busy) return;
                    void HapticFeedback.selection();
                    onShareAsImage();
                  }}
                />
              ) : null}
            </SettingsGlassCard>
          </View>
        ) : (
          // גובה קבוע לאזור הקבוצות — השיט גדל פעם אחת (תפריט → רשימה) ולא שוב כשהנתונים מגיעים
          <View style={{ height: Math.round(windowHeight * 0.5) }}>
          {loading && groups.length === 0 ? (
          <View style={styles.listContent} pointerEvents="none">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <React.Fragment key={i}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                <View style={styles.groupRow}>
                  <SkeletonBox width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1 }}>
                    <SkeletonLine lineHeight={22} width={[120, 96, 140, 88, 110, 130][i]} box={14} />
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.components__share__ShareDestinationSheet.s14')}</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            style={{ flex: 1 }}
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
                  onPress={() => shareToGroup(item.id)}
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
                  <Ionicons name={dirIcon('chevron-back')} size={18} color={tokens.colors.text.tertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

/** כפתור שברון בכותרת — בתוך השיט, כדי שהסגירה תהיה מונפשת כמו בשאר השיטים */
function ShareHeaderBack({
  disabled,
  label,
  onBack,
  onClose,
}: {
  disabled: boolean;
  label: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  const tokens = useDesignTokens();
  const dismiss = useChatSheetDismiss(onClose);
  return (
    <DayNavBlurButton
      onPress={() => {
        if (disabled) return;
        if (onBack) onBack();
        else dismiss();
      }}
      size={DAY_NAV_BUTTON_SIZE}
      glass={false}
      style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
      accessibilityLabel={label}
      disabled={disabled}
    >
      <Ionicons name={dirIcon('chevron-forward')} size={22} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    container: { direction: UI_DIR },
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
      direction: ROOT_DIR,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
      width: '100%',
    },
    preview: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginTop: APP_LAYOUT.cardTitleToBodyGap + 4,
      marginBottom: APP_LAYOUT.componentGap,
    },
    actions: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal },
    center: {
      minHeight: 160,
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
    // direction:'rtl' (container) — row = תמונה מימין, שם, שברון בקצה השמאלי
    groupRow: {
      flexDirection: 'row',
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
