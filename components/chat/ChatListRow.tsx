import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChatMessage from './ChatMessage';
import UnreadDivider from './UnreadDivider';
import { useDesignTokens } from '../ui/DesignTokens';
import type { ChatMessage as ChatMessageType } from '../../types/chat.types';

const DateDivider = memo(function DateDivider({ label }: { label: string }) {
  const tokens = useDesignTokens();
  const styles = React.useMemo(
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
});

export type ChatListRowProps = {
  message: ChatMessageType;
  isMe: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  isAfterSenderChange: boolean;
  showDateDivider: boolean;
  dateDividerLabel: string;
  showUnreadDivider: boolean;
  unreadCount: number;
  isHighlighted: boolean;
  onLayout: (height: number) => void;
  onLongPress: () => void;
  onReply: () => void;
  onReactionPress: (emoji: string) => void;
  onReactionDetailsPress: () => void;
  onJumpToMessage: (messageId: string) => void;
  onRetry?: () => void;
  onStatusPress?: () => void;
  onUnreadDividerPress: () => void;
};

function ChatListRow({
  message,
  isMe,
  showAvatar,
  showSenderName,
  isAfterSenderChange,
  showDateDivider,
  dateDividerLabel,
  showUnreadDivider,
  unreadCount,
  isHighlighted,
  onLayout,
  onLongPress,
  onReply,
  onReactionPress,
  onReactionDetailsPress,
  onJumpToMessage,
  onRetry,
  onStatusPress,
  onUnreadDividerPress,
}: ChatListRowProps) {
  return (
    <View onLayout={(e) => onLayout(e.nativeEvent.layout.height)}>
      {showDateDivider ? <DateDivider label={dateDividerLabel} /> : null}
      {showUnreadDivider ? (
        <UnreadDivider unreadCount={unreadCount} onPress={onUnreadDividerPress} />
      ) : null}
      <ChatMessage
        message={message}
        isMe={isMe}
        showAvatar={showAvatar}
        showSenderName={showSenderName}
        isAfterSenderChange={isAfterSenderChange}
        onLongPress={onLongPress}
        onReply={onReply}
        onReactionPress={onReactionPress}
        onReactionDetailsPress={onReactionDetailsPress}
        onJumpToMessage={onJumpToMessage}
        onRetry={onRetry}
        onStatusPress={onStatusPress}
        isHighlighted={isHighlighted}
      />
    </View>
  );
}

export default memo(ChatListRow, (prev, next) => {
  if (prev.message !== next.message) {
    if (prev.message.id !== next.message.id) return false;
    const a = prev.message;
    const b = next.message;
    if (
      a.content !== b.content ||
      a.is_edited !== b.is_edited ||
      a.is_deleted !== b.is_deleted ||
      a.is_sending !== b.is_sending ||
      a.send_error !== b.send_error ||
      a.read_by_count !== b.read_by_count ||
      a.reactions_count !== b.reactions_count ||
      JSON.stringify(a.reactions) !== JSON.stringify(b.reactions)
    ) {
      return false;
    }
  }
  return (
    prev.isMe === next.isMe &&
    prev.showAvatar === next.showAvatar &&
    prev.showSenderName === next.showSenderName &&
    prev.isAfterSenderChange === next.isAfterSenderChange &&
    prev.showDateDivider === next.showDateDivider &&
    prev.dateDividerLabel === next.dateDividerLabel &&
    prev.showUnreadDivider === next.showUnreadDivider &&
    prev.unreadCount === next.unreadCount &&
    prev.isHighlighted === next.isHighlighted
  );
});
