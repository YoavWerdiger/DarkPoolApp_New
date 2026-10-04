import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Search } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
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

const AVATAR = 44;
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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>שליחה אל…</Text>
        <Pressable onPress={close} hitSlop={12} style={styles.closeBtn} accessibilityLabel="סגירה">
          <Ionicons name="close" size={22} color={tokens.colors.text.primary} />
        </Pressable>
      </View>

      {share ? (
        <View style={styles.preview}>
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

      <View style={styles.searchBox}>
        <Search size={18} color={tokens.colors.text.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חיפוש קבוצה"
          placeholderTextColor={tokens.colors.text.secondary}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {isLoadingGroups && groups.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={tokens.colors.text.secondary} />
      ) : (
        <FlatList
          data={sendable}
          keyExtractor={(g) => g.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<Text style={styles.empty}>לא נמצאו קבוצות</Text>}
          renderItem={({ item }) => {
            const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);
            return (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
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
                <Ionicons name="chevron-back" size={18} color={tokens.colors.text.secondary} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background.primary,
    },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: APP_LAYOUT.componentGap,
    },
    title: {
      ...APP_TYPE.screenTitle,
      color: t.colors.text.primary,
      textAlign: 'right',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.border.primary,
    },
    preview: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapTight,
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: APP_LAYOUT.componentGap,
      padding: APP_LAYOUT.stackGapTight,
      borderRadius: 16,
      backgroundColor: t.colors.border.primary,
    },
    previewThumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: 10,
    },
    previewIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.background.cardSolid,
    },
    previewText: {
      ...APP_TYPE.cardBody,
      flex: 1,
      color: t.colors.text.primary,
      textAlign: 'right',
    },
    searchBox: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
      height: 44,
      paddingHorizontal: APP_LAYOUT.stackGapTight,
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: APP_LAYOUT.stackGapSmall,
      borderRadius: t.borderRadius.search,
      backgroundColor: t.colors.border.primary,
    },
    searchInput: {
      ...APP_TYPE.body,
      flex: 1,
      color: t.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
      paddingVertical: 0,
    },
    loading: {
      marginTop: 40,
    },
    empty: {
      ...APP_TYPE.cardBody,
      color: t.colors.text.secondary,
      textAlign: 'center',
      marginTop: 40,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapTight,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingVertical: 10,
    },
    rowPressed: {
      opacity: 0.6,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.border.primary,
    },
    rowName: {
      ...APP_TYPE.cardTitle,
      flex: 1,
      color: t.colors.text.primary,
      textAlign: 'right',
    },
  });
}
