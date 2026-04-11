import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Star, RefreshCw, XCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { useDesignTokens } from '../ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';

interface PinnedMessage {
  id: string;
  message_id: string;
  message_content: string;
  message_type: string;
  message_created_at: string;
  pinned_by: string;
  pinned_by_name: string;
  pinned_at: string;
}

interface PinnedMessagesHeaderProps {
  channelId: string;
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

export default function PinnedMessagesHeader({ channelId, onMessagePress }: PinnedMessagesHeaderProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (channelId) {
      loadPinnedMessages();
    }
  }, [channelId]);

  const loadPinnedMessages = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_pinned_messages', { channel_uuid: channelId });

      if (!isMountedRef.current) return;
      
      if (error) {
        logger.error('PinnedMessagesHeader', 'Error loading pinned messages', error);
        return;
      }
      
      setPinnedMessages(data || []);
    } catch (error) {
      logger.error('PinnedMessagesHeader', 'Failed to load pinned messages', error);
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', channelId)
        .eq('message_id', messageId);
      
      if (error) {
        Alert.alert('שגיאה', 'לא ניתן להסיר את ההצמדה');
        return;
      }
      
      // Reload pinned messages
      await loadPinnedMessages();
      Alert.alert('הצלחה', 'ההודעה הוסרה מההצמדה');
      
      // Notify parent component about the change
      onMessagePress?.('refresh_pinned');
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בהסרת ההצמדה');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'עכשיו';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `לפני ${minutes} דקות`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `לפני ${hours} שעות`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `לפני ${days} ימים`;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'videocam';
      case 'audio':
      case 'voice':
        return 'mic';
      case 'file':
      case 'document':
        return 'document';
      case 'poll':
        return 'list';
      default:
        return 'chatbubble';
    }
  };

  if (pinnedMessages.length === 0) {
    return null;
  }

  const displayMessages = isExpanded ? pinnedMessages : pinnedMessages.slice(0, 2);
  const starColor = DesignTokens.colors.text.warning;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Star size={20} color={starColor} strokeWidth={2} />
          <Text style={styles.headerTitle}>
            הודעות מוצמדות ({pinnedMessages.length})
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandHit}
          >
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={DesignTokens.colors.text.tertiary} 
            />
          </Pressable>
          
          <Pressable onPress={loadPinnedMessages}>
            <RefreshCw size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Pinned Messages */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollRow}
      >
        {displayMessages.map((pinnedMsg) => (
          <View 
            key={pinnedMsg.id}
            style={[
              styles.card,
              { backgroundColor: DesignTokens.colors.background.secondary },
            ]}
          >
            {/* Message Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons 
                  name={getMessageIcon(pinnedMsg.message_type) as any} 
                  size={16} 
                  color={DesignTokens.colors.accent.main} 
                />
                <Text style={styles.pinnedByText}>
                  {pinnedMsg.pinned_by_name}
                </Text>
              </View>
              
              <Pressable
                onPress={() => handleUnpinMessage(pinnedMsg.message_id)}
                style={styles.unpinHit}
              >
                <XCircle size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Message Content */}
            <Pressable
              onPress={() => onMessagePress?.(pinnedMsg.message_id)}
              style={styles.messagePreview}
            >
              <Text 
                style={styles.messageBody} 
                numberOfLines={2}
              >
                {pinnedMsg.message_content}
              </Text>
            </Pressable>

            {/* Message Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>
                {formatTimeAgo(pinnedMsg.pinned_at)}
              </Text>
              
              <View style={styles.metaRow}>
                <Star size={12} color={starColor} strokeWidth={2} />
                <Text style={styles.metaLabel}>
                  מוצמד
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Show More/Less Button */}
      {pinnedMessages.length > 2 && (
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          style={styles.showMoreWrap}
        >
          <Text style={styles.showMoreText}>
            {isExpanded ? 'הצג פחות' : `הצג עוד ${pinnedMessages.length - 2} הודעות`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
