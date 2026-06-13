import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Star, RefreshCw, XCircle } from 'lucide-react-native';
import { logger } from '../../utils/logger';
import { useDesignTokens } from '../ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import {
  getChatPinnedMessages,
  unpinChatMessage,
  type ChatPinnedMessage,
} from '../../services/chat/chatPinnedService';

interface PinnedMessagesHeaderProps {
  groupId: string;
  refreshKey?: number;
  onMessagePress?: (messageId: string) => void;
}

const createStyles = (tokens: any) =>
  StyleSheet.create({
    root: {
      backgroundColor: tokens.colors.background.cardSolid,
      borderBottomWidth: tokens.layout.borderWidth.normal,
      borderBottomColor: tokens.colors.border.main,
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: tokens.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      color: tokens.colors.text.primary,
      fontWeight: tokens.typography.fontWeight.bold,
      fontSize: tokens.typography.fontSize.base,
      marginRight: tokens.spacing.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    expandHit: {
      marginRight: tokens.spacing.md,
    },
    card: {
      borderRadius: tokens.borderRadius.xl,
      padding: tokens.spacing.md,
      marginRight: tokens.spacing.md,
      minWidth: 200,
      maxWidth: 250,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pinnedByText: {
      fontSize: tokens.typography.fontSize.xs,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: tokens.colors.primary.main,
      marginRight: tokens.spacing.sm,
    },
    unpinHit: {
      padding: tokens.spacing.xs,
    },
    messagePreview: {
      marginBottom: tokens.spacing.sm,
    },
    messageBody: {
      lineHeight: 18,
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'right',
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metaText: {
      color: tokens.colors.text.secondary,
      fontSize: tokens.typography.fontSize.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaLabel: {
      color: tokens.colors.text.secondary,
      fontSize: tokens.typography.fontSize.xs,
      marginRight: tokens.spacing.xs,
    },
    showMoreWrap: {
      marginTop: tokens.spacing.md,
      alignItems: 'center',
    },
    showMoreText: {
      color: tokens.colors.primary.main,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.semibold,
    },
    scrollRow: {
      flexDirection: 'row',
    },
  });

export default function PinnedMessagesHeader({ groupId, refreshKey = 0, onMessagePress }: PinnedMessagesHeaderProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<ChatPinnedMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadPinnedMessages = useCallback(async (force = false) => {
    if (!groupId) return;
    try {
      const { data, error } = await getChatPinnedMessages(groupId, { force });
      if (!isMountedRef.current) return;
      if (error) {
        logger.error('PinnedMessagesHeader', 'Error loading pinned messages', error);
        return;
      }
      setPinnedMessages(data);
    } catch (error) {
      logger.error('PinnedMessagesHeader', 'Failed to load pinned messages', error);
    }
  }, [groupId]);

  useEffect(() => {
    void loadPinnedMessages(refreshKey > 0);
  }, [groupId, refreshKey, loadPinnedMessages]);

  const handleUnpinMessage = async (messageId: string) => {
    if (!user?.id) return;

    try {
      const { success, error } = await unpinChatMessage(groupId, messageId);
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן להסיר את ההצמדה');
        return;
      }

      await loadPinnedMessages();
      onMessagePress?.('refresh_pinned');
    } catch {
      legacyAlert('שגיאה', 'שגיאה בהסרת ההצמדה');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);

    if (diffInSeconds < 60) return 'עכשיו';
    if (diffInSeconds < 3600) return `לפני ${Math.floor(diffInSeconds / 60)} דקות`;
    if (diffInSeconds < 86400) return `לפני ${Math.floor(diffInSeconds / 3600)} שעות`;
    return `לפני ${Math.floor(diffInSeconds / 86400)} ימים`;
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return 'image';
      case 'video': return 'videocam';
      case 'audio':
      case 'voice': return 'mic';
      case 'file':
      case 'document': return 'document';
      case 'poll': return 'list';
      case 'trade': return 'trending-up';
      default: return 'chatbubble';
    }
  };

  if (pinnedMessages.length === 0) {
    return null;
  }

  const displayMessages = isExpanded ? pinnedMessages : pinnedMessages.slice(0, 2);
  const starColor = DesignTokens.colors.text.warning;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Star size={20} color={starColor} strokeWidth={2} />
          <Text style={styles.headerTitle}>
            הודעות מוצמדות ({pinnedMessages.length})
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.expandHit}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={DesignTokens.colors.text.tertiary}
            />
          </Pressable>
          <Pressable onPress={loadPinnedMessages}>
            <RefreshCw size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {displayMessages.map((pinnedMsg) => (
          <View
            key={pinnedMsg.id}
            style={[styles.card, { backgroundColor: DesignTokens.colors.background.secondary }]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons
                  name={getMessageIcon(pinnedMsg.message_type) as any}
                  size={16}
                  color={DesignTokens.colors.accent.main}
                />
                <Text style={styles.pinnedByText}>{pinnedMsg.pinned_by_name}</Text>
              </View>
              <Pressable onPress={() => handleUnpinMessage(pinnedMsg.message_id)} style={styles.unpinHit}>
                <XCircle size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <Pressable onPress={() => onMessagePress?.(pinnedMsg.message_id)} style={styles.messagePreview}>
              <Text style={styles.messageBody} numberOfLines={2}>
                {pinnedMsg.message_content}
              </Text>
            </Pressable>

            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>{formatTimeAgo(pinnedMsg.pinned_at)}</Text>
              <View style={styles.metaRow}>
                <Star size={12} color={starColor} strokeWidth={2} />
                <Text style={styles.metaLabel}>מוצמד</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {pinnedMessages.length > 2 && (
        <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.showMoreWrap}>
          <Text style={styles.showMoreText}>
            {isExpanded ? 'הצג פחות' : `הצג עוד ${pinnedMessages.length - 2} הודעות`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
