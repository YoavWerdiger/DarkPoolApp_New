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
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetEmptyState,
  ChatSheetLoading,
} from './ChatBottomSheet';
import { chatRtlRow, chatRtlText } from './chatDesignTokens';
import { chatComposerSafeBottomInset } from './chatInputLayout';
import { APP_TYPE } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import UIButton from '../ui/UIButton';

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
  const { isDarkMode } = useTheme();
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
    void HapticFeedback.impactLight();
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
    const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);

    return (
      <TouchableOpacity
        style={styles.groupRow}
        onPress={() => toggleGroupSelection(item.id)}
        activeOpacity={0.7}
        disabled={isForwarding}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={chatGroupDisplayName(item.name)}
      >
        {avatar ? (
          <Image source={avatar} style={styles.groupAvatar} />
        ) : (
          <View style={styles.groupAvatarPlaceholder}>
            <Ionicons name="people" size={22} color={tokens.colors.text.secondary} />
          </View>
        )}

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {chatGroupDisplayName(item.name)}
          </Text>
        </View>

        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected ? <Ionicons name="checkmark" size={15} color="#0B0B0C" /> : null}
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

        <View style={styles.searchPill}>
          <Ionicons name="search-outline" size={18} color={tokens.colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש קבוצה"
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

        <View style={styles.listWrap}>{listBody}</View>

        <View style={[styles.footer, { paddingBottom: footerSafePad }]}>
          <UIButton
            title={selectedGroups.size > 0 ? `העבר (${selectedGroups.size})` : 'העבר'}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canForward}
            loading={isForwarding}
            onPress={() => void handleForward()}
          />
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
      paddingBottom: APP_LAYOUT.stackGapSmall,
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
    // כמו כותרות השיטים (תגובות)
    headerTitle: {
      ...chatRtlText,
      color: tokens.colors.text.primary,
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
      textAlign: 'center',
      width: '100%',
    },
    // כמו החיפוש ברשימת הצ׳אטים
    searchPill: {
      flexDirection: 'row',
      direction: 'ltr',
      alignItems: 'center',
      gap: 10,
      marginTop: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.stackGapSmall,
      backgroundColor: tokens.colors.background.cardSolid,
      borderRadius: tokens.borderRadius.search,
      paddingHorizontal: 18,
      height: 46,
    },
    searchInput: {
      flex: 1,
      ...APP_TYPE.body,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
      paddingVertical: 0,
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
      paddingVertical: 4,
    },
    // כמו שורה ברשימת הצ׳אטים — בלי דיבידרים ובלי רקע צבעוני לבחירה
    groupRow: {
      ...chatRtlRow,
      direction: 'rtl',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
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
      backgroundColor: tokens.colors.background.cardSolid,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    groupInfo: {
      flex: 1,
      minWidth: 0,
    },
    groupName: {
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: tokens.colors.text.tertiary,
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
      paddingTop: APP_LAYOUT.stackGapSmall,
    },
  });
