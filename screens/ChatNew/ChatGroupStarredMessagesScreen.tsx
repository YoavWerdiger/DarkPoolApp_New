// ============================================
// Chat Group Starred Messages Screen
// ============================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { Ionicons } from '@expo/vector-icons';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { he } from 'date-fns/locale';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import ChatMessage from '../../components/chat/ChatMessage';
import { useAuth } from '../../context/AuthContext';
import { chatMessageService } from '../../services/chat';
import { ChatStarredMessage, ChatMessage as ChatMessageType } from '../../types/chat.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';
import { chatRtlText } from '../../components/chat/chatDesignTokens';
import { legacyAlert } from '../../utils/appDialog';

function DateDivider({ label }: { label: string }) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 },
        line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
        badge: {
          paddingHorizontal: 14,
          paddingVertical: 5,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.08)',
          marginHorizontal: 10,
        },
        text: { color: tokens.colors.text.secondary, fontSize: 12 },
      }),
    [tokens],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <View style={styles.badge}>
        <Text style={styles.text}>{label}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

export default function ChatGroupStarredMessagesScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };

  const [starred, setStarred] = useState<ChatStarredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesRef = useRef<ChatMessageType[]>([]);

  const loadStarred = useCallback(async () => {
    if (!user?.id) {
      setStarred([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await chatMessageService.getStarredMessages(user.id, groupId, {
        limit: 100,
      });

      if (error || !data) {
        setStarred([]);
        return;
      }

      setStarred(data.filter((row) => !!row.message));
    } catch (error) {
      logger.error('StarredMessages', 'Failed to load starred messages', error);
      setStarred([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, groupId]);

  useEffect(() => {
    void loadStarred();
  }, [loadStarred]);

  const messages = useMemo(() => {
    const rows = starred
      .map((row) => row.message)
      .filter((msg): msg is ChatMessageType => !!msg)
      .map((msg) => ({ ...msg, is_starred_by_me: true }));

    rows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return rows;
  }, [starred]);

  messagesRef.current = messages;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleOpenMessage = useCallback(
    (messageId: string) => {
      void HapticFeedback.selection();
      (navigation as any).navigate('ChatGroup', { groupId, scrollToMessageId: messageId });
    },
    [navigation, groupId],
  );

  const handleUnstar = useCallback(
    async (messageId: string) => {
      if (!user?.id) return;
      void HapticFeedback.impactLight();

      setStarred((prev) => prev.filter((row) => row.message_id !== messageId));
      const { error } = await chatMessageService.unstarMessage(messageId, user.id);
      if (error) {
        logger.error('StarredMessages', 'Failed to unstar message', error);
        void loadStarred();
      }
    },
    [user?.id, loadStarred],
  );

  const shouldShowDateDivider = useCallback(
    (currentMessage: ChatMessageType, olderMessage: ChatMessageType | null): boolean => {
      if (!olderMessage) return true;
      return !isSameDay(new Date(currentMessage.created_at), new Date(olderMessage.created_at));
    },
    [],
  );

  const formatDateDivider = useCallback((date: Date): string => {
    if (isToday(date)) return 'היום';
    if (isYesterday(date)) return 'אתמול';
    return format(date, 'd בMMMM yyyy', { locale: he });
  }, []);

  const handleMessageLongPress = useCallback(
    (message: ChatMessageType) => {
      void HapticFeedback.impactLight();
      legacyAlert('הודעה מסומנת', undefined, [
        { text: 'פתח בצ\'אט', onPress: () => handleOpenMessage(message.id) },
        { text: 'הסר כוכב', style: 'destructive', onPress: () => void handleUnstar(message.id) },
        { text: 'ביטול', style: 'cancel' },
      ]);
    },
    [handleOpenMessage, handleUnstar],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      const isMe = item.sender_id === user?.id;
      const list = messagesRef.current;
      const olderMessage = index < list.length - 1 ? list[index + 1] : null;
      const newerMessage = index > 0 ? list[index - 1] : null;
      const showSenderName = !isMe && (!olderMessage || olderMessage.sender_id !== item.sender_id);
      const showAvatar = !isMe && (!newerMessage || newerMessage.sender_id !== item.sender_id);
      const isAfterSenderChange = !!olderMessage && olderMessage.sender_id !== item.sender_id;
      const showDivider = shouldShowDateDivider(item, olderMessage);

      return (
        <View>
          {showDivider ? (
            <DateDivider label={formatDateDivider(new Date(item.created_at))} />
          ) : null}
          <ChatMessage
            message={item}
            isMe={isMe}
            showAvatar={showAvatar}
            showSenderName={showSenderName}
            isAfterSenderChange={isAfterSenderChange}
            onPress={() => handleOpenMessage(item.id)}
            onLongPress={() => handleMessageLongPress(item)}
            onReply={() => handleOpenMessage(item.id)}
            onJumpToMessage={handleOpenMessage}
          />
        </View>
      );
    },
    [
      user?.id,
      shouldShowDateDivider,
      formatDateDivider,
      handleOpenMessage,
      handleMessageLongPress,
    ],
  );

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="הודעות מסומנות" onBack={handleBack} />

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
            <Text style={styles.loadingText}>טוען הודעות מסומנות...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerContent}>
            <Ionicons name="star-outline" size={48} color={DesignTokens.colors.text.secondary} />
            <Text style={styles.emptyTitle}>אין הודעות מסומנות</Text>
            <Text style={styles.emptySubtitle}>
              סמן הודעות בכוכב מתוך הצ'אט כדי לראות אותן כאן
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={15}
            style={styles.list}
          />
        )}
      </SafeAreaView>
    </ChatScreenShell>
  );
}

const createStyles = (tokens: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    list: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    messagesList: {
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 12,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    loadingText: {
      marginTop: 8,
      color: tokens.colors.text.secondary,
      fontSize: 14,
      ...chatRtlText,
    },
    emptyTitle: {
      marginTop: 12,
      color: tokens.colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      ...chatRtlText,
    },
    emptySubtitle: {
      marginTop: 6,
      color: tokens.colors.text.secondary,
      fontSize: 13,
      textAlign: 'center',
      ...chatRtlText,
    },
  });
