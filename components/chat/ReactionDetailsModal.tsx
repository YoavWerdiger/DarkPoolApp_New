import { useDesignTokens } from "../ui/DesignTokens";
import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { User } from 'lucide-react-native';
import { ReactionDetail } from '../../services/supabase';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ReactionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
}

const ReactionDetailsModal: React.FC<ReactionDetailsModalProps> = memo(({
  visible,
  onClose,
  messageId
}) => {
  const DesignTokens = useDesignTokens();
  const [reactionDetails, setReactionDetails] = useState<ReactionDetail[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(false);

  // טעינת פירוט הריאקציות
  useEffect(() => {
    if (visible && messageId) {
      loadReactionDetails();
    }
  }, [visible, messageId]);

  const loadReactionDetails = async () => {
    setLoading(true);
    try {
      const ChatService = await import('../../services/chatService');
      const details = await ChatService.ChatService.getReactionDetails(messageId);
      setReactionDetails(details);
    } catch (error) {
      console.error('❌ ReactionDetailsModal: Error loading reaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  // קבלת כל סוגי הריאקציות
  const reactionTypes = useMemo(() => reactionDetails.map(r => r.emoji), [reactionDetails]);
  const allReactions = useMemo(() => reactionDetails.flatMap(r => 
    r.user_ids.map((userId, index) => ({
      emoji: r.emoji,
      userId,
      userName: r.user_names[index] || 'משתמש לא ידוע'
    }))
  ), [reactionDetails]);

  // סינון לפי טאב נבחר
  const filteredReactions = useMemo(() => selectedTab === 'all' 
    ? allReactions 
    : allReactions.filter(r => r.emoji === selectedTab)
  , [allReactions, selectedTab]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: DesignTokens.spacing.md,
    },
    header: {
      alignItems: 'center',
      paddingTop: DesignTokens.spacing.sm,
      paddingBottom: DesignTokens.spacing.md,
    },
    title: {
      color: DesignTokens.colors.text.primary,
      fontSize: 17,
      fontWeight: '600',
      textAlign: 'center',
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: DesignTokens.colors.background.secondary,
      borderRadius: 30,
      padding: 4,
      alignSelf: 'center',
      marginBottom: DesignTokens.spacing.md,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      height: 36,
      borderRadius: 18,
      gap: 6,
      overflow: 'hidden',
    },
    tabActive: {
      backgroundColor: DesignTokens.colors.primary.main + '14',
    },
    tabInactive: {
      backgroundColor: 'transparent',
    },
    tabEmoji: {
      fontSize: 15,
    },
    tabText: {
      fontSize: 14,
    },
    tabTextActive: {
      fontWeight: '700',
      color: DesignTokens.colors.primary.main,
    },
    tabTextInactive: {
      fontWeight: '600',
      color: DesignTokens.colors.text.secondary,
    },
    usersContainer: {
      minHeight: 200,
    },
    userRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: DesignTokens.spacing.sm,
    },
    userAvatar: {
      width: 40,
      height: 40,
      backgroundColor: DesignTokens.colors.primary.main + '15',
      borderRadius: 20,
      marginLeft: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userName: {
      color: DesignTokens.colors.text.primary,
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      textAlign: 'right',
    },
    userEmoji: {
      fontSize: 24,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 15,
      textAlign: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    loadingText: {
      color: DesignTokens.colors.text.secondary,
      marginTop: 12,
      fontSize: 15,
    },
  }), [DesignTokens]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.5]}
      showHandle={true}
      enablePanDownToClose={true}
      useModal={true}
      backdropOpacity={0.15}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ריאקציות</Text>
        </View>

        {/* Tabs - בסגנון האפליקציה */}
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => setSelectedTab('all')}
            style={[
              styles.tab,
              selectedTab === 'all' ? styles.tabActive : styles.tabInactive,
            ]}
          >
            <Text style={[
              styles.tabText,
              selectedTab === 'all' ? styles.tabTextActive : styles.tabTextInactive
            ]}>
              הכל {allReactions.length}
            </Text>
          </Pressable>
          
          {reactionTypes.map(emoji => (
            <Pressable
              key={emoji}
              onPress={() => setSelectedTab(emoji)}
              style={[
                styles.tab,
                selectedTab === emoji ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text style={styles.tabEmoji}>{emoji}</Text>
              <Text style={[
                styles.tabText,
                selectedTab === emoji ? styles.tabTextActive : styles.tabTextInactive
              ]}>
                {reactionDetails.find(r => r.emoji === emoji)?.count}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content - גובה קבוע כדי למנוע קפיצות */}
        <View style={styles.usersContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={styles.loadingText}>טוען...</Text>
            </View>
          ) : filteredReactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>אין ריאקציות</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredReactions.map((item, index) => (
                <View key={`${item.userId}-${item.emoji}-${index}`} style={styles.userRow}>
                  <View style={styles.userAvatar}>
                    <User size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                  </View>
                  <Text style={styles.userName}>{item.userName}</Text>
                  <Text style={styles.userEmoji}>{item.emoji}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </BottomSheet>
  );
});

export default ReactionDetailsModal;
