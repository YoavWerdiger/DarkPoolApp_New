import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { createSupportTicket } from '../../services/supportService';
import { HapticFeedback } from '../../utils/hapticFeedback';

export default function ContactSupportScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

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

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: tokens.colors.border.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: tokens.colors.text.primary,
    textAlign: 'right' as const,
    marginBottom: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="יצירת קשר" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: tokens.spacing.base }}>
          <UICard variant="glass" glassIntensity="light" padding="md">
            <Text
              style={{
                color: tokens.colors.text.secondary,
                textAlign: 'right',
                marginBottom: 14,
                lineHeight: 20,
              }}
            >
              פנייה זו תיפתח כטיקט במערכת התמיכה ותגיע למנהלים.
            </Text>
            <Text
              style={{
                color: tokens.colors.text.tertiary,
                textAlign: 'right',
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              נושא
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              placeholder="למשל: בעיה בתשלום"
              placeholderTextColor={tokens.colors.text.tertiary}
              style={inputStyle}
            />
            <Text
              style={{
                color: tokens.colors.text.tertiary,
                textAlign: 'right',
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              פירוט
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={4000}
              placeholder="תארו את הבעיה..."
              placeholderTextColor={tokens.colors.text.tertiary}
              style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
            />
            <TouchableOpacity
              disabled={saving}
              onPress={() => {
                void HapticFeedback.impactLight();
                void submit();
              }}
              style={{
                backgroundColor: tokens.colors.primary.main,
                borderRadius: tokens.borderRadius.full,
                paddingVertical: 14,
                paddingHorizontal: 24,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 52,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>שלח פנייה</Text>
              )}
            </TouchableOpacity>
          </UICard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
