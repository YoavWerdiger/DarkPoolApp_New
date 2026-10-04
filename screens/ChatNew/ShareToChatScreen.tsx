import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Search } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  appCardBodyStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
  appPhysicalRightText,
} from '../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useTheme } from '../../context/ThemeContext';
import { useChat, useChatActions } from '../../context/ChatContext';
import { lockAndroidChatSoftInput } from '../../components/chat/androidChatKeyboard';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { chatGroupOpenParams } from '../../lib/chatOpenPrime';
import {
  assignIncomingShareToGroup,
  clearIncomingShare,
  peekIncomingShare,
  subscribePendingShare,
  type PendingShare,
} from '../../lib/pendingShare';
import { canPostInGroup } from '../../utils/canSendInAdminOnlyChat';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { ChatGroup } from '../../types/chat.types';

const AVATAR = 48;
const THUMB = 44;

function shareSummary(share: PendingShare | null): string {
  if (!share) return '';
  const images = share.media.filter((m) => m.type === 'image').length;
  const videos = share.media.filter((m) => m.type === 'video').length;
  const parts: string[] = [];
  if (images === 1) parts.push('תמונה');
  else if (images > 1) parts.push(`${images} תמונות`);
  if (videos === 1) parts.push('סרטון');
  else if (videos > 1) parts.push(`${videos} סרטונים`);
  if (parts.length > 0) return parts.join(' ו');
  return share.text ?? '';
}

export default function ShareToChatScreen() {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { groups, isLoadingGroups } = useChat();
  const { primeGroupForOpen } = useChatActions();
  const { isAdmin: isAppAdmin } = useIsAdmin();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [share, setShare] = useState<PendingShare | null>(() => peekIncomingShare());

  useEffect(
    () => subscribePendingShare(() => setShare(peekIncomingShare())),
    [],
  );

  const sendable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => canPostInGroup(g, isAppAdmin))
      .filter((g) => !q || chatGroupDisplayName(g.name).toLowerCase().includes(q))
      .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''));
  }, [groups, query, isAppAdmin]);

  const close = useCallback(() => {
    clearIncomingShare();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ChatGroupsList');
  }, [navigation]);

  const pick = useCallback(
    (group: ChatGroup) => {
      void HapticFeedback.impactLight();
      lockAndroidChatSoftInput();
      primeGroupForOpen(group.id, {
        name: chatGroupDisplayName(group.name),
        avatar_url: group.avatar_url,
        unread_count: group.unread_count,
        last_read_message_id: group.last_read_message_id,
        my_role: group.my_role,
      });
      assignIncomingShareToGroup(group.id);
      navigation.replace('ChatGroup', chatGroupOpenParams(group));
    },
    [navigation, primeGroupForOpen],
  );

  const firstThumb = share?.media[0]?.thumbnailUri;

  return (
    <ChatScreenShell>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ChatSubScreenHeader title="שליחה אל…" onBack={close} backIcon="close" />

        {share ? (
          <View style={styles.previewCard}>
            {firstThumb ? (
              <Image source={{ uri: firstThumb }} style={styles.previewThumb} />
            ) : (
              <View style={[styles.previewThumb, styles.previewIcon]}>
                <Ionicons name="link-outline" size={20} color={tokens.colors.text.secondary} />
              </View>
            )}
            <Text style={styles.previewText} numberOfLines={2}>
              {shareSummary(share)}
            </Text>
          </View>
        ) : null}

        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Search size={18} color={tokens.colors.text.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="חיפוש קבוצה"
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <Text style={styles.groupLabel}>קבוצות</Text>

        {isLoadingGroups && groups.length === 0 ? (
          <ActivityIndicator style={styles.loading} color={tokens.colors.text.secondary} />
        ) : (
          <FlatList
            data={sendable}
            keyExtractor={(g) => g.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + APP_LAYOUT.componentGap }}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            ListEmptyComponent={<Text style={styles.empty}>לא נמצאו קבוצות</Text>}
            renderItem={({ item }) => {
              const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);
              return (
                <TouchableOpacity onPress={() => pick(item)} activeOpacity={0.6} style={styles.row}>
                  {avatar ? (
                    <Image source={avatar} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="people" size={20} color={tokens.colors.text.secondary} />
                    </View>
                  )}
                  <Text style={styles.rowName} numberOfLines={1}>
                    {chatGroupDisplayName(item.name)}
                  </Text>
                  <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </ChatScreenShell>
  );
}

function createStyles(t: ReturnType<typeof useDesignTokens>) {
  const HP = APP_LAYOUT.screenPaddingHorizontal;
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    /** כרטיס cardSolid — מה נשלח */
    previewCard: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapTight,
      marginHorizontal: HP,
      marginTop: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.componentGap,
      padding: APP_LAYOUT.cardPadding,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: t.colors.background.cardSolid,
    },
    previewThumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: t.borderRadius.md,
    },
    previewIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.background.tertiary,
    },
    previewText: {
      ...appCardBodyStyle,
      flex: 1,
      width: undefined,
      color: t.colors.text.primary,
    },
    searchBox: {
      ...formFieldShellStyle({ tokens: t, focused: false }),
      flexDirection: 'row-reverse',
      gap: APP_LAYOUT.stackGapSmall,
      minHeight: 52,
      paddingHorizontal: 16,
      marginHorizontal: HP,
      borderRadius: t.borderRadius.search,
    },
    searchBoxFocused: {
      backgroundColor: t.colors.background.tertiary,
    },
    searchInput: {
      ...formFieldInputStyle(t),
      ...appPhysicalRightText,
      flex: 1,
      minHeight: 52,
      color: t.colors.text.primary,
    },
    /** תווית קבוצה — 15/500 אפורה, 8 עד התוכן */
    groupLabel: {
      ...appGroupLabelStyle,
      color: t.colors.text.secondary,
      paddingHorizontal: HP,
      marginTop: APP_LAYOUT.componentGap,
    },
    loading: {
      marginTop: 40,
    },
    empty: {
      ...appCardBodyStyle,
      color: t.colors.text.secondary,
      textAlign: 'center',
      marginTop: 40,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapTight,
      paddingHorizontal: HP,
      paddingVertical: APP_LAYOUT.stackGapTight,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border.divider,
      // מתחיל אחרי האווטאר (כמו רשימת הצ'אטים)
      marginRight: HP + AVATAR + APP_LAYOUT.stackGapTight,
      marginLeft: HP,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.background.cardSolid,
    },
    rowName: {
      ...appCardTitleStyle,
      flex: 1,
      width: undefined,
      alignSelf: 'center',
      color: t.colors.text.primary,
    },
  });
}
