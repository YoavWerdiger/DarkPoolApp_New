import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { createSupportTicket } from '../../services/supportService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { SettingsGlassCard } from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsBodyType,
} from '../../components/profile/settingsType';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import UIButton from '../../components/ui/UIButton';

export default function ContactSupportScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<'subject' | 'body' | null>(null);

  const submit = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await createSupportTicket({
        userId: user.id,
        subject,
        body,
      });
      void HapticFeedback.success();
      legacyAlert('נשלח', 'פנייתך התקבלה. נחזור אליך בהקדם.', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'שליחה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const shell = (field: 'subject' | 'body', multiline = false) => [
    {
      flexDirection: 'row' as const,
      borderRadius: multiline ? UI_CARD_RADIUS : tokens.borderRadius.full,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: multiline ? 140 : 52,
      marginBottom: APP_LAYOUT.componentGap,
    },
    formFieldShellStyle({ tokens, focused: focused === field, error: false, multiline }),
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.background.primary }}
      edges={['top', 'bottom']}
    >
      <ChatSubScreenHeader title="יצירת קשר" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: APP_LAYOUT.sectionHeaderToContent,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <SettingsGlassCard style={{ padding: APP_LAYOUT.cardPadding }}>
            <Text
              style={{
                ...settingsHebrewText,
                ...settingsBodyType,
                color: tokens.colors.text.secondary,
                marginBottom: APP_LAYOUT.cardTitleToBodyGap,
              }}
            >
              פנייה זו תיפתח כטיקט במערכת התמיכה ותגיע למנהלים.
            </Text>
            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'subject' })}>
              נושא
            </Text>
            <View style={shell('subject')}>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                maxLength={120}
                placeholder="למשל: בעיה בתשלום"
                placeholderTextColor={tokens.colors.text.muted}
                onFocus={() => setFocused('subject')}
                onBlur={() => setFocused(null)}
                style={[formFieldInputStyle(), { color: tokens.colors.text.primary }]}
              />
            </View>
            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'body' })}>
              פירוט
            </Text>
            <View style={[shell('body', true), { marginBottom: APP_LAYOUT.cardStackGap }]}>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
                placeholder="תארו את הבעיה..."
                placeholderTextColor={tokens.colors.text.muted}
                onFocus={() => setFocused('body')}
                onBlur={() => setFocused(null)}
                style={[
                  formFieldInputStyle(),
                  {
                    color: tokens.colors.text.primary,
                    minHeight: 120,
                    textAlignVertical: 'top',
                    paddingVertical: 12,
                  },
                ]}
              />
            </View>
            <UIButton
              title="שלח פנייה"
              variant="primary"
              fullWidth
              loading={saving}
              disabled={saving}
              onPress={() => {
                void HapticFeedback.impactLight();
                void submit();
              }}
            />
          </SettingsGlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
