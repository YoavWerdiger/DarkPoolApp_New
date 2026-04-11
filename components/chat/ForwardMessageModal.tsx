// ============================================
// Forward Message Modal
// ============================================
// מודל לבחירת קבוצות להעברת הודעה
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { chatGroupService } from '../../services/chat';
import { ChatGroup } from '../../types/chat.types';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ForwardMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (groupIds: string[]) => Promise<void>;
  currentGroupId?: string; // קבוצה נוכחית - לא להציג אותה
}

export default function ForwardMessageModal({
  visible,
  onClose,
  onForward,
  currentGroupId,
}: ForwardMessageModalProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const { user } = useAuth();

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  // טעינת קבוצות
  useEffect(() => {
    if (visible) {
      loadGroups();
    } else {
      // איפוס בחירה כשסוגרים
      setSelectedGroups(new Set());
    }
  }, [visible]);

  const loadGroups = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await chatGroupService.getChatGroups(user.id);
      if (error) {
        logger.error('ForwardMessageModal', 'getChatGroups failed', error);
        return;
      }

      // סינון הקבוצה הנוכחית
      const filteredGroups = (data || []).filter(
        group => group.id !== currentGroupId
      );
      setGroups(filteredGroups);
    } catch (error) {
      logger.error('ForwardMessageModal', 'Failed to load groups', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleForward = async () => {
    if (selectedGroups.size === 0) return;

    setIsForwarding(true);
    try {
      await onForward(Array.from(selectedGroups));
      onClose();
      setSelectedGroups(new Set());
    } catch (error) {
      logger.error('ForwardMessageModal', 'Forward failed', error);
      Alert.alert('שגיאה', 'לא ניתן להעביר את ההודעה');
    } finally {
      setIsForwarding(false);
    }
  };

  const renderGroupItem = ({ item }: { item: ChatGroup }) => {
    const isSelected = selectedGroups.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.groupItem, isSelected && styles.groupItemSelected]}
        onPress={() => toggleGroupSelection(item.id)}
        activeOpacity={0.7}
      >
        {/* Group Avatar */}
        <View style={styles.groupAvatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.groupAvatar} />
          ) : (
            <View style={styles.groupAvatarPlaceholder}>
              <Ionicons
                name="people"
                size={24}
                color={DesignTokens.colors.text.primary}
              />
            </View>
          )}
        </View>

        {/* Group Info */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.groupMembers}>
            {item.members_count} חברים
          </Text>
        </View>

        {/* Selection Indicator */}
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <Ionicons
              name="checkmark"
              size={20}
              color={DesignTokens.colors.text.primary}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.7, 0.9]}
      enablePanDownToClose={true}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>העבר הודעה</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={28}
              color={DesignTokens.colors.text.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Groups List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={DesignTokens.colors.primary.main}
            />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={DesignTokens.colors.text.secondary}
            />
            <Text style={styles.emptyText}>אין קבוצות זמינות</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            renderItem={renderGroupItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            style={styles.list}
          />
        )}

        {/* Footer - Forward Button */}
        {selectedGroups.size > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.forwardButton, isForwarding && styles.forwardButtonDisabled]}
              onPress={handleForward}
              disabled={isForwarding}
            >
              {isForwarding ? (
                <ActivityIndicator
                  size="small"
                  color={DesignTokens.colors.text.primary}
                />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={20}
                    color={DesignTokens.colors.text.primary}
                  />
                  <Text style={styles.forwardButtonText}>
                    העבר ({selectedGroups.size})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: tokens.layout.borderWidth.normal,
    borderBottomColor: tokens.colors.border.divider,
    marginBottom: tokens.spacing.sm,
  },
  closeButton: {
    padding: tokens.spacing.sm,
  },
  headerTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: tokens.typography.titleXs.size,
    color: tokens.colors.text.secondary,
    marginTop: tokens.spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: tokens.spacing.sm,
  },
  groupItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: tokens.layout.borderWidth.normal,
    borderBottomColor: tokens.colors.border.divider,
  },
  groupItemSelected: {
    backgroundColor: tokens.colors.primary.dim,
  },
  groupAvatarContainer: {
    marginLeft: tokens.spacing.md,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: tokens.borderRadius.full,
  },
  groupAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  groupMembers: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: tokens.borderRadius.md,
    borderWidth: tokens.layout.borderWidth.thick,
    borderColor: tokens.colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: tokens.colors.primary.main,
    borderColor: tokens.colors.primary.main,
  },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: tokens.layout.borderWidth.normal,
    borderTopColor: tokens.colors.border.divider,
    backgroundColor: tokens.colors.background.primary,
  },
  forwardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: tokens.borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: tokens.spacing['2xl'],
    gap: tokens.spacing.sm,
  },
  forwardButtonDisabled: {
    opacity: 0.6,
  },
  forwardButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
  },
});

