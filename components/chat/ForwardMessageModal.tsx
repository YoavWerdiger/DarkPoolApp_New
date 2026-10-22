// ============================================
// Forward Message Sheet
// ============================================
// «העבר הודעה» — אותו שיט כמו שיתוף (ShareDestinationSheet): BottomSheet בגובה התוכן,
// כותרת עם שברון, רשימת קבוצות באותו עיצוב. ההבדל: בחירה מרובה (עיגול) וכפתור «העבר».
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import UIButton from '../ui/UIButton';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { useChatFitContentSnap, useChatSheetDismiss } from './ChatBottomSheet';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { getChatGroups } from '../../services/chat/chatGroupService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

interface ForwardMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (groupIds: string[]) => Promise<void>;
  currentGroupId?: string;
}

type GroupRow = { id: string; name: string; avatar_url?: string | null };

export default function ForwardMessageModal({
  visible,
  onClose,
  onForward,
  currentGroupId,
}: ForwardMessageModalProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  // גובה לפי התוכן — כמו שיט השיתוף
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.45, 0.92, 0.12);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await getChatGroups(user.id);
      if (error) {
        logger.error('ForwardMessageModal', 'getChatGroups failed', error);
        return;
      }
      setGroups(
        (data || [])
          .filter((g: any) => g.id !== currentGroupId)
          .map((g: any) => ({ id: g.id, name: g.name || 'קבוצה', avatar_url: g.avatar_url })),
      );
    } catch (error) {
      logger.error('ForwardMessageModal', 'Failed to load groups', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentGroupId]);

  useEffect(() => {
    if (visible) {
      void loadGroups();
      return;
    }
    setSelected(new Set());
    setBusy(false);
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

  const handleForward = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    void HapticFeedback.impactLight();
    try {
      await onForward(Array.from(selected));
      onClose();
    } catch (error) {
      logger.error('ForwardMessageModal', 'Forward failed', error);
      legacyAlert('שגיאה', 'לא ניתן להעביר את ההודעה');
    } finally {
      setBusy(false);
    }
  };

  const windowHeight = Dimensions.get('window').height;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      enablePanDownToClose={!busy}
      showHandle
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View
        style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}
        onLayout={onContentLayout}
      >
        <View style={styles.header}>
          <HeaderClose disabled={busy} onClose={onClose} />
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>העבר הודעה</Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.text.secondary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: tokens.colors.text.secondary }]}>
              אין קבוצות זמינות
            </Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            style={{ maxHeight: Math.round(windowHeight * 0.5) }}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
            )}
            renderItem={({ item }) => {
              const avatar = groupAvatarSource(item.name, item.avatar_url, isDarkMode);
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.groupRow}
                  activeOpacity={0.7}
                  disabled={busy}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  {avatar ? (
                    <Image source={avatar} style={styles.groupAvatar} />
                  ) : (
                    <View style={[styles.groupAvatar, styles.groupAvatarPh]}>
                      <Ionicons name="people" size={20} color={tokens.colors.text.secondary} />
                    </View>
                  )}
                  <Text style={[styles.groupName, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                    {chatGroupDisplayName(item.name)}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? tokens.colors.primary.main : tokens.colors.text.tertiary}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}

        <View style={styles.footer}>
          <UIButton
            title={selected.size > 0 ? `העבר (${selected.size})` : 'העבר'}
            variant="primary"
            size="lg"
            fullWidth
            disabled={selected.size === 0 || busy}
            loading={busy}
            onPress={() => void handleForward()}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** שברון סגירה — כמו בשיט השיתוף (סגירה מונפשת מתוך השיט) */
function HeaderClose({ disabled, onClose }: { disabled: boolean; onClose: () => void }) {
  const tokens = useDesignTokens();
  const dismiss = useChatSheetDismiss(onClose);
  return (
    <DayNavBlurButton
      onPress={() => {
        if (!disabled) dismiss();
      }}
      size={DAY_NAV_BUTTON_SIZE}
      glass={false}
      style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
      accessibilityLabel="סגור"
      disabled={disabled}
    >
      <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    container: { direction: 'rtl' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
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
    headerTitle: {
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      direction: 'ltr',
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    center: {
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyText: {
      ...appPhysicalRightText,
      textAlign: 'center',
      fontSize: APP_TYPE.cardBody.fontSize,
    },
    listContent: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    },
    divider: { height: StyleSheet.hairlineWidth },
    // direction:'rtl' (container) — row = תמונה מימין, שם, עיגול בחירה בקצה השמאלי
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
    },
    groupAvatar: { width: 44, height: 44, borderRadius: tokens.borderRadius.full },
    groupAvatarPh: {
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: {
      ...appPhysicalRightText,
      flex: 1,
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
    },
    footer: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: APP_LAYOUT.stackGapSmall,
    },
  });
}
