import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import { isPasswordValid, passwordErrorMessage } from '../../utils/passwordPolicy';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Platform,
  StyleSheet,
} from 'react-native';
// edge-to-edge (SDK 58): adjustResize לא מקטין את החלון באנדרואיד — KAV של keyboard-controller עובד בשתי הפלטפורמות
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { PasswordVisibilityToggle } from '../../components/ui/PasswordVisibilityToggle';
import UIButton from '../../components/ui/UIButton';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  settingsHebrewText,
  settingsMetaType,
  settingsCaptionType,
} from '../../components/profile/settingsType';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  tokens: ReturnType<typeof useDesignTokens>;
  error?: boolean;
  editable?: boolean;
};

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisible,
  tokens,
  error,
  editable = true,
}: PasswordFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text
        style={[
          formFieldLabelStyle({ tokens, focused, error }),
          styles.fieldLabel,
          !error && { color: tokens.colors.text.secondary },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          formFieldShellStyle({ tokens, focused, error }),
          {
            borderRadius: tokens.borderRadius.full,
            backgroundColor: focused
              ? tokens.colors.background.tertiary
              : tokens.colors.background.cardSolid,
          },
        ]}
      >
        <PasswordVisibilityToggle visible={visible} onToggle={onToggleVisible} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.text.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textContentType="password"
          style={[formFieldInputStyle(), { color: tokens.colors.text.primary }]}
        />
      </View>
    </View>
  );
}

function strengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

const STRENGTH_LABELS = ['חלשה', 'בינונית', 'טובה', 'חזקה'] as const;

