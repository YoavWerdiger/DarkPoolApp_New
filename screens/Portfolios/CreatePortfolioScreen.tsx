import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import {
  FieldLabel,
  SectionHeader,
  SwitchRow,
  TextField,
} from './components/PortfolioFormFields';
import {
  BENCHMARK_PRESETS,
  DEFAULT_BENCHMARK,
  DEFAULT_CURRENCY,
  DEFAULT_RISK_FREE_RATE,
  SUPPORTED_CURRENCIES,
} from './portfolioConstants';
import { createPortfolio } from '../../services/portfolios';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'CreatePortfolio'>;

type CreateMode = 'manual' | 'import' | 'broker' | 'watchlist';

const BROKER_BENEFITS = [
  'שכפול מלא של החשבון: פוזיציות, פקודות פתוחות והיסטוריית עסקאות',
  'עדכון אוטומטי כל 15 דקות — בלי להזין עסקאות ידנית',
  'התיק נשמר במצב קריאה בלבד וניתן לנתק אותו בכל עת',
];

export default function CreatePortfolioScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<CreateMode>('manual');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [benchmark, setBenchmark] = useState(DEFAULT_BENCHMARK);
  const [riskFree, setRiskFree] = useState(String(DEFAULT_RISK_FREE_RATE));
  const [autoSplits, setAutoSplits] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState('');
  const [initialCash, setInitialCash] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [touchedCash, setTouchedCash] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBrokerMode = mode === 'broker';
  const importCsv = mode === 'import';

  const currencySymbol = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$',
    [currency]
  );

  const nameError = useMemo(
    () => (name.trim().length === 0 ? 'נא להזין שם לתיק' : null),
    [name]
  );

  const cashError = useMemo(() => {
    const raw = initialCash.trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 'יש להזין סכום מספרי תקין';
    if (parsed < 0) return 'הסכום לא יכול להיות שלילי';
    return null;
  }, [initialCash]);

  const riskError = useMemo(() => {
    const parsed = parseFloat(riskFree);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return 'יש להזין ערך בין 0 ל-100';
    }
    return null;
  }, [riskFree]);

  const blockingError = nameError ?? cashError ?? riskError;
  const canSubmit = isBrokerMode || (!blockingError && !submitting);
  const dimmed = !canSubmit && !submitting;

  // ריבית לא תקינה חיה בתוך "הגדרות מתקדמות" — נפתח אותן כדי שלא ייווצר מבוי סתום
  useEffect(() => {
    if (riskError) setAdvancedOpen(true);
  }, [riskError]);

  const handleSubmit = useCallback(async () => {
    if (mode === 'broker') {
      navigation.navigate('ConnectBroker');
      return;
    }
    if (!name.trim()) {
      setTouchedName(true);
      return;
    }
    const rfNum = parseFloat(riskFree);
    if (isNaN(rfNum) || rfNum < 0 || rfNum > 100) {
      setAdvancedOpen(true);
      return;
    }
    try {
      setSubmitting(true);
      const initialCashNum = parseFloat(initialCash) || 0;
      const portfolio = await createPortfolio({
        name: name.trim(),
        currency,
        risk_free_rate: rfNum,
        benchmark_symbol: benchmark,
        auto_adjust_splits: autoSplits,
        description: description.trim() || null,
        is_public: isPublic,
        ...(initialCashNum > 0 ? { available_cash: initialCashNum } : {}),
      });
      void HapticFeedback.success();
      // אם המשתמש בחר ייבוא – נשלח אותו ישר למסך ה-import
      if (mode === 'import') {
        navigation.replace('ImportTransactions', { portfolioId: portfolio.id });
      } else {
        navigation.replace('PortfolioDetail', { portfolioId: portfolio.id });
      }
    } catch (err) {
      Alert.alert('שגיאה', 'לא הצלחנו ליצור את התיק. נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    currency,
    riskFree,
    benchmark,
    autoSplits,
    description,
    initialCash,
    isPublic,
    mode,
    navigation,
  ]);

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
        modeCards: { gap: 12 },
        chipsRow: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 8,
        },
        chip: {
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: tokens.borderRadius.full,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: tokens.colors.glass.card.border,
          backgroundColor: tokens.colors.background.card,
          overflow: 'hidden',
        },
        chipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: tokens.colors.primary.dim,
        },
        chipText: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        chipTextActive: { color: tokens.colors.primary.main },
        advancedToggle: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: tokens.borderRadius['2xl'],
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: tokens.colors.glass.card.border,
          backgroundColor: tokens.colors.background.surface,
          overflow: 'hidden',
        },
        advancedTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        advancedCaption: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        advancedBody: { marginTop: 16 },
        benchmarkRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: tokens.borderRadius.xl,
          borderWidth: StyleSheet.hairlineWidth * 2,
          marginBottom: 8,
          overflow: 'hidden',
        },
        benchmarkLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        benchmarkDesc: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        brokerInfoRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        },
        brokerInfoText: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 19,
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

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader title="תיק חדש" onBack={() => navigation.goBack()} />
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
            {/* בחירת סוג תיק */}
            <View style={styles.section}>
              <SectionHeader
                title="איך נתחיל?"
                caption="אפשר לנהל את התיק ידנית, או לסנכרן אותו אוטומטית מחשבון המסחר."
              />
              <View style={styles.modeCards}>
                <ModeCard
                  active={!isBrokerMode}
                  icon="journal-outline"
                  title="תיק ידני"
                  description="יומן מסחר — הוספת עסקאות ידנית, מעקב ביצועים וניתוח מלא"
                  onPress={() => setMode(importCsv ? 'import' : 'manual')}
                />
                <ModeCard
                  active={isBrokerMode}
                  icon="link-outline"
                  logo={require('../../assets/colmex-logo.png')}
                  title="חיבור ברוקר"
                  description="Colmex Pro — סנכרון אוטומטי של פוזיציות, פקודות והיסטוריה"
                  onPress={() => setMode('broker')}
                />
              </View>
            </View>

            {isBrokerMode ? (
              <View style={styles.section}>
                <SectionHeader title="מה קורה בחיבור?" />
                <UICard
                  variant="glass"
                  glassIntensity="subtle"
                  padding="none"
                  style={{ borderRadius: tokens.borderRadius['2xl'] }}
                  contentContainerStyle={{ padding: 16 }}
                >
                  {BROKER_BENEFITS.map((line) => (
                    <View key={line} style={styles.brokerInfoRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={tokens.colors.primary.main}
                      />
                      <Text style={styles.brokerInfoText}>{line}</Text>
                    </View>
                  ))}
                </UICard>
              </View>
            ) : (
              <>
                {/* פרטי התיק */}
                <View style={styles.section}>
                  <SectionHeader title="פרטי התיק" />

                  <TextField
                    label="שם התיק"
                    value={name}
                    onChangeText={setName}
                    onBlur={() => setTouchedName(true)}
                    placeholder="לדוגמה: התיק הראשי"
                    hint="השם שיוצג ברשימת התיקים שלך"
                    error={touchedName ? nameError : null}
                    maxLength={128}
                    editable={!submitting}
                  />

                  <TextField
                    label="יתרת פתיחה"
                    optional
                    value={initialCash}
                    onChangeText={setInitialCash}
                    onBlur={() => setTouchedCash(true)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    numeric
                    prefix={currencySymbol}
                    hint="המזומן שהיה בתיק ביום פתיחתו. אפשר להשאיר ריק ולהוסיף הפקדה בהמשך."
                    error={touchedCash ? cashError : null}
                    editable={!submitting}
                  />

                  <FieldLabel label="מטבע התיק" />
                  <View style={styles.chipsRow}>
                    {SUPPORTED_CURRENCIES.map((c) => {
                      const active = currency === c.code;
                      return (
                        <TouchableOpacity
                          key={c.code}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => {
                            if (!active) void HapticFeedback.selection();
                            setCurrency(c.code);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {c.symbol} {c.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* נראות */}
                <View style={styles.section}>
                  <SectionHeader title="נראות" />
                  <SwitchRow
                    title="תיק ציבורי"
                    hint={
                      isPublic
                        ? 'משתמשים אחרים בקהילה יוכלו לצפות בתיק בקריאה בלבד'
                        : 'רק את/ה רואה את התיק. אפשר לשנות בכל עת מהגדרות התיק.'
                    }
                    value={isPublic}
                    onChange={setIsPublic}
                  />
                </View>

                {/* הגדרות מתקדמות */}
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.advancedToggle}
                    onPress={() => {
                      void HapticFeedback.selection();
                      setAdvancedOpen((v) => !v);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: advancedOpen }}
                  >
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={tokens.colors.text.secondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.advancedTitle}>הגדרות מתקדמות</Text>
                      <Text style={styles.advancedCaption}>
                        מדד השוואה, ריבית חסרת סיכון, פיצולים, ייבוא ותיאור
                      </Text>
                    </View>
                    <Ionicons
                      name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                  </TouchableOpacity>

                  {advancedOpen ? (
                    <View style={styles.advancedBody}>
                      <FieldLabel
                        label="מדד השוואה"
                        hint="מולו נשווה את ביצועי התיק בגרפים ובסטטיסטיקות"
                      />
                      {BENCHMARK_PRESETS.map((b) => {
                        const active = benchmark === b.symbol;
                        return (
                          <TouchableOpacity
                            key={b.symbol}
                            style={[
                              styles.benchmarkRow,
                              {
                                borderColor: active
                                  ? tokens.colors.primary.main
                                  : tokens.colors.glass.card.border,
                                backgroundColor: active
                                  ? tokens.colors.primary.subtle
                                  : tokens.colors.background.surface,
                              },
                            ]}
                            onPress={() => {
                              if (!active) void HapticFeedback.selection();
                              setBenchmark(b.symbol);
                            }}
                            activeOpacity={0.75}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.benchmarkLabel}>{b.label}</Text>
                              <Text style={styles.benchmarkDesc}>{b.description}</Text>
                            </View>
                            <Ionicons
                              name={active ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={
                                active ? tokens.colors.primary.main : tokens.colors.text.muted
                              }
                            />
                          </TouchableOpacity>
                        );
                      })}

                      <View style={{ height: 16 }} />

                      <TextField
                        label="ריבית חסרת סיכון (% שנתי)"
                        value={riskFree}
                        onChangeText={setRiskFree}
                        placeholder="4.0"
                        keyboardType="decimal-pad"
                        numeric
                        hint='משמש לחישוב Sharpe ו-Sortino. ברירת מחדל 4% (תשואת אג"ח אמריקאי).'
                        error={riskError}
                        editable={!submitting}
                      />

                      <SwitchRow
                        title="התאמה אוטומטית לפיצולי מניות"
                        hint="מומלץ — כמות ומחיר בעסקאות יתעדכנו אוטומטית לפי splits"
                        value={autoSplits}
                        onChange={setAutoSplits}
                        spacing={12}
                      />

                      <SwitchRow
                        title="ייבוא עסקאות מקובץ CSV"
                        hint="בסיום היצירה נעבור למסך הייבוא (Symbol, Type, Date, Quantity, Price…)"
                        value={importCsv}
                        onChange={(v) => setMode(v ? 'import' : 'manual')}
                        spacing={18}
                      />

                      <TextField
                        label="תיאור"
                        optional
                        value={description}
                        onChangeText={setDescription}
                        placeholder="מטרת התיק, אסטרטגיה, הערות…"
                        multiline
                        maxLength={1200}
                        editable={!submitting}
                        spacing={0}
                      />
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity
              style={[styles.submit, dimmed && styles.submitDisabled]}
              onPress={() => {
                void HapticFeedback.medium();
                void handleSubmit();
              }}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.colors.text.inverse} />
              ) : (
                <Ionicons
                  name={isBrokerMode ? 'link' : 'checkmark'}
                  size={20}
                  color={dimmed ? tokens.colors.text.disabled : tokens.colors.text.inverse}
                />
              )}
              <Text style={[styles.submitText, dimmed && styles.submitTextDisabled]}>
                {submitting
                  ? 'יוצר תיק…'
                  : isBrokerMode
                  ? 'המשך לחיבור Colmex Pro'
                  : 'צור תיק'}
              </Text>
            </TouchableOpacity>
            {!isBrokerMode && blockingError && !submitting ? (
              <Text style={styles.footerNote}>{blockingError}</Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

interface ModeCardProps {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  /** לוגו ברוקר — מוצג במקום האייקון הגנרי */
  logo?: ImageSourcePropType;
}

function ModeCard({ active, icon, title, description, onPress, logo }: ModeCardProps) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="glass"
      glassIntensity={active ? 'light' : 'subtle'}
      padding="none"
      onPress={onPress}
      showGlassBorder={!active}
      accessibilityLabel={title}
      style={{
        borderRadius: tokens.borderRadius['3xl'],
        overflow: 'hidden',
        borderWidth: active ? 1.5 : 0,
        borderColor: active ? tokens.colors.primary.main : 'transparent',
        backgroundColor: active ? tokens.colors.primary.dim : 'transparent',
      }}
      contentContainerStyle={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: logo
            ? '#FFFFFF'
            : active
            ? 'rgba(0, 200, 5, 0.20)'
            : tokens.colors.background.card,
        }}
      >
        {logo ? (
          <Image source={logo} style={{ width: 42, height: 42 }} resizeMode="cover" />
        ) : (
          <Ionicons
            name={icon}
            size={21}
            color={active ? tokens.colors.primary.main : tokens.colors.text.secondary}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: active ? tokens.colors.primary.main : tokens.colors.text.primary,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: tokens.colors.text.tertiary,
            marginTop: 3,
            lineHeight: 17,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={active ? tokens.colors.primary.main : tokens.colors.text.muted}
      />
    </UICard>
  );
}
