// ============================================
// Create Group Sheet
// ============================================
// יצירת קבוצת צ'אט חדשה (admins בלבד)
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { GlassChip } from '../ui/GlassChip';
import UICard from '../ui/UICard';
import { CHROME_UICARD, chromeSurfaceCardStyle } from '../ui/chromeControl';
import { createChatGroup } from '../../services/chat/chatGroupService';
import { useAuth } from '../../context/AuthContext';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ChatBottomSheet, ChatSheetContent } from './ChatBottomSheet';
import { chatPalette } from './chatDesignTokens';
import { APP_TYPE, appSectionTitleStyle, appSheetButtonLabelStyle } from '../ui/appType';

interface CreateGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (groupId: string, groupName: string) => void;
}

export default function CreateGroupSheet({ visible, onClose, onCreated }: CreateGroupSheetProps) {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const canCreate = name.trim().length >= 2;

  const handleCreate = async () => {
    if (!canCreate || !user?.id) return;
    void HapticFeedback.medium();
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
        legacyAlert('שגיאה', error?.message || 'לא ניתן ליצור קבוצה');
      } else {
        handleClose();
        onCreated(data.id, data.name);
      }
    } catch (e: any) {
      legacyAlert('שגיאה', e?.message || 'שגיאה לא צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    void HapticFeedback.impactLight();
    setName('');
    setDescription('');
    setIsAnnouncement(false);
    setIsPublic(true);
    onClose();
  };

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[0.72]}
      showBrandWatermark={false}
      avoidKeyboard
    >
      <ChatSheetContent>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={DesignTokens.colors.text.secondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: DesignTokens.colors.text.primary }]}>
            קבוצה חדשה
          </Text>
          <GlassChip
            selected={canCreate}
            disableBlur
            onPress={canCreate && !isLoading ? handleCreate : undefined}
            style={styles.createBtn}
            contentContainerStyle={styles.createBtnContent}
            accessibilityLabel="צור קבוצה"
          >
            {isLoading ? (
              <ActivityIndicator size={14} color={DesignTokens.colors.primary.main} />
            ) : (
              <Text style={[styles.createBtnText, { color: canCreate ? DesignTokens.colors.primary.main : DesignTokens.colors.text.tertiary }]}>
                צור
              </Text>
            )}
          </GlassChip>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.fieldLabel, { color: DesignTokens.colors.text.secondary }]}>שם הקבוצה *</Text>
          <UICard
            {...CHROME_UICARD}
            style={[styles.inputCard, chromeSurfaceCardStyle(DesignTokens)]}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="שם הקבוצה..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              style={[styles.input, { color: DesignTokens.colors.text.primary }]}
              autoFocus
              textAlign="right"
              maxLength={80}
              returnKeyType="next"
            />
          </UICard>
          <Text style={[styles.charCount, { color: DesignTokens.colors.text.tertiary }]}>
            {name.length}/80
          </Text>

          <Text style={[styles.fieldLabel, { color: DesignTokens.colors.text.secondary }]}>תיאור (אופציונלי)</Text>
          <UICard
            {...CHROME_UICARD}
            style={[styles.inputCard, chromeSurfaceCardStyle(DesignTokens)]}
          >
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="תיאור הקבוצה..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              style={[styles.input, styles.textArea, { color: DesignTokens.colors.text.primary }]}
              textAlign="right"
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
          </UICard>

          <Text style={[styles.sectionTitle, { color: DesignTokens.colors.text.secondary }]}>הגדרות</Text>

          <View style={[styles.settingRow, { borderColor: chatPalette.glassBorder }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="megaphone-outline" size={20} color={DesignTokens.colors.text.secondary} />
              <View>
                <Text style={[styles.settingLabel, { color: DesignTokens.colors.text.primary }]}>קבוצת הכרזות</Text>
                <Text style={[styles.settingDescription, { color: DesignTokens.colors.text.tertiary }]}>
                  רק אדמינים שולחים הודעות
                </Text>
              </View>
            </View>
            <Switch
              value={isAnnouncement}
              onValueChange={setIsAnnouncement}
              trackColor={{ false: DesignTokens.colors.border.primary, true: DesignTokens.colors.primary.main }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingRow, { borderColor: chatPalette.glassBorder }]}>
            <View style={styles.settingLeft}>
              <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={20} color={DesignTokens.colors.text.secondary} />
              <View>
                <Text style={[styles.settingLabel, { color: DesignTokens.colors.text.primary }]}>
                  {isPublic ? 'קבוצה פתוחה' : 'קבוצה פרטית'}
                </Text>
                <Text style={[styles.settingDescription, { color: DesignTokens.colors.text.tertiary }]}>
                  {isPublic ? 'כולם יכולים להצטרף' : 'הצטרפות רק בהזמנה'}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: DesignTokens.colors.border.primary, true: DesignTokens.colors.primary.main }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: {
    ...appSectionTitleStyle,
    textAlign: 'center',
  },
  createBtn: {
    minWidth: 50,
    minHeight: 32,
    borderRadius: 20,
  },
  createBtnContent: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  inputCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  createBtnText: {
    ...appSheetButtonLabelStyle,
    fontWeight: '600',
  },
  content: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
    marginTop: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'left',
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 4,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  settingDescription: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
});
