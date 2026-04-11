import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { supabase } from '../../services/supabase';
import { Trade } from './TradesListTab';

interface ShareTradeModalProps {
  trade: Trade | null;
  visible: boolean;
  onClose: () => void;
}

export default function ShareTradeModal({ trade, visible, onClose }: ShareTradeModalProps) {
  const DesignTokens = useDesignTokens();
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  useEffect(() => {
    if (visible && trade) {
      loadChatGroups();
    } else {
      setChatGroups([]);
      setLoading(false);
    }
  }, [visible, trade]);

  const loadChatGroups = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (memberError) {
        Alert.alert('שגיאה', 'לא ניתן לטעון קבוצות');
        return;
      }

      const channelIds = memberRows?.map(row => row.channel_id) || [];

      if (channelIds.length > 0) {
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .in('id', channelIds)
          .order('name');

        if (channelsError) {
          Alert.alert('שגיאה', 'לא ניתן לטעון פרטי קבוצות');
          return;
        }

        setChatGroups(channels || []);
      } else {
        setChatGroups([]);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בטעינת קבוצות');
    } finally {
      setLoading(false);
    }
  };

  const shareToGroup = async (groupId: string, groupName: string) => {
    if (!trade) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      // יצירת אובייקט הטרייד המלא
      const tradeData = {
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

      // שליחת הודעת טרייד מיוחדת לקבוצה
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: groupId,
          sender_id: user.id,
          content: `${trade.symbol} ${trade.direction === 'long' ? 'Long' : 'Short'}`,
          type: 'trade',
          trade_data: tradeData
        });

      if (error) {
        Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
        return;
      }

      Alert.alert('הצלחה', `הטרייד שותף לקבוצה "${groupName}"`);
      onClose();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
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
      backdropOpacity={0.5}
      showHandle={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>שתף טרייד</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={DesignTokens.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tradePreview}>
          <View style={styles.tradePreviewHeader}>
            <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
            <View style={[
              styles.directionBadge,
              { backgroundColor: trade.direction === 'long' 
                ? `${DesignTokens.colors.primary.main}20` 
                : `${DesignTokens.colors.text.danger}20` }
            ]}>
              <Text style={[
                styles.directionText,
                { color: trade.direction === 'long' 
                  ? DesignTokens.colors.primary.main 
                  : DesignTokens.colors.text.danger }
              ]}>
                {trade.direction === 'long' ? 'Long' : 'Short'}
              </Text>
            </View>
          </View>
          <Text style={styles.tradePnl}>
            P&L: ${trade.pnl.toFixed(2)}
          </Text>
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
            <Text style={styles.emptySubtext}>הצטרף לקבוצה כדי לשתף טריידים</Text>
          </View>
        ) : (
          <FlatList
            data={chatGroups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.groupItem}
                onPress={() => shareToGroup(item.id, item.name || 'קבוצה')}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.groupAvatar} />
                ) : (
                  <View style={styles.groupAvatarPlaceholder}>
                    <Ionicons name="people" size={24} color={DesignTokens.colors.text.secondary} />
                  </View>
                )}
                <Text style={styles.groupName}>{item.name || 'קבוצה ללא שם'}</Text>
                <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
  },
  title: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  closeButton: {
    padding: tokens.spacing.xs,
  },
  tradePreview: {
    backgroundColor: tokens.colors.background.tertiary,
    margin: tokens.spacing.lg,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
  },
  tradePreviewHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  tradeSymbol: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  directionBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
  },
  directionText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  tradePnl: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  loadingText: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  emptyText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    padding: tokens.spacing.md,
  },
  groupItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  groupAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    flex: 1,
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
});

