import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { legacyAlert } from '../../utils/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import {
  SectionHeader,
  TextField,
} from './components/PortfolioFormFields';
import { PortfolioFormFooter } from './components/PortfolioFormFooter';
import {
  journalCardBodyStyle,
  journalCardSubtitleStyle,
  JOURNAL_LAYOUT,
  PORTFOLIO_FORM,
} from './portfolioLayout';
import { connectColmex, BrokerEdgeError } from '../../services/brokers';
import type { BrokerAuthFailure, BrokerEnvironment } from '../../services/brokers';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        root: { flex: 1, backgroundColor: 'transparent' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          paddingHorizontal: PORTFOLIO_FORM.screenPadH,
          paddingTop: 4,
          paddingBottom: 28,
        },
        section: { marginBottom: PORTFOLIO_FORM.sectionGap },
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
          ...journalCardBodyStyle,
          color: tokens.colors.text.secondary,
        },
        privacyTitleRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginBottom: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
        },
        privacyTitle: {
          ...journalCardSubtitleStyle,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        privacyText: {
          ...journalCardSubtitleStyle,
          color: tokens.colors.text.muted,
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
        legacyAlert('לא נמצאו חשבונות', 'לחשבון Colmex Pro שלך לא משויכים חשבונות trading.');
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
      legacyAlert('חיבור נכשל', friendly);
    } finally {
      setSubmitting(false);
    }
  }, [username, password, environment, navigation]);

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
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
                variant="soft"
                padding="md"
                disableBlur
                style={{
                  borderWidth: 0,
                }}
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
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) void handleConnect();
                }}
                spacing={0}
              />
            </View>

            <UICard variant="soft" padding="md" disableBlur>
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
            </UICard>
          </ScrollView>

          <PortfolioFormFooter
            title={submitting ? 'מתחבר…' : 'התחבר ל-Colmex Pro'}
            icon="link"
            disabled={!canSubmit}
            loading={submitting}
            onPress={() => void handleConnect()}
            note={dimmed ? usernameError ?? passwordError : null}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
