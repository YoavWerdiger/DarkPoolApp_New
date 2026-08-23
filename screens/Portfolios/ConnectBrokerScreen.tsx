import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { SectionHeader, TextField } from './components/PortfolioFormFields';
import { connectColmex, BrokerEdgeError } from '../../services/brokers';
import type { BrokerAuthFailure, BrokerEnvironment } from '../../services/brokers';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'ConnectBroker'>;

/**
 * Colmex (TraderEvolution) מחזיר הודעה גנרית אחת — "User/password combination is
 * not valid" — לכל דחיית אימות: סיסמה שגויה, סיסמה שממתינה להחלפה אחרי איפוס
 * מצד הברוקר, וגם חשבון שאינו במצב פעיל. לכן אסור להציג "סיסמה שגויה" כעובדה.
 *
 * מונה הניסיונות ("Attempt 2 of 10") מצורף רק כשהלוגין מזוהה כמשתמש קיים בשרת,
 * ולכן הוא מאפשר לנו לומר למשתמש בוודאות ששם המשתמש תקין ולכוון אותו לסיסמה —
 * וגם להזהיר אותו לפני שהחשבון ננעל.
 *
 * הסיווג עצמו נעשה ב-Edge Function (classifyAuthFailure); כאן משתמשים בו כשהוא
 * קיים, ונופלים לניתוח הטקסט הגולמי רק מול גרסת function ישנה שעדיין לא מחזירה
 * את השדות המובנים.
 */
