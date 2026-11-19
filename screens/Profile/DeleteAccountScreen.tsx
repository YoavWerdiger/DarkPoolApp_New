import i18n from '../../lib/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { Text, ScrollView, TextInput, View, Linking, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// edge-to-edge (SDK 58): adjustResize לא מקטין את החלון באנדרואיד — KAV של keyboard-controller עובד בשתי הפלטפורמות
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { deleteOwnAccount } from '../../services/supportService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import { SettingsGlassCard } from '../../components/profile/ProfileSettingsUI';
import { settingsHebrewText, settingsRowType, settingsBodyType } from '../../components/profile/settingsType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { formFieldInputStyle, formFieldLabelStyle, formFieldShellStyle } from '../../components/ui/formControl';
import UIButton from '../../components/ui/UIButton';
import { PasswordVisibilityToggle } from '../../components/ui/PasswordVisibilityToggle';
import { ActivityIndicator } from '../../components/ui/AppSpinner';

/**
 * מחיקת חשבון — שלושה שלבים (כמו Spotify / Instagram / Discord):
 *  1. «לפני שנפרדים» — שיחה עם ברוך בוואטסאפ (שימור), קישור משני להמשך
 *  2. «מה יקרה» — מה נמחק ומה נשאר, לפי מה ש-delete-account עושה בפועל
 *  3. אישור סופי — סיסמה (לחשבונות עם סיסמה) + «החזק כדי למחוק» (2 שניות)
 * המחיקה עצמה נשארת זמינה מתוך האפליקציה — חובה ב-App Store 5.1.1(v) ו-Google Play.
 */

const RETENTION_WHATSAPP = '972522703909';
const HOLD_MS = 2000;
const t = (k: string) => i18n.t(`auto.screens__Profile__DeleteAccountScreen.${k}`);

type Step = 'retain' | 'impact' | 'confirm';

