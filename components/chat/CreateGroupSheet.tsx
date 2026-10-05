// ============================================
// Create Group Sheet
// ============================================
// יצירת קבוצת צ'אט חדשה (admins בלבד) — לפי הטופו: כותרת שיט, שדות formField,
// כרטיס הגדרות cardSolid ו-CTA UIButton בתחתית.
// ============================================

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import UIButton from '../ui/UIButton';
import { createChatGroup } from '../../services/chat/chatGroupService';
import { useAuth } from '../../context/AuthContext';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ChatSheetTopoHeader, useChatFitContentSnap } from './ChatBottomSheet';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { SettingsGlassCard, SettingsSwitchRow } from '../profile/ProfileSettingsUI';
import { APP_TYPE, appPhysicalRightText, appSheetSubtitleStyle } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../ui/formControl';

interface CreateGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (groupId: string, groupName: string) => void;
}

export default function CreateGroupSheet({ visible, onClose, onCreated }: CreateGroupSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<'name' | 'desc' | null>(null);

  const canCreate = name.trim().length >= 2;

  const reset = () => {
    setName('');
    setDescription('');
    setIsAnnouncement(false);
    setIsPublic(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!canCreate || !user?.id || isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await createChatGroup(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          settings: {
            is_announcement: isAnnouncement,
            is_public: isPublic,
          },
        },
        user.id
      );
      if (error || !data) {
        void HapticFeedback.error();
        legacyAlert('שגיאה', error?.message || 'לא ניתן ליצור קבוצה');
      } else {
        void HapticFeedback.success();
        handleClose();
        onCreated(data.id, data.name);
      }
    } catch (e: any) {
      legacyAlert('שגיאה', e?.message || 'שגיאה לא צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.62, 0.9, 0.3, `${visible}`);

  return (
    // אותו שיט כמו 3 הנקודות ביומן: קנבס ערכת הנושא, פינות xl, גובה לפי התוכן
    <BottomSheet
      isOpen={visible}
      onClose={handleClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={onContentLayout}>
        <ChatSheetTopoHeader title="קבוצה חדשה" onClose={handleClose} />
        <Text style={[appSheetSubtitleStyle, styles.subtitle, { color: tokens.colors.text.secondary }]}>
          הקבוצה תופיע בקהילה לכל המשתמשים
        </Text>

        <Text style={formFieldLabelStyle({ tokens, focused: focused === 'name' })}>שם הקבוצה</Text>
        <View style={[formFieldShellStyle({ tokens, focused: focused === 'name' }), styles.fieldShell]}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            placeholder="לדוגמה: מסחר יומי"
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.fieldInput]}
            maxLength={80}
            returnKeyType="next"
          />
        </View>

        <Text style={[formFieldLabelStyle({ tokens, focused: focused === 'desc' }), styles.labelGap]}>
          תיאור (אופציונלי)
        </Text>
        <View
          style={[
            formFieldShellStyle({ tokens, focused: focused === 'desc', multiline: true }),
            styles.fieldShell,
          ]}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            onFocus={() => setFocused('desc')}
            onBlur={() => setFocused(null)}
            placeholder="על מה מדברים בקבוצה?"
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.textArea]}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        <SettingsGlassCard style={styles.settingsCard}>
          <SettingsSwitchRow
            title="רק אדמינים שולחים הודעות"
            value={isAnnouncement}
            onValueChange={(v) => {
              void HapticFeedback.selection();
              setIsAnnouncement(v);
            }}
          />
          <SettingsSwitchRow
            title="פתוחה לכולם להצטרפות"
            value={isPublic}
            showDivider={false}
            onValueChange={(v) => {
              void HapticFeedback.selection();
              setIsPublic(v);
            }}
          />
        </SettingsGlassCard>

        <UIButton
          title="צור קבוצה"
          variant="primary"
          fullWidth
          loading={isLoading}
          disabled={!canCreate || isLoading}
          onPress={handleCreate}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    direction: 'rtl',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    marginBottom: APP_LAYOUT.cardTitleToBodyGap + 4,
  },
  labelGap: {
    marginTop: APP_LAYOUT.componentGap,
  },
  // כמו שדה שינוי שם התיק ביומן
  fieldShell: {
    borderRadius: 16,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  fieldInput: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  textArea: {
    alignSelf: 'stretch',
    minHeight: 72,
    lineHeight: APP_TYPE.body.lineHeight,
  },
  settingsCard: {
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
  },
});
