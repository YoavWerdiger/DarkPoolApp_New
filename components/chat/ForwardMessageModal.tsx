// ============================================
// Forward Message Sheet
// ============================================
// בחירת קבוצות להעברת הודעה — ChatBottomSheet + RTL כמו שאר שיטי הצ׳אט
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { chatGroupService } from '../../services/chat';
import { ChatGroup } from '../../types/chat.types';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import UICard from '../ui/UICard';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetEmptyState,
  ChatSheetLoading,
} from './ChatBottomSheet';
import { chatRtlRow, chatRtlText } from './chatDesignTokens';
import { chatComposerSafeBottomInset } from './chatInputLayout';

/** snap יחיד — קונטיינר השיט בגובה מסך מלא; חייבים לפצות על החלק מתחת ל-viewport. */
const FORWARD_SHEET_SNAP = 0.9;
const FORWARD_SHEET_OFFSCREEN_BELOW = Math.ceil(
  Dimensions.get('window').height * (1 - FORWARD_SHEET_SNAP),
);

interface ForwardMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (groupIds: string[]) => Promise<void>;
  currentGroupId?: string;
}

export default function ForwardMessageModal({
  visible,
  onClose,
  onForward,
  currentGroupId,
}: ForwardMessageModalProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { user } = useAuth();
  const footerSafePad = useMemo(
    () =>
      FORWARD_SHEET_OFFSCREEN_BELOW + chatComposerSafeBottomInset(insets.bottom) + 8,
    [insets.bottom],
  );

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    if (visible) {
      void loadGroups();
      return;
    }
    setSelectedGroups(new Set());
    setQuery('');
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

      const filteredGroups = (data || []).filter(
        (group) => group.id !== currentGroupId,
      );
      setGroups(filteredGroups);
    } catch (error) {
      logger.error('ForwardMessageModal', 'Failed to load groups', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(term));
  }, [groups, query]);

  const toggleGroupSelection = useCallback((groupId: string) => {
    void HapticFeedback.selection();
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleForward = async () => {
    if (selectedGroups.size === 0 || isForwarding) return;

    setIsForwarding(true);
    void HapticFeedback.medium();
    try {
      await onForward(Array.from(selectedGroups));
      onClose();
      setSelectedGroups(new Set());
      setQuery('');
    } catch (error) {
      logger.error('ForwardMessageModal', 'Forward failed', error);
      legacyAlert('שגיאה', 'לא ניתן להעביר את ההודעה');
    } finally {
      setIsForwarding(false);
    }
  };

  const canForward = selectedGroups.size > 0 && !isForwarding;

  const renderGroupItem = ({ item }: { item: ChatGroup }) => {
    const isSelected = selectedGroups.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.groupRow, isSelected && styles.groupRowSelected]}
        onPress={() => toggleGroupSelection(item.id)}
        activeOpacity={0.7}
        disabled={isForwarding}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.name}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.groupAvatar} />
        ) : (
          <View style={styles.groupAvatarPlaceholder}>
            <Ionicons name="people" size={22} color={tokens.colors.text.secondary} />
          </View>
        )}

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected ? (
            <Ionicons name="checkmark" size={16} color={tokens.colors.text.inverse} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const listBody = (() => {
    if (isLoading) {
      return <ChatSheetLoading label="טוען קבוצות..." />;
    }
    if (groups.length === 0) {
      return (
        <ChatSheetEmptyState
          icon="people-outline"
          title="אין קבוצות זמינות"
          subtitle="אין לאן להעביר את ההודעה כרגע"
        />
      );
    }
    if (filteredGroups.length === 0) {
      return (
        <ChatSheetEmptyState
          icon="search-outline"
          title="לא נמצאו קבוצות"
          subtitle="נסה שם אחר"
        />
      );
    }
    return (
      <FlatList
        data={filteredGroups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.list}
      />
    );
  })();

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[FORWARD_SHEET_SNAP]}
      showBrandWatermark={false}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      <ChatSheetContent style={{ flex: 1, minHeight: 0 }}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={onClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="סגור"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>העבר הודעה</Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <UICard variant="inputGlass" padding="none" style={styles.searchShell}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="חפש קבוצה..."
              placeholderTextColor={tokens.colors.text.tertiary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
                accessibilityLabel="נקה חיפוש"
              >
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
              </Pressable>
            ) : null}
          </View>
        </UICard>

        <View style={styles.listWrap}>{listBody}</View>

        <View style={[styles.footer, { paddingBottom: footerSafePad }]}>
          <TouchableOpacity
            style={[
              styles.forwardButton,
              selectedGroups.size === 0 && styles.forwardButtonDisabled,
            ]}
            onPress={() => void handleForward()}
            disabled={!canForward}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="העבר"
          >
            {isForwarding ? (
              <ActivityIndicator size="small" color={tokens.colors.text.inverse} />
            ) : (
              <Text
                style={[
                  styles.forwardButtonText,
                  selectedGroups.size === 0 && styles.forwardButtonTextDisabled,
                ]}
              >
                {selectedGroups.size > 0 ? `העבר (${selectedGroups.size})` : 'העבר'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    header: {
      ...chatRtlRow,
      direction: 'rtl',
      alignItems: 'center',
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      ...chatRtlText,
      color: tokens.colors.text.primary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      width: '100%',
    },
    searchShell: {
      marginTop: 14,
      marginBottom: 10,
      borderRadius: tokens.borderRadius.search,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    searchRow: {
      flexDirection: 'row',
      direction: 'ltr',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      writingDirection: 'rtl',
      textAlign: 'right',
      color: tokens.colors.text.primary,
      fontSize: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      backgroundColor: 'transparent',
    },
    listWrap: {
      flex: 1,
      minHeight: 0,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingVertical: tokens.spacing.xs,
    },
    groupRow: {
      ...chatRtlRow,
      direction: 'rtl',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    groupRowSelected: {
      backgroundColor: tokens.colors.primary.dim,
      borderRadius: 12,
      borderBottomColor: 'transparent',
    },
    groupAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      flexShrink: 0,
    },
    groupAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tokens.colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    groupInfo: {
      flex: 1,
      minWidth: 0,
    },
    groupName: {
      fontSize: 16,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: tokens.colors.border.divider,
      backgroundColor: tokens.colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    checkboxSelected: {
      backgroundColor: tokens.colors.primary.main,
      borderColor: tokens.colors.primary.main,
    },
    footer: {
      flexShrink: 0,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.divider,
    },
    forwardButton: {
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.primary.main,
    },
    forwardButtonDisabled: {
      backgroundColor: tokens.colors.background.primary,
      opacity: 1,
    },
    forwardButtonText: {
      ...chatRtlText,
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.inverse,
      textAlign: 'center',
    },
    forwardButtonTextDisabled: {
      color: tokens.colors.text.tertiary,
    },
  });
