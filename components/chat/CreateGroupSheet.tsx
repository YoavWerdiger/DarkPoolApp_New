// ============================================
// Create Group Sheet
// ============================================
// יצירת קבוצת צ'אט חדשה (admins בלבד) — לפי הטופו: כותרת שיט, שדות formField,
// כרטיס הגדרות cardSolid ו-CTA UIButton בתחתית.
// ============================================

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UIButton from '../ui/UIButton';
import { createChatGroup } from '../../services/chat/chatGroupService';
import { useAuth } from '../../context/AuthContext';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ChatBottomSheet, ChatSheetContent } from './ChatBottomSheet';
import { APP_TYPE, appSheetSubtitleStyle, appSheetTitleStyle } from '../ui/appType';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
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

  const switchTrack = { false: tokens.colors.border.divider, true: tokens.colors.text.primary };

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[0.78]}
      showBrandWatermark={false}
      avoidKeyboard
    >
      <ChatSheetContent>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={[appSheetTitleStyle, { color: tokens.colors.text.primary }]}>קבוצה חדשה</Text>
          <Text style={[appSheetSubtitleStyle, styles.subtitle, { color: tokens.colors.text.secondary }]}>
            הקבוצה תופיע בקהילה לכל המשתמשים
          </Text>

          <View style={styles.field}>
            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'name' })}>שם הקבוצה</Text>
            <View style={[formFieldShellStyle({ tokens, focused: focused === 'name' }), styles.shell]}>
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="לדוגמה: מסחר יומי 🌟"
                placeholderTextColor={formFieldPlaceholderColor(tokens)}
                style={[formFieldInputStyle(tokens), styles.input]}
                maxLength={80}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'desc' })}>תיאור (אופציונלי)</Text>
            <View
              style={[
                formFieldShellStyle({ tokens, focused: focused === 'desc', multiline: true }),
                styles.shell,
                styles.shellMultiline,
              ]}
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocused('desc')}
                onBlur={() => setFocused(null)}
                placeholder="על מה מדברים בקבוצה?"
                placeholderTextColor={formFieldPlaceholderColor(tokens)}
                style={[formFieldInputStyle(tokens), styles.textArea]}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={[styles.settingsCard, { backgroundColor: tokens.colors.background.cardSolid }]}>
            <SettingRow
              icon="megaphone-outline"
              title="קבוצת הכרזות"
              subtitle="רק אדמינים שולחים הודעות"
              value={isAnnouncement}
              onChange={setIsAnnouncement}
              track={switchTrack}
            />
            <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
            <SettingRow
              icon={isPublic ? 'globe-outline' : 'lock-closed-outline'}
              title={isPublic ? 'קבוצה פתוחה' : 'קבוצה פרטית'}
              subtitle={isPublic ? 'כולם יכולים להצטרף' : 'הצטרפות רק בהזמנה'}
              value={isPublic}
              onChange={setIsPublic}
              track={switchTrack}
            />
          </View>

          <View style={styles.cta}>
            <UIButton
              title="צור קבוצה"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={!canCreate || isLoading}
              onPress={handleCreate}
            />
          </View>
        </ScrollView>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  track,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  track: { false: string; true: string };
}) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={22} color={tokens.colors.text.primary} />
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, { color: tokens.colors.text.primary }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: tokens.colors.text.secondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          void HapticFeedback.selection();
          onChange(v);
        }}
        trackColor={track}
        thumbColor={tokens.colors.background.primary}
        ios_backgroundColor={track.false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: APP_LAYOUT.stackGapSmall,
    paddingBottom: APP_LAYOUT.componentGap,
  },
  subtitle: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  field: {
    marginTop: APP_LAYOUT.componentGap + 4,
  },
  shell: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: 'row',
  },
  shellMultiline: {
    borderRadius: 20,
  },
  input: {
    minHeight: 52,
  },
  textArea: {
    minHeight: 84,
    lineHeight: APP_TYPE.body.lineHeight,
  },
  settingsCard: {
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
    borderRadius: UI_CARD_RADIUS,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  settingSubtitle: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cta: {
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
  },
});
