// ============================================
// Create Group Sheet
// ============================================
// יצירת קבוצת צ'אט חדשה (admins בלבד) — לפי הטופו: כותרת שיט, שדות formField,
// כרטיס הגדרות cardSolid ו-CTA UIButton בתחתית.
// ============================================

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import UIButton from '../ui/UIButton';
import { createChatGroup } from '../../services/chat/chatGroupService';
import { useAuth } from '../../context/AuthContext';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ChatSheetTopoHeader, useChatFitContentSnap } from './ChatBottomSheet';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../ui/formControl';

type Tier = 'free' | 'premium';
const TIERS: { key: Tier; label: string }[] = [
  { key: 'free', label: 'חינמי' },
  { key: 'premium', label: 'פרימיום' },
];

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
  /** מסלולים שרואים ויכולים להצטרף */
  const [tiers, setTiers] = useState<Tier[]>(['free', 'premium']);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<'name' | 'desc' | null>(null);

  const canCreate = name.trim().length >= 2 && tiers.length > 0;

  const toggleTier = (t: Tier) => {
    void HapticFeedback.selection();
    setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const reset = () => {
    setName('');
    setDescription('');
    setIsAnnouncement(false);
    setTiers(['free', 'premium']);
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
            onlyAdminsCanSend: isAnnouncement,
            is_public: true,
            allowed_tiers: tiers,
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

        {/* מי כותב — בחירה אחת: דיון או הכרזות */}
        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.labelGap]}>מי כותב בקבוצה</Text>
        <View style={[styles.segment, { backgroundColor: tokens.colors.background.cardSolid }]}>
          {([
            { key: false, label: 'כל החברים' },
            { key: true, label: 'רק אדמינים' },
          ] as const).map((opt) => {
            const active = isAnnouncement === opt.key;
            return (
              <Pressable
                key={opt.label}
                onPress={() => {
                  if (!active) void HapticFeedback.selection();
                  setIsAnnouncement(opt.key);
                }}
                style={[styles.segmentItem, active && { backgroundColor: tokens.colors.background.tertiary }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* מי רואה ויכול להצטרף — לפי מסלול */}
        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.labelGap]}>
          מסלולים שרואים ומצטרפים
        </Text>
        <View style={styles.tiersRow}>
          {TIERS.map((t) => {
            const on = tiers.includes(t.key);
            return (
              <Pressable
                key={t.key}
                onPress={() => toggleTier(t.key)}
                style={[
                  styles.tierChip,
                  { backgroundColor: on ? tokens.colors.text.primary : tokens.colors.background.cardSolid },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Ionicons
                  name={on ? 'checkmark' : 'add'}
                  size={16}
                  color={on ? tokens.colors.text.inverse : tokens.colors.text.secondary}
                />
                <Text style={[styles.tierText, { color: on ? tokens.colors.text.inverse : tokens.colors.text.primary }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.cta}>

        <UIButton
          title="צור קבוצה"
          variant="primary"
          fullWidth
          loading={isLoading}
          disabled={!canCreate || isLoading}
          onPress={handleCreate}
        />
        </View>
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
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  tiersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  tierText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  cta: {
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
  },
});
