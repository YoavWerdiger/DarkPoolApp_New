// ============================================
// Forward Message Sheet
// ============================================
// בחירת קבוצות להעברת הודעה — לפי הטופו וערכת הנושא:
// כותרת כמו שאר השיטים, שורות כמו ברשימת הצ׳אטים (תמונה + שם צמוד מימין, דיבידר אחרי התמונה),
// סימון עגול, כפתור UIButton (pill). בלי חיפוש.
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Image, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE, appCardTitleStyle, appGroupLabelStyle } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import UIButton from '../ui/UIButton';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { chatGroupService } from '../../services/chat';
import { ChatGroup } from '../../types/chat.types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetEmptyState,
  ChatSheetLoading,
} from './ChatBottomSheet';
import { chatRtlRow, chatRtlText } from './chatDesignTokens';
import { chatComposerSafeBottomInset } from './chatInputLayout';

/** snap יחיד — קונטיינר השיט בגובה מסך מלא; מפצים על החלק שמתחת ל-viewport. */
const FORWARD_SHEET_SNAP = 0.9;
const FORWARD_SHEET_OFFSCREEN_BELOW = Math.ceil(
  Dimensions.get('window').height * (1 - FORWARD_SHEET_SNAP),
);
// כמו «שליחה אל…» (ShareToChatScreen)
const AVATAR = 48;
const ROW_GAP = APP_LAYOUT.stackGapTight;

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
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const footerSafePad =
    FORWARD_SHEET_OFFSCREEN_BELOW + chatComposerSafeBottomInset(insets.bottom) + 8;

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await chatGroupService.getChatGroups(user.id);
      if (error) {
        logger.error('ForwardMessageModal', 'getChatGroups failed', error);
        return;
      }
      setGroups((data || []).filter((g) => g.id !== currentGroupId));
    } catch (error) {
      logger.error('ForwardMessageModal', 'Failed to load groups', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentGroupId]);

  useEffect(() => {
    if (visible) {
      void loadGroups();
      return;
    }
    setSelected(new Set());
  }, [visible, loadGroups]);

  const toggle = useCallback((groupId: string) => {
    void HapticFeedback.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const canForward = selected.size > 0 && !isForwarding;

  const handleForward = async () => {
    if (!canForward) return;
    setIsForwarding(true);
    void HapticFeedback.impactLight();
    try {
      await onForward(Array.from(selected));
      onClose();
      setSelected(new Set());
    } catch (error) {
      logger.error('ForwardMessageModal', 'Forward failed', error);
      legacyAlert('שגיאה', 'לא ניתן להעביר את ההודעה');
    } finally {
      setIsForwarding(false);
    }
  };

  const renderRow = ({ item }: { item: ChatGroup }) => {
    const isSelected = selected.has(item.id);
    const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);
    const name = chatGroupDisplayName(item.name);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        disabled={isForwarding}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={name}
      >
        {avatar ? (
          <Image source={avatar} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="people" size={22} color={tokens.colors.text.secondary} />
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={isSelected ? tokens.colors.primary.main : tokens.colors.text.tertiary}
        />
      </Pressable>
    );
  };

  const body = isLoading ? (
    <ChatSheetLoading label="טוען קבוצות..." />
  ) : groups.length === 0 ? (
    <ChatSheetEmptyState
      icon="people-outline"
      title="אין קבוצות זמינות"
      subtitle="אין לאן להעביר את ההודעה כרגע"
    />
  ) : (
    <FlatList
      data={groups}
      renderItem={renderRow}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[FORWARD_SHEET_SNAP]}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <ChatSheetContent style={styles.content}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={onClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="סגור"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <Text style={styles.title} numberOfLines={1}>
            העבר הודעה
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.groupLabel}>קבוצות</Text>
        <View style={styles.listWrap}>{body}</View>

        <View style={[styles.footer, { paddingBottom: footerSafePad }]}>
          <UIButton
            title={selected.size > 0 ? `העבר (${selected.size})` : 'העבר'}
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
    content: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      ...chatRtlRow,
      direction: 'rtl',
      alignItems: 'center',
      gap: 10,
      paddingBottom: APP_LAYOUT.stackGapSmall + 4,
    },
    // כמו כותרות השיטים (תגובות)
    title: {
      ...chatRtlText,
      flex: 1,
      textAlign: 'center',
      color: tokens.colors.text.primary,
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
    },
    headerSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
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
    /** תווית קבוצה — כמו ב«שליחה אל…» */
    groupLabel: {
      ...appGroupLabelStyle,
      color: tokens.colors.text.secondary,
    },
    // כמו שורה ב«שליחה אל…»: row-reverse — תמונה מימין, השם צמוד אליה, הסימון בקצה השמאלי
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: ROW_GAP,
      paddingVertical: APP_LAYOUT.stackGapTight,
    },
    rowPressed: {
      opacity: 0.6,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.primary,
    },
    name: {
      ...appCardTitleStyle,
      flex: 1,
      width: undefined,
      alignSelf: 'center',
      color: tokens.colors.text.primary,
    },
    // מתחיל אחרי האווטאר (כמו «שליחה אל…» ורשימת הצ׳אטים)
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border.divider,
      marginRight: AVATAR + ROW_GAP,
    },
    footer: {
      flexShrink: 0,
      paddingTop: APP_LAYOUT.stackGapSmall,
    },
  });
