// ============================================
// Chat Group Pinned Messages Screen
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';
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

export default function ChatGroupPinnedMessagesScreen() {
  const DesignTokens = useDesignTokens();
  const styles = createStyles(DesignTokens);
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();

  const { groupId } = route.params as { groupId: string };

  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPinnedMessages();
  }, [groupId]);

  const loadPinnedMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_pinned_messages', { channel_uuid: groupId });

      if (error) {
        console.error('❌ Error loading pinned messages:', error);
        return;
      }

      setPinnedMessages(data || []);
    } catch (error) {
      console.error('❌ Exception loading pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleUnpin = async (messageId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', groupId)
        .eq('message_id', messageId);

      if (error) {
        console.error('❌ Error unpinning message:', error);
        Alert.alert('שגיאה', 'לא ניתן להסיר את ההצמדה');
        return;
      }

      await loadPinnedMessages();
      Alert.alert('הצלחה', 'ההודעה הוסרה מההצמדה');
    } catch (error) {
      console.error('❌ Exception unpinning message:', error);
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

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>הודעות מוצמדות</Text>
            <View style={{ width: 32 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
              <Text style={styles.loadingText}>טוען הודעות מוצמדות...</Text>
            </View>
          ) : pinnedMessages.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons name="star-outline" size={40} color={DesignTokens.colors.text.secondary} />
              <Text style={styles.emptyTitle}>אין הודעות מוצמדות בקבוצה זו</Text>
              <Text style={styles.emptySubtitle}>תוכל להצמיד הודעה מתוך מסך הצ'אט בלחיצה ארוכה</Text>
            </View>
          ) : (
            pinnedMessages.map((msg) => (
              <View key={msg.id} style={styles.pinnedCard}>
                <View style={styles.pinnedHeader}>
                  <View style={styles.pinnedHeaderLeft}>
                    <Ionicons
                      name={msg.message_type === 'image' ? 'image' : msg.message_type === 'video' ? 'videocam' : 'chatbubble'}
                      size={18}
                      color={DesignTokens.colors.accent.main}
                    />
                    <Text style={styles.pinnedByText}>{msg.pinned_by_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleUnpin(msg.message_id)}>
                    <Ionicons name="close-circle" size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.messageContent} numberOfLines={3}>
                  {msg.message_content}
                </Text>

                <View style={styles.pinnedFooter}>
                  <Text style={styles.timeText}>{formatTimeAgo(msg.pinned_at)}</Text>
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="star" size={12} color={DesignTokens.colors.warning.main} />
                    <Text style={styles.pinnedBadgeText}>מוצמד</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (tokens: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    headerCard: {
      marginHorizontal: 0,
      marginTop: 0,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomLeftRadius: tokens.borderRadius['2xl'],
      borderBottomRightRadius: tokens.borderRadius['2xl'],
      backgroundColor: 'rgba(10, 24, 16, 0.9)',
      borderBottomWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      padding: 6,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 32,
      gap: 12,
    },
    centerContent: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 40,
      paddingHorizontal: 24,
    },
    loadingText: {
      marginTop: 8,
      color: tokens.colors.text.secondary,
      fontSize: 14,
    },
    emptyTitle: {
      marginTop: 12,
      color: tokens.colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptySubtitle: {
      marginTop: 6,
      color: tokens.colors.text.secondary,
      fontSize: 13,
      textAlign: 'center',
    },
    pinnedCard: {
      backgroundColor: 'rgba(10, 24, 16, 0.9)',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    pinnedHeader: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    pinnedHeaderLeft: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
    },
    pinnedByText: {
      color: tokens.colors.primary.main,
      fontSize: 14,
      fontWeight: '600',
    },
    messageContent: {
      color: tokens.colors.text.primary,
      fontSize: 14,
      textAlign: 'right',
      marginBottom: 8,
    },
    pinnedFooter: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timeText: {
      color: tokens.colors.text.secondary,
      fontSize: 12,
    },
    pinnedBadge: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 4,
    },
    pinnedBadgeText: {
      color: tokens.colors.text.secondary,
      fontSize: 12,
    },
  });
