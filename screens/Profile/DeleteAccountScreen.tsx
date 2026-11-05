import i18n from '../../lib/i18n';
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
    // מילת האישור בשפת הממשק (מחק / DELETE) — גם המילה העברית מתקבלת
    const confirmWord = i18n.t('auto.screens__Profile__DeleteAccountScreen.s11');
    const typed = confirm.trim();
    if (typed !== 'מחק' && typed.toUpperCase() !== confirmWord.toUpperCase()) {
      legacyAlert(i18n.t('auto.screens__Profile__DeleteAccountScreen.s1'), i18n.t('auto.screens__Profile__DeleteAccountScreen.s2'));
      return;
    }

    legacyAlert(
      i18n.t('auto.screens__Profile__DeleteAccountScreen.s3'),
      i18n.t('auto.screens__Profile__DeleteAccountScreen.s4'),
      [
        { text: i18n.t('auto.screens__Profile__DeleteAccountScreen.s5'), style: 'cancel' },
        {
          text: i18n.t('auto.screens__Profile__DeleteAccountScreen.s6'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteOwnAccount({
                // השרת (delete-account) מצפה ל«מחק» — המילה בשפת הממשק כבר אומתה למעלה
                confirm: 'מחק',
                password: password || undefined,
              });
              void HapticFeedback.warning();
              await signOut();
            } catch (e) {
              legacyAlert(i18n.t('auto.screens__Profile__DeleteAccountScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Profile__DeleteAccountScreen.s7'));
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
      <ChatSubScreenHeader title={i18n.t('auto.screens__Profile__DeleteAccountScreen.s3')} onBack={() => navigation.goBack()} />
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
            >{i18n.t('auto.screens__Profile__DeleteAccountScreen.s8')}</Text>
            <Text
              style={{
                ...settingsHebrewText,
                ...settingsBodyType,
                color: tokens.colors.text.secondary,
                marginTop: APP_LAYOUT.titleSubtitleGap,
                marginBottom: APP_LAYOUT.cardTitleToBodyGap,
              }}
            >{i18n.t('auto.screens__Profile__DeleteAccountScreen.s9')}</Text>

            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'confirm' })}>{i18n.t('auto.screens__Profile__DeleteAccountScreen.s10')}</Text>
            <View style={shell('confirm')}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                autoCapitalize="none"
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                style={[formFieldInputStyle(), { color: tokens.colors.text.primary }]}
                placeholder={i18n.t('auto.screens__Profile__DeleteAccountScreen.s11')}
                placeholderTextColor={tokens.colors.text.muted}
              />
            </View>

            <Text style={formFieldLabelStyle({ tokens, focused: focused === 'password' })}>{i18n.t('auto.screens__Profile__DeleteAccountScreen.s12')}</Text>
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
              title={i18n.t('auto.screens__Profile__DeleteAccountScreen.s13')}
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
