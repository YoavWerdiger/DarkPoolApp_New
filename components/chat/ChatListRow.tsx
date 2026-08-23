import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import ChatMessage from './ChatMessage';
import UnreadDivider from './UnreadDivider';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import type { ChatMessage as ChatMessageType } from '../../types/chat.types';

const DateDivider = memo(function DateDivider({ label }: { label: string }) {
  const tokens = useDesignTokens();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 },
        line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
        badge: {
          borderRadius: 14,
          marginHorizontal: 10,
          overflow: 'hidden',
        },
        badgeInner: {
          paddingHorizontal: 14,
          paddingVertical: 5,
        },
        text: { color: tokens.colors.text.secondary, fontSize: 12 },
      }),
    [tokens],
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <UICard
        variant="glass"
        glassIntensity="subtle"
        padding="none"
        style={styles.badge}
        contentContainerStyle={styles.badgeInner}
      >
        <Text style={styles.text}>{label}</Text>
      </UICard>
      <View style={styles.line} />
    </View>
  );
});

export type ChatListRowProps = {
  message: ChatMessageType;
  animateEntrance?: boolean;
  isMe: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  isAfterSenderChange: boolean;
  showDateDivider: boolean;
  dateDividerLabel: string;
  showUnreadDivider: boolean;
  unreadCount: number;
  unreadDividerDismissing?: boolean;
  onUnreadDividerDismissed?: () => void;
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
  boldText?: boolean;
};

function ChatListRow({
  message,
  animateEntrance = false,
  isMe,
  showAvatar,
  showSenderName,
  isAfterSenderChange,
  showDateDivider,
  dateDividerLabel,
  showUnreadDivider,
  unreadCount,
  unreadDividerDismissing = false,
  onUnreadDividerDismissed,
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
  boldText = false,
}: ChatListRowProps) {
  // אנימציית כניסה עדינה להודעות חדשות: fade + החלקה מלמטה.
  // מריצים פעם אחת בלבד ב-mount; הרשימה הפוכה עם double scaleY(-1)
  // (על ה-ScrollView ועל כל תא) ולכן translateY חיובי = למטה, כמו בתצוגה רגילה.
  const enterAnim = useRef(new Animated.Value(animateEntrance ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animateEntrance ? 14 : 0)).current;

  useEffect(() => {
    if (!animateEntrance) return;
    Animated.parallel([
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
      style={{ opacity: enterAnim, transform: [{ translateY: slideAnim }] }}
    >
      {showDateDivider ? <DateDivider label={dateDividerLabel} /> : null}
      {showUnreadDivider ? (
        <UnreadDivider
          unreadCount={unreadCount}
          onPress={onUnreadDividerPress}
          dismissing={unreadDividerDismissing}
          onDismissed={onUnreadDividerDismissed}
        />
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
        boldText={boldText}
      />
    </Animated.View>
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
    prev.unreadDividerDismissing === next.unreadDividerDismissing &&
    prev.isHighlighted === next.isHighlighted &&
    prev.boldText === next.boldText
  );
});
