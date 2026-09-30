import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { supabase } from '../../services/supabase';
import type { Trade } from './tradeTypes';
import { getChatGroups } from '../../services/chat/chatGroupService';
import { sendChatMessage } from '../../services/chat/chatMessageService';
import { ChatMessageType } from '../../types/chat.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
  journalRow,
  journalRtlContent,
  journalSectionTitleStyle,
} from './journalLayout';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';

interface ShareTradeModalProps {
  trade: Trade | null;
  visible: boolean;
  onClose: () => void;
}

type ChatGroupRow = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

export default function ShareTradeModal({ trade, visible, onClose }: ShareTradeModalProps) {
  const DesignTokens = useDesignTokens();
  const [chatGroups, setChatGroups] = useState<ChatGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  useEffect(() => {
    if (visible && trade) {
      void loadChatGroups();
    } else {
      setChatGroups([]);
      setLoading(false);
    }
  }, [visible, trade]);

  const loadChatGroups = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        legacyAlert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      const { data: groups, error } = await getChatGroups(user.id);
      if (error) {
        legacyAlert('שגיאה', error.message || 'לא ניתן לטעון קבוצות');
        return;
      }

      const rows: ChatGroupRow[] = (groups || []).map((g: any) => ({
        id: g.id,
        name: g.name || 'קבוצה',
        avatar_url: g.avatar_url,
      }));
      setChatGroups(rows);
    } catch {
      legacyAlert('שגיאה', 'שגיאה בטעינת קבוצות');
    } finally {
      setLoading(false);
    }
  };

  const shareToGroup = async (groupId: string, groupName: string) => {
    if (!trade) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        legacyAlert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      const tradePayload = {
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        quantity: trade.quantity,
        entry_date: trade.entry_date,
        exit_date: trade.exit_date,
        pnl: trade.pnl,
        return_percentage: trade.return_percentage,
        notes: trade.notes,
        tags: trade.tags,
      };

      const content = JSON.stringify({ trade: tradePayload });

      const { data: sent, error } = await sendChatMessage(
        {
          group_id: groupId,
          message_type: ChatMessageType.TRADE,
          content,
        },
        user.id
      );

      if (error || !sent) {
        legacyAlert('שגיאה', error?.message || 'לא ניתן לשתף לקבוצה');
        return;
      }

      legacyAlert('הצלחה', `הטרייד שותף לקבוצה "${groupName}"`);
      onClose();
    } catch {
      legacyAlert('שגיאה', 'לא ניתן לשתף לקבוצה');
    }
  };

  if (!trade || !visible) {
    return null;
  }

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.6, 0.9]}
      enablePanDownToClose={true}
      showHandle={true}
      showBrandBackground={false}
      useGlassBackground
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>שתף טרייד לצ׳אט</Text>
          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.impactLight();
              onClose();
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={DesignTokens.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tradePreview}>
          <View style={styles.tradePreviewHeader}>
            <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
            <View
              style={[
                styles.directionBadge,
                {
                  backgroundColor:
                    trade.direction === 'long'
                      ? `${DesignTokens.colors.primary.main}20`
                      : `${DesignTokens.colors.text.danger}20`,
                },
              ]}
            >
              <Text
                style={[
                  styles.directionText,
                  {
                    color:
                      trade.direction === 'long'
                        ? DesignTokens.colors.primary.main
                        : DesignTokens.colors.text.danger,
                  },
                ]}
              >
                {trade.direction === 'long' ? 'Long' : 'Short'}
              </Text>
            </View>
          </View>
          <Text style={styles.tradePnl}>P&L: ${trade.pnl.toFixed(2)}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={styles.loadingText}>טוען קבוצות...</Text>
          </View>
        ) : chatGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.tertiary} />
            <Text style={styles.emptyText}>אין קבוצות זמינות</Text>
            <Text style={styles.emptySubtext}>הצטרף לקבוצת צ׳אט כדי לשתף טריידים</Text>
          </View>
        ) : (
          <FlatList
            data={chatGroups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.groupItem}
                onPress={() => {
                  void HapticFeedback.medium();
                  shareToGroup(item.id, item.name);
                }}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.groupAvatar} />
                ) : (
                  <View style={styles.groupAvatarPlaceholder}>
                    <Ionicons name="people" size={24} color={DesignTokens.colors.text.primary} />
                  </View>
                )}
                <Text style={styles.groupName}>{item.name}</Text>
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
      ...journalRtlContent,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: tokens.layout.screenPadding,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.divider,
    },
    title: {
      ...journalSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    closeButton: {
      padding: tokens.spacing.xs,
    },
    tradePreview: {
      backgroundColor: tokens.colors.background.cardSolid,
      marginHorizontal: tokens.layout.screenPadding,
      marginVertical: JOURNAL_LAYOUT.cardStackGap,
      padding: JOURNAL_LAYOUT.cardPadding,
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
    },
    tradePreviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    tradeSymbol: {
      ...journalCardTitleStyle,
      flex: 1,
      width: undefined,
      color: tokens.colors.text.primary,
    },
    directionBadge: {
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: 4,
      borderRadius: tokens.borderRadius.sm,
    },
    directionText: {
      fontSize: JOURNAL_TYPE.caption2.fontSize,
      fontWeight: tokens.typography.fontWeight.bold,
      lineHeight: JOURNAL_TYPE.caption2.lineHeight,
    },
    tradePnl: {
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.body.fontSize,
      fontWeight: JOURNAL_TYPE.body.fontWeight,
      lineHeight: JOURNAL_TYPE.body.lineHeight,
      color: tokens.colors.primary.main,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    loadingText: {
      ...journalBodyTextStyle,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.xl,
      gap: tokens.spacing.md,
    },
    emptyText: {
      ...journalSectionTitleStyle,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    emptySubtext: {
      ...journalBodyTextStyle,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    listContent: {
      padding: tokens.spacing.md,
      paddingBottom: tokens.spacing['3xl'],
    },
    groupItem: {
      ...journalRow,
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
      backgroundColor: tokens.colors.background.cardSolid,
      borderRadius: UI_CARD_RADIUS,
      marginBottom: JOURNAL_LAYOUT.cardStackGap,
      borderWidth: 0,
    },
    groupAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginLeft: 12,
    },
    groupAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginLeft: 12,
      backgroundColor: tokens.colors.background.tertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupName: {
      flex: 1,
      ...journalBodyTextStyle,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.primary,
    },
  });