export default function ChangePasswordScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const strength = useMemo(() => strengthScore(newPassword), [newPassword]);
  const strengthLabel =
    newPassword.length === 0
      ? null
      : STRENGTH_LABELS[Math.max(0, strength - 1)] ?? STRENGTH_LABELS[0];
  const strengthColor =
    strength <= 1
      ? tokens.colors.danger.main
      : strength === 2
        ? tokens.colors.warning.main
        : tokens.colors.primary.main;

  const confirmMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    !saving &&
    currentPassword.length > 0 &&
    isPasswordValid(newPassword, user?.email) &&
    newPassword === confirmPassword;

  const handleSave = async () => {
    setFormError(null);

    if (!user?.email) {
      setFormError(i18n.t('auto.screens__Profile__ChangePasswordScreen.s1'));
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError(i18n.t('auto.screens__Profile__ChangePasswordScreen.s2'));
      return;
    }
    {
      const policyError = passwordErrorMessage(newPassword, user.email);
      if (policyError) {
        setFormError(policyError);
        return;
      }
    }
    if (newPassword !== confirmPassword) {
      setFormError(i18n.t('auto.screens__Profile__ChangePasswordScreen.s3'));
      return;
    }
    if (currentPassword === newPassword) {
      setFormError(i18n.t('auto.screens__Profile__ChangePasswordScreen.s4'));
      return;
    }

    setSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setFormError(i18n.t('auto.screens__Profile__ChangePasswordScreen.s5'));
        void HapticFeedback.warning();
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setFormError(updateError.message || i18n.t('auto.screens__Profile__ChangePasswordScreen.s6'));
        void HapticFeedback.warning();
        return;
      }

      void HapticFeedback.success();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      legacyAlert(i18n.t('auto.screens__Profile__ChangePasswordScreen.s7'), i18n.t('auto.screens__Profile__ChangePasswordScreen.s8'), [
        { text: i18n.t('auto.screens__Profile__ChangePasswordScreen.s9'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : i18n.t('auto.screens__Profile__ChangePasswordScreen.s10'));
      void HapticFeedback.warning();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}
      edges={['top']}
    >
      <ChatSubScreenHeader
        title={i18n.t('auto.screens__Profile__ChangePasswordScreen.s11')}
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: APP_LAYOUT.sectionHeaderToContent,
            paddingBottom: APP_LAYOUT.componentGap,
          }}
        >
          <Text style={[styles.intro, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Profile__ChangePasswordScreen.s12')}</Text>

          <View>
            <PasswordField
              label={i18n.t('auto.screens__Profile__ChangePasswordScreen.s13')}
              value={currentPassword}
              onChangeText={(v) => {
                setCurrentPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder={i18n.t('auto.screens__Profile__ChangePasswordScreen.s14')}
              visible={showCurrent}
              onToggleVisible={() => setShowCurrent((s) => !s)}
              tokens={tokens}
              editable={!saving}
            />

            <PasswordField
              label={i18n.t('auto.screens__Profile__ChangePasswordScreen.s15')}
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder={i18n.t('auto.screens__Profile__ChangePasswordScreen.s16')}
              visible={showNew}
              onToggleVisible={() => setShowNew((s) => !s)}
              tokens={tokens}
              editable={!saving}
            />

            {newPassword.length > 0 ? (
              <View style={styles.strengthBlock}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            i < strength
                              ? strengthColor
                              : tokens.colors.background.tertiary,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>{i18n.t('auto.screens__Profile__ChangePasswordScreen.s17', { v0: strengthLabel })}
                </Text>
              </View>
            ) : null}

            <PasswordField
              label={i18n.t('auto.screens__Profile__ChangePasswordScreen.s18')}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder={i18n.t('auto.screens__Profile__ChangePasswordScreen.s19')}
              visible={showConfirm}
              onToggleVisible={() => setShowConfirm((s) => !s)}
              tokens={tokens}
              error={confirmMismatch}
              editable={!saving}
            />

            {confirmMismatch ? (
              <Text
                style={[styles.inlineHint, { color: tokens.colors.danger.main }]}
              >{i18n.t('auto.screens__Profile__ChangePasswordScreen.s20')}</Text>
            ) : confirmPassword.length > 0 && newPassword === confirmPassword ? (
              <View style={styles.matchRow}>
                <ShieldCheck
                  size={14}
                  color={tokens.colors.primary.main}
                  strokeWidth={2.4}
                />
                <Text
                  style={[
                    styles.inlineHint,
                    { color: tokens.colors.primary.main, marginBottom: 0 },
                  ]}
                >{i18n.t('auto.screens__Profile__ChangePasswordScreen.s21')}</Text>
              </View>
            ) : null}

            {formError ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                ]}
              >
                <Text
                  style={[
                    styles.inlineHint,
                    { color: tokens.colors.danger.main, marginTop: 0, marginBottom: 0 },
                  ]}
                >
                  {formError}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={[
            styles.saveBar,
            {
              paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
              paddingTop: APP_LAYOUT.cardStackGap,
              paddingBottom: Math.max(insets.bottom, APP_LAYOUT.cardStackGap),
              backgroundColor: tokens.colors.background.primary,
            },
          ]}
        >
          <UIButton
            title={saving ? i18n.t('auto.screens__Profile__ChangePasswordScreen.s22') : i18n.t('auto.screens__Profile__ChangePasswordScreen.s23')}
            variant="primary"
            fullWidth
            loading={saving}
            disabled={!canSubmit || saving}
            onPress={() => {
              void HapticFeedback.medium();
              void handleSave();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  intro: {
    ...settingsHebrewText,
    ...settingsMetaType,
    width: '100%',
    textAlign: 'right',
    marginBottom: APP_LAYOUT.componentGap,
  },
  fieldBlock: {
    marginBottom: APP_LAYOUT.componentGap,
  },
  fieldLabel: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'right',
    marginBottom: APP_LAYOUT.groupLabelToContent,
    fontSize: APP_TYPE.groupLabel.fontSize,
    fontWeight: APP_TYPE.groupLabel.fontWeight,
    lineHeight: APP_TYPE.groupLabel.lineHeight,
  },
  inputShell: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBlock: {
    marginBottom: APP_LAYOUT.componentGap,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: APP_LAYOUT.stackGapSmall,
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    ...settingsHebrewText,
    ...settingsCaptionType,
    width: '100%',
    textAlign: 'right',
  },
  inlineHint: {
    ...settingsHebrewText,
    ...settingsCaptionType,
    width: '100%',
    textAlign: 'right',
    marginTop: APP_LAYOUT.stackGapSmall,
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: APP_LAYOUT.stackGapSmall,
    marginTop: APP_LAYOUT.stackGapSmall,
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  errorBanner: {
    borderRadius: APP_LAYOUT.cardStackGap,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: APP_LAYOUT.stackGapSmall,
  },
  saveBar: {},
});
