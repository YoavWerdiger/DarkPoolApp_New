import i18n from '../../lib/i18n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type ImageSourcePropType,
  Pressable,
} from 'react-native';
import { legacyAlert } from '../../utils/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { chromeSurfaceFill } from '../../components/ui/chromeControl';
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
  i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s1'),
  i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s2'),
  i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s3'),
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
    () => (name.trim().length === 0 ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s4') : null),
    [name]
  );

  const cashError = useMemo(() => {
    const raw = initialCash.trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s5');
    if (parsed < 0) return i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s6');
    return null;
  }, [initialCash]);

  const riskError = useMemo(() => {
    const parsed = parseFloat(riskFree);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s7');
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
      legacyAlert(i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s8'), i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s9'));
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
          minHeight: 44,
          paddingHorizontal: 18,
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
        <PortfolioScreenHeader title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s10')} onBack={() => navigation.goBack()} />
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
                title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s11')}
                caption={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s12')}
              />
              <View style={styles.modeCards}>
                <ModeCard
                  active={!isBrokerMode}
                  icon="journal-outline"
                  title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s13')}
                  description={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s14')}
                  onPress={() => setMode(importCsv ? 'import' : 'manual')}
                />
                <ModeCard
                  active={isBrokerMode}
                  icon="link-outline"
                  logo={require('../../assets/colmex-logo.png')}
                  title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s15')}
                  description={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s16')}
                  onPress={() => setMode('broker')}
                />
              </View>
            </View>

            {isBrokerMode ? (
              <View style={styles.section}>
                <SectionHeader title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s17')} />
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
                  <SectionHeader title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s18')} />

                  <TextField
                    label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s19')}
                    value={name}
                    onChangeText={setName}
                    onBlur={() => setTouchedName(true)}
                    placeholder={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s20')}
                    hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s21')}
                    error={touchedName ? nameError : null}
                    maxLength={128}
                    editable={!submitting}
                  />

                  <TextField
                    label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s22')}
                    optional
                    value={initialCash}
                    onChangeText={setInitialCash}
                    onBlur={() => setTouchedCash(true)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    numeric
                    prefix={currencySymbol}
                    hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s23')}
                    error={touchedCash ? cashError : null}
                    editable={!submitting}
                  />

                  <FieldLabel label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s24')} />
                  <View style={styles.chipsRow}>
                    {SUPPORTED_CURRENCIES.map((c) => {
                      const active = currency === c.code;
                      return (
                        // כמו לונג/שורט בפוזיציה: נבחר = מילוי ירוק, לא נבחר = משטח כרום
                        <Pressable
                          key={c.code}
                          onPress={() => {
                            if (!active) void HapticFeedback.selection();
                            setCurrency(c.code);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s25', { v0: c.label })}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? tokens.colors.primary.main : chromeSurfaceFill(tokens) },
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
                      <Text style={[journalCardTitleStyle, { color: tokens.colors.text.primary }]}>{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s26')}</Text>
                      <Text
                        style={[
                          journalCardSubtitleStyle,
                          {
                            color: tokens.colors.text.secondary,
                            marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
                          },
                        ]}
                      >{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s27')}</Text>
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
                        label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s28')}
                        hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s29')}
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
                                active ? tokens.colors.primary.main : tokens.colors.text.muted
                              }
                            />
                          </UICard>
                        );
                      })}

                      <View style={{ height: 16 }} />

                      <TextField
                        label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s30')}
                        value={riskFree}
                        onChangeText={setRiskFree}
                        placeholder="4.0"
                        keyboardType="decimal-pad"
                        numeric
                        hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s31')}
                        error={riskError}
                        editable={!submitting}
                      />

                      <SwitchRow
                        title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s32')}
                        hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s33')}
                        value={autoSplits}
                        onChange={setAutoSplits}
                        spacing={12}
                      />

                      <SwitchRow
                        title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s34')}
                        hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s35')}
                        value={importCsv}
                        onChange={(v) => setMode(v ? 'import' : 'manual')}
                        spacing={18}
                      />

                      <TextField
                        label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s36')}
                        optional
                        value={description}
                        onChangeText={setDescription}
                        placeholder={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s37')}
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
                ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s38')
                : isBrokerMode
                  ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s39')
                  : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s40')
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
          style={[
            journalCardTitleStyle,
            { color: active ? tokens.colors.primary.main : tokens.colors.text.primary },
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
        color={active ? tokens.colors.primary.main : tokens.colors.text.muted}
      />
    </UICard>
  );
}
