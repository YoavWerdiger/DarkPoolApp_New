// ============================================
// Chat Group Card Component
// ============================================
// כרטיס קבוצה ברשימת הקבוצות
// ============================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatGroup } from '../../types/chat.types';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChatGroupCardProps {
  group: ChatGroup;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function ChatGroupCard({ group, onPress, onLongPress }: ChatGroupCardProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const hasUnread = (group.unread_count || 0) > 0;
  const hasMentions = (group.mentioned_count || 0) > 0;

  const timeText = group.last_message_at
    ? formatDistanceToNow(new Date(group.last_message_at), {
        addSuffix: false,
        locale: he,
      })
    : '';

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
        {/* Unread Badge */}
        {hasUnread && (
          <View style={[styles.badge, hasMentions && styles.mentionBadge]}>
            <Text style={styles.badgeText}>
              {group.unread_count! > 99 ? '99+' : group.unread_count}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top Row */}
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

        {/* Bottom Row */}
        <View style={styles.bottomRow}>
          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {group.last_message_preview || 'אין הודעות'}
          </Text>
          {hasMentions && (
            <View style={styles.mentionIndicator}>
              <Text style={styles.mentionText}>@</Text>
            </View>
          )}
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
    padding: 16,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  mentionBadge: {
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: tokens.colors.text.primary,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
    marginLeft: 8,
  },
  timeUnread: {
    color: tokens.colors.accent.primary,
    fontWeight: '600',
  },
  
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.text.secondary,
  },
  lastMessageUnread: {
    color: tokens.colors.text.primary,
    fontWeight: '500',
  },
  
  mentionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  mentionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

