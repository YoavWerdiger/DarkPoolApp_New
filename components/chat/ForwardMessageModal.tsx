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
} from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { chatGroupService } from '../../services/chat';
import { ChatGroup } from '../../types/chat.types';
import { useAuth } from '../../context/AuthContext';
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
        console.error('❌ Error loading groups:', error);
        return;
      }

      // סינון הקבוצה הנוכחית
      const filteredGroups = (data || []).filter(
        group => group.id !== currentGroupId
      );
      setGroups(filteredGroups);
    } catch (error) {
      console.error('❌ Error loading groups:', error);
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
      console.error('❌ Error forwarding message:', error);
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
    marginBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    fontSize: 16,
    color: tokens.colors.text.secondary,
    marginTop: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  groupItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  groupItemSelected: {
    backgroundColor: tokens.colors.primary.main + '15',
  },
  groupAvatarContainer: {
    marginLeft: 12,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  groupAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: tokens.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxSelected: {
    backgroundColor: tokens.colors.primary.main,
    borderColor: tokens.colors.primary.main,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.background.secondary,
    backgroundColor: tokens.colors.background.primary,
  },
  forwardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  forwardButtonDisabled: {
    opacity: 0.6,
  },
  forwardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text.primary,
  },
});

