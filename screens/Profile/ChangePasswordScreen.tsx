import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
  const borderColor = error
    ? tokens.colors.border.danger
    : focused
      ? tokens.colors.primary.main
      : tokens.colors.border.divider;

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: tokens.colors.text.tertiary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: tokens.colors.background.input,
            borderColor,
            borderRadius: tokens.borderRadius.md,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            void HapticFeedback.selection();
            onToggleVisible();
          }}
          hitSlop={10}
          style={styles.eyeBtn}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
        >
          {visible ? (
            <EyeOff size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
          ) : (
            <Eye size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
          )}
        </Pressable>
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
          style={[styles.input, { color: tokens.colors.text.primary }]}
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
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleSave = async () => {
    setFormError(null);

    if (!user?.email) {
      setFormError('לא נמצא אימייל למשתמש');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('נא למלא את כל השדות');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('הסיסמאות החדשות אינן תואמות');
      return;
    }
    if (currentPassword === newPassword) {
      setFormError('הסיסמה החדשה חייבת להיות שונה מהנוכחית');
      return;
    }

    setSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setFormError('הסיסמה הנוכחית שגויה');
        void HapticFeedback.warning();
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setFormError(updateError.message || 'עדכון הסיסמה נכשל');
        void HapticFeedback.warning();
        return;
      }

      void HapticFeedback.success();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      legacyAlert('הצלחה', 'הסיסמה עודכנה בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'שגיאה בעדכון סיסמה');
      void HapticFeedback.warning();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ChatSubScreenHeader
        title="שינוי סיסמה"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: tokens.spacing.base,
            paddingTop: tokens.spacing.sm,
            paddingBottom: tokens.spacing.xl,
          }}
        >
          <Text
            style={[
              styles.intro,
              { color: tokens.colors.text.secondary },
            ]}
          >
            נאמת את הסיסמה הנוכחית ואז נשמור סיסמה חדשה.
          </Text>

          <UICard
            variant="glass"
            glassIntensity="light"
            padding="md"
            style={{
              borderRadius: tokens.borderRadius.xl,
              borderWidth: 1,
              borderColor: tokens.colors.border.main,
            }}
          >
            <PasswordField
              label="סיסמה נוכחית"
              value={currentPassword}
              onChangeText={(v) => {
                setCurrentPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder="הזינו את הסיסמה הנוכחית"
              visible={showCurrent}
              onToggleVisible={() => setShowCurrent((s) => !s)}
              tokens={tokens}
              editable={!saving}
            />

            <PasswordField
              label="סיסמה חדשה"
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder="לפחות 8 תווים"
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
                              : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                  חוזק: {strengthLabel}
                </Text>
              </View>
            ) : null}

            <PasswordField
              label="אימות סיסמה חדשה"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (formError) setFormError(null);
              }}
              placeholder="הקלידו שוב את הסיסמה החדשה"
              visible={showConfirm}
              onToggleVisible={() => setShowConfirm((s) => !s)}
              tokens={tokens}
              error={confirmMismatch}
              editable={!saving}
            />

            {confirmMismatch ? (
              <Text
                style={[styles.inlineHint, { color: tokens.colors.danger.main }]}
              >
                הסיסמאות אינן תואמות
              </Text>
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
                >
                  הסיסמאות תואמות
                </Text>
              </View>
            ) : null}

            {formError ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: `${tokens.colors.danger.main}18`,
                    borderColor: tokens.colors.border.danger,
                  },
                ]}
              >
                <Text
                  style={{
                    color: tokens.colors.danger.main,
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: '600',
                    lineHeight: 18,
                  }}
                >
                  {formError}
                </Text>
              </View>
            ) : null}
          </UICard>
        </ScrollView>

        <View
          style={[
            styles.saveBar,
            {
              paddingHorizontal: tokens.spacing.base,
              paddingTop: tokens.spacing.sm,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: tokens.colors.border.subtle,
              backgroundColor: 'rgba(10, 14, 10, 0.92)',
            },
          ]}
        >
          <TouchableOpacity
            disabled={!canSubmit}
            onPress={() => {
              void HapticFeedback.medium();
              void handleSave();
            }}
            activeOpacity={0.85}
            style={[
              styles.submitBtn,
              {
                backgroundColor: tokens.colors.primary.main,
                borderRadius: 999,
                opacity: canSubmit ? 1 : 0.45,
                ...tokens.shadows.greenGlow,
              },
            ]}
          >
            {saving ? (
              <View style={styles.saveBusy}>
                <ActivityIndicator size="small" color={tokens.colors.text.inverse} />
                <Text
                  style={[
                    styles.submitText,
                    { color: tokens.colors.text.inverse },
                  ]}
                >
                  מעדכן...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: tokens.colors.text.inverse },
                ]}
              >
                עדכן סיסמה
              </Text>
            )}
          </TouchableOpacity>
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
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'right',
    marginBottom: 8,
  },
  inputShell: {
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'right',
    paddingVertical: 13,
    paddingHorizontal: 0,
    minHeight: 48,
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  strengthBlock: {
    marginTop: -8,
    marginBottom: 16,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  inlineHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -8,
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: -8,
    marginBottom: 12,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  saveBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  saveBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