export default function DeleteAccountScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { colors } = tokens;
  const { signOut } = useAuth();
  const [step, setStep] = useState<Step>('retain');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openWhatsApp = async () => {
    void HapticFeedback.impactLight();
    const url = `https://wa.me/${RETENTION_WHATSAPP}?text=${encodeURIComponent(t('s18'))}`;
    try {
      await Linking.openURL(url);
    } catch {
      legacyAlert(t('s19'), t('s20'));
    }
  };

  const runDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      // השרת (delete-account) מצפה ל«מחק» — האישור כאן הוא הלחיצה הממושכת
      await deleteOwnAccount({ confirm: 'מחק', password: password || undefined });
      void HapticFeedback.warning();
      await signOut();
    } catch (e) {
      setDeleting(false);
      legacyAlert(t('s7'), e instanceof Error ? e.message : t('s7'));
    }
  };

  const goBack = () => {
    if (step === 'confirm') setStep('impact');
    else if (step === 'impact') setStep('retain');
    else navigation.goBack();
  };

  const body = { ...settingsHebrewText, ...settingsBodyType, color: colors.text.secondary } as const;
  const title = { ...settingsHebrewText, ...settingsRowType, color: colors.text.primary } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={t('s3')} onBack={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: APP_LAYOUT.sectionHeaderToContent,
            paddingBottom: 48,
            gap: APP_LAYOUT.cardStackGap,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <StepDots step={step} />

          {step === 'retain' ? (
            <SettingsGlassCard style={{ padding: APP_LAYOUT.cardPadding }}>
              <Text style={title}>{t('s21')}</Text>
              <Text style={[body, { marginTop: APP_LAYOUT.titleSubtitleGap }]}>{t('s22')}</Text>
              <View style={{ gap: 10, marginTop: APP_LAYOUT.cardStackGap }}>
                <UIButton title={t('s16')} variant="primary" fullWidth icon="logo-whatsapp" onPress={() => void openWhatsApp()} />
                <Pressable
                  onPress={() => {
                    void HapticFeedback.selection();
                    setStep('impact');
                  }}
                  hitSlop={8}
                  style={{ alignSelf: 'center', paddingVertical: 6 }}
                  accessibilityRole="button"
                >
                  <Text style={{ ...settingsBodyType, color: colors.text.tertiary, textDecorationLine: 'underline' }}>
                    {t('s23')}
                  </Text>
                </Pressable>
              </View>
            </SettingsGlassCard>
          ) : null}

          {step === 'impact' ? (
            <>
              <SettingsGlassCard style={{ padding: APP_LAYOUT.cardPadding }}>
                <Text style={title}>{t('s24')}</Text>
                <Text style={[body, { marginTop: APP_LAYOUT.titleSubtitleGap }]}>{t('s25')}</Text>
                <View style={{ marginTop: APP_LAYOUT.cardStackGap, gap: 14 }}>
                  <ImpactRow icon="person-remove-outline" title={t('s26')} text={t('s27')} />
                  <ImpactRow icon="card-outline" title={t('s28')} text={t('s29')} />
                  <ImpactRow icon="chatbubbles-outline" title={t('s30')} text={t('s31')} />
                  <ImpactRow icon="link-outline" title={t('s32')} text={t('s33')} />
                  <ImpactRow icon="notifications-off-outline" title={t('s34')} text={t('s35')} />
                </View>
              </SettingsGlassCard>
              <View style={[styles.warn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger.main} />
                <Text style={[body, { flex: 1, color: colors.danger.main }]}>{t('s36')}</Text>
              </View>
              <UIButton title={t('s37')} variant="secondary" fullWidth onPress={() => setStep('confirm')} />
              <UIButton title={t('s38')} variant="ghost" fullWidth onPress={() => navigation.goBack()} />
            </>
          ) : null}

          {step === 'confirm' ? (
            <SettingsGlassCard style={{ padding: APP_LAYOUT.cardPadding }}>
              <Text style={title}>{t('s39')}</Text>
              <Text style={[body, { marginTop: APP_LAYOUT.titleSubtitleGap, marginBottom: APP_LAYOUT.cardStackGap }]}>
                {t('s40')}
              </Text>

              <Text style={formFieldLabelStyle({ tokens, focused })}>{t('s41')}</Text>
              <View
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: tokens.borderRadius.full,
                    paddingHorizontal: APP_LAYOUT.cardPadding,
                    minHeight: 52,
                    marginBottom: APP_LAYOUT.cardStackGap,
                  },
                  formFieldShellStyle({ tokens, focused, error: false }),
                ]}
              >
                <PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={[formFieldInputStyle(), { color: colors.text.primary }]}
                  placeholder={t('s42')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <HoldToDelete label={t('s43')} busyLabel={t('s44')} busy={deleting} onComplete={() => void runDelete()} />
              <Text style={[body, { textAlign: 'center', marginTop: 10, fontSize: 13 }]}>{t('s45')}</Text>
            </SettingsGlassCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepDots({ step }: { step: Step }) {
  const tokens = useDesignTokens();
  const order: Step[] = ['retain', 'impact', 'confirm'];
  const idx = order.indexOf(step);
  return (
    <View style={{ flexDirection: 'row-reverse', alignSelf: 'center', gap: 6 }}>
      {order.map((s, i) => (
        <View
          key={s}
          style={{
            width: i === idx ? 22 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i <= idx ? tokens.colors.text.primary : tokens.colors.border.divider,
          }}
        />
      ))}
    </View>
  );
}

function ImpactRow({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors } = useDesignTokens();
  return (
    <View style={{ flexDirection: 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
      <View style={[styles.iconWrap, { backgroundColor: colors.background.tertiary }]}>
        <Ionicons name={icon} size={18} color={colors.text.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...settingsHebrewText, ...settingsRowType, fontSize: 15, color: colors.text.primary }}>{title}</Text>
        <Text style={{ ...settingsHebrewText, ...settingsBodyType, fontSize: 13, color: colors.text.secondary }}>{text}</Text>
      </View>
    </View>
  );
}

/** «החזק כדי למחוק» — לחיצה ממושכת של 2 שניות עם מילוי; שחרור מוקדם מבטל */
function HoldToDelete({
  label,
  busyLabel,
  busy,
  onComplete,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  onComplete: () => void;
}) {
  const { colors } = useDesignTokens();
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => () => anim.current?.stop(), []);

  const start = () => {
    if (busy) return;
    void HapticFeedback.impactLight();
    anim.current?.stop();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) {
        void HapticFeedback.warning();
        onComplete();
      }
    });
  };

  const cancel = () => {
    if (busy) return;
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={busy}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.hold, { borderColor: colors.danger.main }]}
    >
      <Animated.View style={[styles.holdFill, { width: busy ? '100%' : fillWidth, backgroundColor: colors.danger.main }]} />
      <View style={styles.holdContent}>
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="trash-outline" size={18} color={colors.danger.main} />}
        <Text style={{ fontSize: 16, fontWeight: '600', color: busy ? '#FFFFFF' : colors.danger.main }}>
          {busy ? busyLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  warn: {
    flexDirection: 'row-reverse',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  hold: {
    height: 56,
    borderRadius: 9999,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  holdFill: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  holdContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