function describeColmexAuthFailure(
  failure: BrokerAuthFailure | null,
  rawMessage: string
): string {
  const m = /attempt\s*(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(rawMessage);
  const attempt =
    failure?.attempt ?? (m ? { current: Number(m[1]), max: Number(m[2]) } : null);
  const locked = failure
    ? failure.reason === 'account_locked'
    : /lock|block|brute|disabled|suspend/i.test(rawMessage) ||
      (attempt !== null && attempt.current >= attempt.max);

  if (locked) {
    return 'החשבון ננעל לאחר יותר מדי ניסיונות התחברות כושלים. יש לפנות לתמיכת Colmex Pro כדי לשחרר את החשבון ולאפס סיסמה.';
  }

  if (failure?.reason === 'rate_limited') {
    return 'יותר מדי ניסיונות התחברות בזמן קצר. יש להמתין מספר דקות ולנסות שוב.';
  }

  if (failure?.reason === 'broker_unavailable') {
    return 'שרתי Colmex Pro אינם זמינים כרגע. נסה שוב בעוד מספר דקות.';
  }

  if (attempt) {
    const remaining = Math.max(0, attempt.max - attempt.current);
    return (
      'שם המשתמש זוהה אצל Colmex Pro, אבל ההתחברות נדחתה. בדרך כלל הסיבה היא ' +
      'סיסמה שגויה, או סיסמה שאופסה על ידי Colmex וממתינה להחלפה בכניסה ' +
      'הראשונה לפלטפורמת המסחר.\n\n' +
      'מומלץ להתחבר תחילה לפלטפורמת המסחר של Colmex Pro עם אותם פרטים, ' +
      'ואם נדרש — להחליף שם סיסמה ואז לנסות שוב כאן.\n\n' +
      `שים לב: נותרו ${remaining} ניסיונות לפני שהחשבון ננעל.`
    );
  }

  return (
    'ההתחברות ל-Colmex Pro נדחתה. יש לוודא ששם המשתמש הוא שם המשתמש לפלטפורמת ' +
    'המסחר (ולא מספר החשבון), ושהסיסמה עדכנית.\n\n' +
    'אם הסיסמה אופסה לאחרונה על ידי Colmex, ייתכן שצריך להחליף אותה פעם אחת ' +
    'בפלטפורמת המסחר לפני שאפשר להתחבר כאן.'
  );
}

export default function ConnectBrokerScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [environment] = useState<BrokerEnvironment>('prod');
  const [submitting, setSubmitting] = useState(false);

  const usernameError = username.trim().length === 0 ? 'יש להזין שם משתמש' : null;
  const passwordError = password.length === 0 ? 'יש להזין סיסמה' : null;
  const canSubmit = !usernameError && !passwordError && !submitting;
  const dimmed = !canSubmit && !submitting;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 28,
        },
        section: { marginBottom: 26 },
        heroRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
        },
        heroIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        heroLogo: { width: 44, height: 44 },
        heroBody: {
          fontSize: 13,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 20,
        },
        eyeBtn: { padding: 6 },
        privacyBlock: {
          padding: 14,
          borderRadius: tokens.borderRadius.xl,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: tokens.colors.glass.card.border,
          backgroundColor: tokens.colors.background.surface,
          overflow: 'hidden',
        },
        privacyTitleRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
        },
        privacyTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        privacyText: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 16,
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.colors.border.divider,
          backgroundColor: 'rgba(10, 14, 10, 0.92)',
        },
        submit: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingVertical: 16,
          borderRadius: tokens.borderRadius.full,
          ...tokens.shadows.md,
        },
        submitDisabled: {
          backgroundColor: tokens.colors.background.elevated,
          shadowOpacity: 0,
          elevation: 0,
        },
        submitText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        submitTextDisabled: { color: tokens.colors.text.disabled },
        footerNote: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
          marginTop: 8,
        },
      }),
    [tokens]
  );

  const handleConnect = useCallback(async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setTouchedUsername(true);
      setTouchedPassword(true);
      return;
    }
    try {
      setSubmitting(true);
      const res = await connectColmex({ username: u, password: p, environment });
      if (!res.accounts || res.accounts.length === 0) {
        Alert.alert('לא נמצאו חשבונות', 'לחשבון Colmex Pro שלך לא משויכים חשבונות trading.');
        return;
      }
      navigation.replace('SelectBrokerAccount', {
        connectionId: res.connectionId,
      });
    } catch (e) {
      const msg = ((e as Error).message ?? '').trim();
      const lower = msg.toLowerCase();
      const failure = e instanceof BrokerEdgeError ? e.authFailure : null;
      const isAuthFail =
        failure !== null ||
        lower.includes('broker_auth_failed') ||
        lower.includes('user/password') ||
        lower.includes('authorize failed') ||
        lower.includes('unauthorized') ||
        /\b401\b/.test(msg);
      const friendly = isAuthFail
        ? describeColmexAuthFailure(failure, msg)
        : lower.includes('no_accounts_found')
        ? 'לא נמצאו חשבונות trading בחשבון Colmex Pro שלך.'
        : lower.includes('vault_write_failed')
        ? 'שגיאה בשמירת פרטי אבטחה. פנה לתמיכה.'
        : lower.includes('connection_save_failed')
        ? 'שגיאה בשמירת החיבור. פנה לתמיכה.'
        : lower.includes('accounts_save_failed') || lower.includes('broker_accounts_failed')
        ? 'שגיאה בטעינת חשבונות Colmex. נסה שוב.'
        : lower.includes('non-2xx') || lower.includes('edge function')
        ? 'החיבור לשרת נכשל. נסה שוב בעוד רגע.'
        : msg
        ? `החיבור נכשל. פרטים: ${msg.slice(0, 160)}`
        : 'התרחשה שגיאה בעת החיבור. נסה שוב.';
      Alert.alert('חיבור נכשל', friendly);
    } finally {
      setSubmitting(false);
    }
  }, [username, password, environment, navigation]);

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader title="חיבור Colmex Pro" onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="none"
                showGlassBorder={false}
                style={{
                  borderRadius: tokens.borderRadius['2xl'],
                  borderWidth: 1.5,
                  borderColor: tokens.colors.border.accent,
                  backgroundColor: tokens.colors.primary.subtle,
                }}
                contentContainerStyle={{ padding: 16 }}
              >
                <View style={styles.heroRow}>
                  <View style={styles.heroIcon}>
                    <Image
                      source={require('../../assets/colmex-logo.png')}
                      style={styles.heroLogo}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroBody}>
                      לאחר ההתחברות נסנכרן את כל החשבון שלך: פוזיציות פתוחות, פקודות
                      עתידיות, הפקדות ומשיכות, יתרת הון, ועסקאות היסטוריות.
                    </Text>
                  </View>
                </View>
              </UICard>
            </View>

            <View style={styles.section}>
              <SectionHeader
                title="פרטי התחברות"
                caption="אותם פרטים שבהם את/ה מתחבר/ת לפלטפורמת המסחר של Colmex Pro."
              />

              <TextField
                label="שם משתמש"
                value={username}
                onChangeText={setUsername}
                onBlur={() => setTouchedUsername(true)}
                placeholder="שם המשתמש שלך ב-Colmex"
                hint="שם המשתמש שהתקבל מ-Colmex Pro"
                error={touchedUsername ? usernameError : null}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />

              <TextField
                label="סיסמה"
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouchedPassword(true)}
                placeholder="••••••••"
                hint="הסיסמה לפלטפורמת המסחר של Colmex"
                error={touchedPassword ? passwordError : null}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) void handleConnect();
                }}
                spacing={0}
                accessory={
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      setShowPassword((s) => !s);
                    }}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={tokens.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            <View style={styles.privacyBlock}>
              <View style={styles.privacyTitleRow}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={tokens.colors.text.secondary}
                />
                <Text style={styles.privacyTitle}>פרטיות ואבטחה</Text>
              </View>
              <Text style={styles.privacyText}>
                פרטי ההתחברות מועברים בתקשורת מוצפנת לשרת המאובטח שלנו, נשמרים בהצפנה
                ואינם נשמרים על המכשיר. אנחנו מבקשים גישת קריאה בלבד לצורך הצגת התיק,
                וניתן לנתק את החיבור בכל עת מהגדרות התיק.
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity
              style={[styles.submit, dimmed && styles.submitDisabled]}
              onPress={() => {
                void HapticFeedback.medium();
                void handleConnect();
              }}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.colors.text.inverse} />
              ) : (
                <Ionicons
                  name="link"
                  size={20}
                  color={dimmed ? tokens.colors.text.disabled : tokens.colors.text.inverse}
                />
              )}
              <Text style={[styles.submitText, dimmed && styles.submitTextDisabled]}>
                {submitting ? 'מתחבר…' : 'התחבר ל-Colmex Pro'}
              </Text>
            </TouchableOpacity>
            {dimmed ? (
              <Text style={styles.footerNote}>
                {usernameError ?? passwordError}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
