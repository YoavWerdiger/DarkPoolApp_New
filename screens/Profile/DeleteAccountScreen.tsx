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
import { deleteOwnAccount } from '../../services/supportService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  settingsHebrewText,
  settingsRowType,
  settingsBodyType,
  settingsMetaType,
  settingsButtonLabelStyle,
} from '../../components/profile/settingsType';

export default function DeleteAccountScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDelete = () => {
    if (confirm.trim() !== 'מחק') {
      legacyAlert('שגיאה', 'יש להקליד בדיוק: מחק');
      return;
    }

    legacyAlert(
      'מחיקת חשבון',
      'פעולה זו בלתי הפיכה. כל הנתונים האישיים יימחקו או יאנונימיו.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק לצמיתות',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteOwnAccount({
                confirm: confirm.trim(),
                password: password || undefined,
              });
              void HapticFeedback.warning();
              await signOut();
            } catch (e) {
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'מחיקה נכשלה');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: tokens.colors.border.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: tokens.colors.text.primary,
    ...settingsHebrewText,
    ...settingsBodyType,
    marginBottom: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="מחיקת חשבון" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: tokens.spacing.base }}>
          <UICard variant="glass" glassIntensity="light" padding="md">
            <Text
              style={{
                ...settingsHebrewText,
                ...settingsRowType,
                color: tokens.colors.danger.main,
                marginBottom: 8,
              }}
            >
              פעולה בלתי הפיכה
            </Text>
            <Text
              style={{
                ...settingsHebrewText,
                ...settingsBodyType,
                color: tokens.colors.text.secondary,
                marginBottom: 16,
              }}
            >
              למחיקת החשבון הקלידו את המילה מחק בשדה למטה. מומלץ גם לאמת עם הסיסמה.
            </Text>

            <Text
              style={{
                ...settingsHebrewText,
                ...settingsMetaType,
                color: tokens.colors.text.tertiary,
                marginBottom: 6,
              }}
            >
              הקלידו מחק לאישור
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              style={inputStyle}
              placeholder="מחק"
              placeholderTextColor={tokens.colors.text.tertiary}
            />

            <Text
              style={{
                ...settingsHebrewText,
                ...settingsMetaType,
                color: tokens.colors.text.tertiary,
                marginBottom: 6,
              }}
            >
              סיסמה (מומלץ)
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              style={inputStyle}
              placeholderTextColor={tokens.colors.text.tertiary}
            />

            <TouchableOpacity
              disabled={saving}
              onPress={() => {
                void HapticFeedback.warning();
                handleDelete();
              }}
              style={{
                backgroundColor: tokens.colors.danger.main,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ ...settingsButtonLabelStyle, color: '#fff' }}>
                  מחק את החשבון
                </Text>
              )}
            </TouchableOpacity>
          </UICard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
