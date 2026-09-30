import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import {
  Text,
  ScrollView,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { deleteOwnAccount } from '../../services/supportService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { SettingsGlassCard } from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsRowType,
  settingsBodyType,
} from '../../components/profile/settingsType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import UIButton from '../../components/ui/UIButton';
import { PasswordVisibilityToggle } from '../../components/ui/PasswordVisibilityToggle';

export default function DeleteAccountScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<'confirm' | 'password' | null>(null);

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

  const shell = (field: 'confirm' | 'password') => [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderRadius: tokens.borderRadius.full,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: 52,
      marginBottom: APP_LAYOUT.componentGap,
    },
    formFieldShellStyle({ tokens, focused: focused === field, error: false }),
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.background.primary }}
      edges={['top', 'bottom']}
    >
      <ChatSubScreenHeader title="מחיקת חשבון" onBack={() => navigation.goBack()} />
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
                ...settingsRowType,
                color: tokens.colors.danger.main,
              }}
            >
              פעולה בלתי הפיכה
            </Text>
            <Text
              style={{
                ...settingsHebrewText,
                ...settingsBodyType,
                color: tokens.colors.text.secondary,
                marginTop: APP_LAYOUT.titleSubtitleGap,
                marginBottom: APP_LAYOUT.cardTitleToBodyGap,
              }}
            >
              למחיקת החשבון הקלידו את המילה מחק בשדה למטה. מומלץ גם לאמת עם הסיסמה.
            </Text>

            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'confirm' })}>
              הקלידו מחק לאישור
            </Text>
            <View style={shell('confirm')}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                autoCapitalize="none"
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                style={[formFieldInputStyle(), { color: tokens.colors.text.primary }]}
                placeholder="מחק"
                placeholderTextColor={tokens.colors.text.muted}
              />
            </View>

            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'password' })}>
              סיסמה (מומלץ)
            </Text>
            <View style={[shell('password'), { marginBottom: APP_LAYOUT.cardStackGap }]}>
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                style={[formFieldInputStyle(), { color: tokens.colors.text.primary }]}
                placeholderTextColor={tokens.colors.text.muted}
              />
            </View>

            <UIButton
              title="מחק את החשבון"
              variant="danger"
              fullWidth
              loading={saving}
              disabled={saving}
              onPress={() => {
                void HapticFeedback.warning();
                handleDelete();
              }}
            />
          </SettingsGlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
