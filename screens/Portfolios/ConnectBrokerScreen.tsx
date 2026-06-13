import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { connectColmex } from '../../services/brokers';
import type { BrokerEnvironment } from '../../services/brokers';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'ConnectBroker'>;

export default function ConnectBrokerScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [environment, setEnvironment] = useState<BrokerEnvironment>('uat');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: { padding: 16, paddingBottom: 80 },
        heroCard: {
          backgroundColor: 'rgba(0, 200, 5, 0.08)',
          borderColor: 'rgba(0, 200, 5, 0.25)',
          borderWidth: 1.5,
          borderRadius: 24,
          padding: 16,
          marginBottom: 22,
          flexDirection: 'row-reverse',
          gap: 12,
          overflow: 'hidden',
        },
        heroIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(0, 200, 5, 0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        heroTitle: {
          fontSize: 16,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 4,
        },
        heroBody: {
          fontSize: 12,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 18,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          marginBottom: 10,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        input: {
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 28,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 15,
          color: tokens.colors.text.primary,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          textAlign: 'right',
          writingDirection: 'rtl',
          overflow: 'hidden',
        },
        passwordWrap: { position: 'relative' },
        eyeBtn: {
          position: 'absolute',
          left: 12,
          top: 12,
          padding: 6,
        },
        section: { marginBottom: 22 },
        envRow: {
          flexDirection: 'row-reverse',
          gap: 10,
        },
        envChip: {
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
          alignItems: 'center',
        },
        envChipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: 'rgba(0, 200, 5, 0.12)',
        },
        envLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
          writingDirection: 'rtl',
        },
        envLabelActive: { color: tokens.colors.primary.main },
        envHint: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 4,
          writingDirection: 'rtl',
          textAlign: 'center',
        },
        submit: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingVertical: 16,
          borderRadius: 32,
          marginTop: 8,
          ...tokens.shadows.md,
        },
        submitText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        privacyBlock: {
          marginTop: 18,
          padding: 14,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        privacyTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 4,
        },
        privacyText: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 16,
        },
      }),
    [tokens]
  );

  const handleConnect = useCallback(async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      Alert.alert('שגיאה', 'יש להזין שם משתמש וסיסמה של Colmex Pro');
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
      const msg = (e as Error).message ?? 'unknown';
      const friendly =
        msg.includes('broker_auth_failed') || msg.includes('401')
          ? 'שם משתמש או סיסמה שגויים'
          : msg.includes('no_accounts_found')
          ? 'לא נמצאו חשבונות trading בחשבון Colmex Pro שלך.'
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
        <PortfolioScreenHeader
          title="חיבור Colmex Pro"
          onBack={() => navigation.goBack()}
        />
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="link" size={22} color={tokens.colors.primary.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>שכפול תיק 1:1</Text>
                <Text style={styles.heroBody}>
                  לאחר ההתחברות נסנכרן את כל החשבון שלך: פוזיציות פתוחות, פקודות עתידיות,
                  הפקדות ומשיכות, יתרת הון, ועסקאות היסטוריות.
                </Text>
              </View>
            </View>

            {/* Environment */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>סביבה</Text>
              <View style={styles.envRow}>
                <TouchableOpacity
                  style={[styles.envChip, environment === 'uat' && styles.envChipActive]}
                  onPress={() => {
                    if (environment !== 'uat') void HapticFeedback.selection();
                    setEnvironment('uat');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.envLabel, environment === 'uat' && styles.envLabelActive]}>
                    Demo / UAT
                  </Text>
                  <Text style={styles.envHint}>לבדיקות עם DMAPI*</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.envChip, environment === 'prod' && styles.envChipActive]}
                  onPress={() => {
                    if (environment !== 'prod') void HapticFeedback.selection();
                    setEnvironment('prod');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.envLabel, environment === 'prod' && styles.envLabelActive]}>
                    Production
                  </Text>
                  <Text style={styles.envHint}>חשבון אמיתי</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Credentials */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>שם משתמש</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="DMAPI4"
                placeholderTextColor={tokens.colors.text.tertiary}
                editable={!submitting}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>סיסמה</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="••••••••"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  editable={!submitting}
                />
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.selection();
                    setShowPassword((s) => !s);
                  }}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={tokens.colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submit, submitting && { opacity: 0.7 }]}
              onPress={() => {
                void HapticFeedback.medium();
                void handleConnect();
              }}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.colors.text.inverse} />
              ) : (
                <Ionicons name="link" size={20} color={tokens.colors.text.inverse} />
              )}
              <Text style={styles.submitText}>
                {submitting ? 'מתחבר…' : 'התחבר ל-Colmex Pro'}
              </Text>
            </TouchableOpacity>

            <View style={styles.privacyBlock}>
              <Text style={styles.privacyTitle}>פרטיות ואבטחה</Text>
              <Text style={styles.privacyText}>
                שם המשתמש והסיסמה מועברים ישירות לשרת המאובטח שלנו, מוצפנים ב-Supabase Vault
                ולעולם אינם נשמרים במכשיר. ניתן לנתק את החיבור בכל עת מהגדרות התיק.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
