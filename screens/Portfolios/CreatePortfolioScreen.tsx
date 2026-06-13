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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
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

export default function CreatePortfolioScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();

  const [mode, setMode] = useState<CreateMode>('manual');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [benchmark, setBenchmark] = useState(DEFAULT_BENCHMARK);
  const [riskFree, setRiskFree] = useState(String(DEFAULT_RISK_FREE_RATE));
  const [autoSplits, setAutoSplits] = useState(true);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (mode === 'broker') {
      navigation.navigate('ConnectBroker');
      return;
    }
    if (!name.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם לתיק');
      return;
    }
    const rfNum = parseFloat(riskFree);
    if (isNaN(rfNum) || rfNum < 0 || rfNum > 100) {
      Alert.alert('שגיאה', 'ריבית חסרת סיכון חייבת להיות בין 0 ל-100');
      return;
    }
    try {
      setSubmitting(true);
      const portfolio = await createPortfolio({
        name: name.trim(),
        currency,
        risk_free_rate: rfNum,
        benchmark_symbol: benchmark,
        auto_adjust_splits: autoSplits,
        description: description.trim() || null,
      });
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
  }, [name, currency, riskFree, benchmark, autoSplits, description, mode, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          padding: 16,
          paddingBottom: 80,
        },
        section: {
          marginBottom: 22,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          marginBottom: 10,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        modeRow: {
          flexDirection: 'row-reverse',
          gap: 10,
        },
        modeCard: {
          flex: 1,
          padding: 14,
          borderRadius: 26,
          borderWidth: 1.5,
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
        },
        modeIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        modeLabel: {
          fontSize: 12,
          fontWeight: '600',
          textAlign: 'center',
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
        descriptionInput: {
          minHeight: 90,
          textAlignVertical: 'top',
          paddingTop: 14,
          borderRadius: 22,
          overflow: 'hidden',
        },
        chipsRow: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 8,
        },
        chip: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
          overflow: 'hidden',
        },
        chipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: 'rgba(0, 200, 5, 0.12)',
        },
        chipText: {
          fontSize: 13,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        chipTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        benchmarkCard: {
          padding: 14,
          borderRadius: 22,
          borderWidth: 1.5,
          marginBottom: 8,
          overflow: 'hidden',
        },
        benchmarkRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
        },
        benchmarkLabel: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        benchmarkDesc: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        toggleRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          overflow: 'hidden',
        },
        toggleLabel: {
          fontSize: 14,
          color: tokens.colors.text.primary,
          flex: 1,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        toggleHint: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        toggleSwitch: {
          width: 46,
          height: 28,
          borderRadius: 14,
          padding: 3,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        },
        toggleThumb: {
          width: 22,
          height: 22,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
        },
        submit: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingVertical: 16,
          borderRadius: 32,
          marginTop: 12,
          ...tokens.shadows.md,
        },
        submitText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        modeHint: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          marginTop: 8,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 18,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title="תיק חדש"
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
            {/* Mode selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>איך נתחיל?</Text>
              <View style={styles.modeRow}>
                <ModeCard
                  active={mode === 'manual'}
                  icon="hand-right"
                  label="הוספה ידנית"
                  onPress={() => setMode('manual')}
                  styles={styles}
                  tokens={tokens}
                />
                <ModeCard
                  active={mode === 'import'}
                  icon="document-text"
                  label="ייבוא CSV"
                  onPress={() => setMode('import')}
                  styles={styles}
                  tokens={tokens}
                />
                <ModeCard
                  active={mode === 'broker'}
                  icon="link"
                  label="Colmex Pro"
                  onPress={() => setMode('broker')}
                  styles={styles}
                  tokens={tokens}
                />
              </View>
              {mode === 'import' ? (
                <Text style={styles.modeHint}>
                  לאחר יצירת התיק תועבר/י למסך ייבוא CSV. ניתן להעלות קובץ עם
                  עמודות: Symbol, Type, Date, Quantity, Price, Commission, Currency, Notes.
                </Text>
              ) : null}
              {mode === 'broker' ? (
                <Text style={styles.modeHint}>
                  סנכרון אוטומטי מחשבון Colmex Pro: פוזיציות, פקודות פתוחות, הפקדות,
                  משיכות וכל ההיסטוריה. התיק יהיה במצב read-only ויתעדכן כל 15 דקות.
                </Text>
              ) : null}
            </View>

            {mode !== 'broker' ? (
              <>
                {/* Name */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>שם התיק</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="לדוגמה: התיק הראשי"
                    placeholderTextColor={tokens.colors.text.tertiary}
                    maxLength={128}
                  />
                </View>

            {/* Currency */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>מטבע התיק</Text>
              <View style={styles.chipsRow}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.chip,
                      currency === c.code && styles.chipActive,
                    ]}
                    onPress={() => {
                      if (currency !== c.code) void HapticFeedback.selection();
                      setCurrency(c.code);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        currency === c.code && styles.chipTextActive,
                      ]}
                    >
                      {c.symbol} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Benchmark */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>מדד השוואה (Benchmark)</Text>
              {BENCHMARK_PRESETS.map((b) => {
                const active = benchmark === b.symbol;
                return (
                  <TouchableOpacity
                    key={b.symbol}
                    style={[
                      styles.benchmarkCard,
                      {
                        borderColor: active
                          ? tokens.colors.primary.main
                          : tokens.colors.border.subtle,
                        backgroundColor: active
                          ? 'rgba(0, 200, 5, 0.08)'
                          : 'rgba(255,255,255,0.04)',
                      },
                    ]}
                    onPress={() => {
                      if (!active) void HapticFeedback.selection();
                      setBenchmark(b.symbol);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.benchmarkRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.benchmarkLabel}>{b.label}</Text>
                        <Text style={styles.benchmarkDesc}>{b.description}</Text>
                      </View>
                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={tokens.colors.primary.main}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={22}
                          color={tokens.colors.text.tertiary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Risk-free rate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                ריבית חסרת סיכון (% שנתי)
              </Text>
              <TextInput
                style={styles.input}
                value={riskFree}
                onChangeText={setRiskFree}
                keyboardType="decimal-pad"
                placeholder="4.0"
                placeholderTextColor={tokens.colors.text.tertiary}
              />
              <Text style={styles.modeHint}>
                משמש לחישוב Sharpe ו-Sortino. ברירת מחדל 4% (תשואת אג"ח אמריקאי).
              </Text>
            </View>

            {/* Splits toggle */}
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>התאמה אוטומטית לפיצולי מניות</Text>
                  <Text style={styles.toggleHint}>
                    מומלץ – הטרנזקציות יתעדכנו אוטומטית לפי splits
                  </Text>
                </View>
                <View style={{ direction: 'ltr' }}>
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      setAutoSplits((v) => !v);
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.toggleSwitch,
                      {
                        backgroundColor: autoSplits
                          ? tokens.colors.primary.main
                          : 'rgba(255,255,255,0.15)',
                        justifyContent: autoSplits ? 'flex-end' : 'flex-start',
                      },
                    ]}
                  >
                    <View style={styles.toggleThumb} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>תיאור (אופציונלי)</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="מטרת התיק, אסטרטגיה, הערות..."
                placeholderTextColor={tokens.colors.text.tertiary}
                multiline
                maxLength={1200}
              />
            </View>
              </>
            ) : null}

            <TouchableOpacity
              style={[styles.submit, submitting && { opacity: 0.6 }]}
              onPress={() => {
                void HapticFeedback.medium();
                void handleSubmit();
              }}
              disabled={submitting}
              activeOpacity={0.88}
            >
              <Ionicons
                name={mode === 'broker' ? 'link' : 'checkmark'}
                size={22}
                color={tokens.colors.text.inverse}
              />
              <Text style={styles.submitText}>
                {submitting
                  ? 'יוצר תיק…'
                  : mode === 'broker'
                  ? 'המשך לחיבור Colmex Pro'
                  : 'צור תיק'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

interface ModeCardProps {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof StyleSheet.create>;
  tokens: ReturnType<typeof useDesignTokens>;
}

function ModeCard({ active, icon, label, onPress, styles, tokens }: ModeCardProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        if (!active) void HapticFeedback.selection();
        onPress();
      }}
      activeOpacity={0.85}
      style={[
        styles.modeCard,
        {
          borderColor: active ? tokens.colors.primary.main : tokens.colors.border.subtle,
          backgroundColor: active ? 'rgba(0, 200, 5, 0.10)' : 'rgba(255,255,255,0.04)',
        },
      ]}
    >
      <View
        style={[
          styles.modeIcon,
          {
            backgroundColor: active
              ? 'rgba(0, 200, 5, 0.20)'
              : 'rgba(255,255,255,0.06)',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={active ? tokens.colors.primary.main : tokens.colors.text.secondary}
        />
      </View>
      <Text
        style={[
          styles.modeLabel,
          {
            color: active ? tokens.colors.primary.main : tokens.colors.text.secondary,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
