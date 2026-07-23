// ============================================
// Chat Group Card Component
// ============================================
// כרטיס קבוצה ברשימת הקבוצות
// ============================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { ChatGroup } from '../../types/chat.types';
import { getChatMessagePreview } from '../../utils/chatMessagePreview';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChatGroupCardProps {
  group: ChatGroup;
  onPress: () => void;
  onLongPress?: () => void;
}

function ChatGroupCard({ group, onPress, onLongPress }: ChatGroupCardProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const hasUnread = (group.unread_count || 0) > 0;
  const hasMentions = (group.mentioned_count || 0) > 0;

  const previewText = group.last_message_preview
    ? getChatMessagePreview(undefined, group.last_message_preview)
    : 'אין הודעות';
  const isRecordingPreview = previewText === 'הקלטה';

  const timeText = useMemo(() => {
    if (!group.last_message_at) return '';
    return formatDistanceToNow(new Date(group.last_message_at), {
      addSuffix: false,
      locale: he,
    });
  }, [group.last_message_at]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {group.avatar_url ? (
          <Image source={{ uri: group.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{group.name.charAt(0)}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top Row: Name + Time */}
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {group.is_muted && '🔇 '}
            {group.name}
          </Text>
          {timeText && (
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {timeText}
            </Text>
          )}
        </View>

        {/* Bottom Row: Message + Badge */}
        <View style={styles.bottomRow}>
          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {isRecordingPreview ? (
              <>
                <Ionicons
                  name="mic-outline"
                  size={14}
                  color={hasUnread ? DesignTokens.colors.text.primary : DesignTokens.colors.text.secondary}
                />{' '}
              </>
            ) : null}
            {previewText}
          </Text>
          
          {/* Badge & Mentions Area */}
          <View style={styles.badgesWrapper}>
            {hasMentions && (
              <View style={styles.mentionIndicator}>
                <Text style={styles.mentionText}>@</Text>
              </View>
            )}
            {hasUnread && (
              <View style={[styles.badge, hasMentions && styles.mentionBadge]}>
                <Text style={[styles.badgeText, hasMentions && styles.badgeTextOnMention]}>
                  {group.unread_count! > 99 ? '99+' : group.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: tokens.spacing.base ?? 16,
    paddingHorizontal: tokens.spacing.lg ?? 20,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border.divider,
    alignItems: 'center',
  },
  
  avatarContainer: {
    marginRight: tokens.spacing.md + 2,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.inverse,
  },
  
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs + 2,
  },
  name: {
    flex: 1,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: tokens.typography.label.size,
    color: tokens.colors.text.secondary,
    marginLeft: 8,
  },
  timeUnread: {
    color: tokens.colors.primary.main,
    fontWeight: '600',
  },
  
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // זה ידחוף את ה-Badge לקצה השני
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    marginRight: 8, // רווח מה-Badge
    textAlign: 'right',
  },
  lastMessageUnread: {
    color: tokens.colors.text.primary,
    fontWeight: '500',
  },
  
  badgesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  mentionBadge: {
    backgroundColor: tokens.colors.text.danger,
  },
  badgeText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.inverse,
  },
  badgeTextOnMention: {
    color: tokens.colors.text.primary,
  },
  
  mentionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.text.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mentionText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
  },
});

