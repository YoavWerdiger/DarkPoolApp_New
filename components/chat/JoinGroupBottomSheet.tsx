import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatBottomSheet } from './ChatBottomSheet';

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  members_count?: number;
}

interface JoinGroupBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onJoin: () => void;
  group: GroupInfo | null;
  isJoining?: boolean;
}

export default function JoinGroupBottomSheet({
  visible,
  onClose,
  onJoin,
  group,
  isJoining = false,
}: JoinGroupBottomSheetProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: DesignTokens.spacing.lg,
      alignItems: 'center',
    },
    avatarContainer: {
      marginBottom: DesignTokens.spacing.lg,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: DesignTokens.colors.primary.dim || 'rgba(0, 200, 5, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupName: {
      fontSize: 22,
      fontWeight: '700',
      color: DesignTokens.colors.text.primary,
      textAlign: 'center',
      marginBottom: DesignTokens.spacing.xs,
    },
    membersCount: {
      fontSize: 15,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      marginBottom: DesignTokens.spacing.md,
    },
    description: {
      fontSize: 15,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      marginBottom: DesignTokens.spacing.xl,
      lineHeight: 22,
    },
    joinButton: {
      paddingVertical: 16,
      paddingHorizontal: 52,
      borderRadius: 50,
      backgroundColor: DesignTokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    joinButtonDisabled: {
      opacity: 0.6,
    },
    joinButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#000000',
    },
  }), [DesignTokens]);

  if (!group) return null;

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.42]}>
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {group.avatar_url ? (
            <Image
              source={{ uri: group.avatar_url }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="people" size={36} color={DesignTokens.colors.primary.main} />
            </View>
          )}
        </View>

        {/* Group Name */}
        <Text style={styles.groupName}>{group.name}</Text>

        {/* Members Count */}
        <Text style={styles.membersCount}>
          {group.members_count || 0} חברים
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          {group.description || 'הצטרף לקבוצה כדי לראות את ההודעות ולהשתתף בשיחות'}
        </Text>

        {/* Join Button */}
        <TouchableOpacity
          style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
          onPress={onJoin}
          activeOpacity={0.7}
          disabled={isJoining}
        >
          <Text style={styles.joinButtonText}>
            {isJoining ? 'מצטרף...' : 'הצטרף לקבוצה'}
          </Text>
        </TouchableOpacity>
      </View>
    </ChatBottomSheet>
  );
}

