import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  type ImageSourcePropType, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { PortfolioFormFooter } from './components/PortfolioFormFooter';
import {
  JOURNAL_LAYOUT,
  journalCardBodyStyle,
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  PORTFOLIO_FORM,
} from './portfolioLayout';
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
  const [mode, setMode] = useState<CreateMode>('manual');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [benchmark, setBenchmark] = useState(DEFAULT_BENCHMARK);
  const [riskFree, setRiskFree] = useState(String(DEFAULT_RISK_FREE_RATE));
  const [autoSplits, setAutoSplits] = useState(true);
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
        is_public: false,
        ...(initialCashNum > 0 ? { available_cash: initialCashNum } : {}),
      });
      void HapticFeedback.success();
      // אם המשתמש בחר ייבוא – נשלח אותו ישר למסך ה-import
      if (mode === 'import') {
        navigation.replace('ImportTransactions', { portfolioId: portfolio.id });
      } else {
        navigation.navigate('PortfoliosHub', { selectPortfolioId: portfolio.id });
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
    mode,
    navigation,
  ]);

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
        modeCards: { gap: JOURNAL_LAYOUT.cardStackGap },
        chipsRow: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: JOURNAL_LAYOUT.stackGapSmall,
        },
        chipText: {
          ...journalCardSubtitleStyle,
          fontWeight: '600',
          textAlign: 'center',
        },
        chip: {
          minHeight: 40,
          paddingHorizontal: 16,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
        },
        advancedBody: { marginTop: JOURNAL_LAYOUT.sectionHeaderToContent },
        benchmarkRowInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        benchmarkLabel: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.primary,
        },
        benchmarkDesc: {
          ...journalCardSubtitleStyle,
          color: tokens.colors.text.secondary,
          marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
        },
        brokerInfoRow: {
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: JOURNAL_LAYOUT.stackGapSmall,
        },
        brokerInfoText: {
          ...journalCardBodyStyle,
          flex: 1,
          color: tokens.colors.text.secondary,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
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
                  variant="soft"
                  padding="md"
                  disableBlur
                >
                  {BROKER_BENEFITS.map((line) => (
                    <View key={line} style={styles.brokerInfoRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={tokens.colors.text.primary}
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
                        <Pressable
                          key={c.code}
                          onPress={() => {
                            if (!active) void HapticFeedback.selection();
                            setCurrency(c.code);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={`מטבע ${c.label}`}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: active
                                ? tokens.colors.text.primary
                                : tokens.colors.background.cardSolid,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: active ? tokens.colors.text.inverse : tokens.colors.text.primary },
                            ]}
                          >
                            {c.symbol} {c.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* הגדרות מתקדמות */}
                <View style={styles.section}>
                  <UICard
                    variant="soft"
                    padding="none"
                    disableBlur
                    onPress={() => {
                      void HapticFeedback.selection();
                      setAdvancedOpen((v) => !v);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: advancedOpen }}
                    contentContainerStyle={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={tokens.colors.text.secondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[journalCardTitleStyle, { color: tokens.colors.text.primary }]}>
                        הגדרות מתקדמות
                      </Text>
                      <Text
                        style={[
                          journalCardSubtitleStyle,
                          {
                            color: tokens.colors.text.secondary,
                            marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
                          },
                        ]}
                      >
                        מדד השוואה, ריבית חסרת סיכון, פיצולים, ייבוא ותיאור
                      </Text>
                    </View>
                    <Ionicons
                      name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                  </UICard>

                  {advancedOpen ? (
                    <View style={styles.advancedBody}>
                      <FieldLabel
                        label="מדד השוואה"
                        hint="מולו נשווה את ביצועי התיק בגרפים ובסטטיסטיקות"
                      />
                      {BENCHMARK_PRESETS.map((b) => {
                        const active = benchmark === b.symbol;
                        return (
                          <UICard
                            key={b.symbol}
                            variant="soft"
                            padding="none"
                            disableBlur
                            onPress={() => {
                              if (!active) void HapticFeedback.selection();
                              setBenchmark(b.symbol);
                            }}
                            style={[
                              { marginBottom: JOURNAL_LAYOUT.stackGapSmall },
                              active && {
                                borderWidth: 0,
                                backgroundColor: tokens.colors.background.tertiary,
                              },
                            ]}
                            contentContainerStyle={styles.benchmarkRowInner}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.benchmarkLabel}>{b.label}</Text>
                              <Text style={styles.benchmarkDesc}>{b.description}</Text>
                            </View>
                            <Ionicons
                              name={active ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={
                                active ? tokens.colors.text.primary : tokens.colors.text.tertiary
                              }
                            />
                          </UICard>
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

          <PortfolioFormFooter
            title={
              submitting
                ? 'יוצר תיק…'
                : isBrokerMode
                  ? 'המשך לחיבור Colmex Pro'
                  : 'צור תיק'
            }
            icon={isBrokerMode ? 'link' : 'checkmark'}
            disabled={!canSubmit}
            loading={submitting}
            onPress={() => void handleSubmit()}
            note={!isBrokerMode && blockingError && !submitting ? blockingError : null}
          />
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
      variant="soft"
      padding="none"
      disableBlur
      onPress={onPress}
      accessibilityLabel={title}
      style={
        active
          ? {
              borderWidth: 0,
              backgroundColor: tokens.colors.background.tertiary,
            }
          : undefined
      }
      contentContainerStyle={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        padding: JOURNAL_LAYOUT.cardPadding,
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
          backgroundColor: logo ? '#FFFFFF' : tokens.colors.background.cardSolid,
        }}
      >
        {logo ? (
          <Image source={logo} style={{ width: 42, height: 42 }} resizeMode="cover" />
        ) : (
          <Ionicons
            name={icon}
            size={21}
            color={tokens.colors.text.primary}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            journalCardTitleStyle,
            { color: tokens.colors.text.primary },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            journalCardSubtitleStyle,
            {
              color: tokens.colors.text.secondary,
              marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
            },
          ]}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={active ? tokens.colors.text.primary : tokens.colors.text.tertiary}
      />
    </UICard>
  );
}
