import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { ChatBottomSheet } from './ChatBottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { PollService, PollOption } from '../../services/pollService';
import { logger } from '../../utils/logger';

interface PollVotesBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  pollId: string;
  pollOptions: PollOption[];
  pollQuestion: string;
}

interface VoterInfo {
  id: string;
  display_name: string;
  profile_picture?: string;
}

export default function PollVotesBottomSheet({
  visible,
  onClose,
  pollId,
  pollOptions,
  pollQuestion,
}: PollVotesBottomSheetProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const animatedClose = useBottomSheetClose();
  const [votersByOption, setVotersByOption] = useState<Record<string, VoterInfo[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && pollId) {
      loadVoters();
    } else {
      setVotersByOption({});
    }
  }, [visible, pollId]);

  const loadVoters = async () => {
    if (!pollId) return;
    setLoading(true);
    try {
      const voters = await PollService.getPollVoters(pollId);
      setVotersByOption(voters);
    } catch (error) {
      logger.error('PollVotesBottomSheet', 'Failed to load voters', error);
    } finally {
      setLoading(false);
    }
  };

  const getVotersForOption = (optionId: string): VoterInfo[] => {
    return votersByOption[optionId] || [];
  };

  const handleHeaderClose = () => {
    (animatedClose ?? onClose)();
  };

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.85]} showBrandWatermark={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={handleHeaderClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>פירוט הצבעות</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question} numberOfLines={3}>
            {pollQuestion}
          </Text>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={DesignTokens.colors.primary.main} size="large" />
            <Text style={styles.loadingText}>טוען פירוט הצבעות...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scroll} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pollOptions.length === 0 ? (
              <Text style={styles.noOptionsText}>אין אופציות</Text>
            ) : (
              pollOptions.map((option) => {
                const voters = getVotersForOption(option.id);
                const votesCount = option.votes_count || 0;

                return (
                  <View key={option.id} style={styles.optionCard}>
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionText} numberOfLines={2}>
                        {option.text}
                      </Text>
                      {votesCount > 0 && (
                        <View style={styles.optionBadge}>
                          <Text style={styles.optionBadgeText}>{votesCount}</Text>
                        </View>
                      )}
                    </View>

                    {voters.length === 0 ? (
                      <Text style={styles.noVotersText}>אין הצבעות</Text>
                    ) : (
                      <View style={styles.votersList}>
                        {voters.map((voter) => (
                          <View key={voter.id} style={styles.voterRow}>
                            {voter.profile_picture ? (
                              <Image source={{ uri: voter.profile_picture }} style={styles.voterAvatar} />
                            ) : (
                              <View style={[styles.voterAvatar, styles.voterAvatarPlaceholder]}>
                                <Text style={styles.voterAvatarText}>
                                  {voter.display_name?.charAt(0) || '?'}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.voterName} numberOfLines={1}>
                              {voter.display_name || 'משתמש'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: any) => {
  const borderColor = tokens.colors.border?.primary || tokens.colors.border?.main || 'rgba(255,255,255,0.12)';
  /** שקוף-זכוכית — לא elevated אטום שחוסם את BlurView של השיט */
  const cardBg = 'rgba(255,255,255,0.06)';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      gap: tokens.spacing.sm,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'flex-end',
    },
    headerSpacer: {
      width: 36,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    questionContainer: {
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    question: {
      fontSize: 16,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      lineHeight: 22,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: tokens.spacing['3xl'],
      gap: tokens.spacing.md,
    },
    loadingText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
    },
    scroll: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.md,
      paddingBottom: tokens.spacing.xl,
      gap: tokens.spacing.md,
    },
    noOptionsText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: tokens.spacing.xl,
    },
    optionCard: {
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 16,
      padding: tokens.spacing.md,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.md,
      gap: tokens.spacing.sm,
    },
    optionText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    optionBadge: {
      backgroundColor: tokens.colors.primary.main,
      borderRadius: tokens.borderRadius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minWidth: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBadgeText: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.black,
      color: tokens.colors.text.inverse,
    },
    noVotersText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      fontStyle: 'italic',
    },
    votersList: {
      gap: 10,
    },
    voterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      paddingVertical: 8,
    },
    voterAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    voterAvatarPlaceholder: {
      backgroundColor: tokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voterAvatarText: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.inverse,
    },
    voterName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
  });
};

