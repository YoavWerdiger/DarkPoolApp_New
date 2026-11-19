import i18n from '../../lib/i18n';
import { formatThousandsInput, parseFormattedNumber } from '../../utils/numberInput';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
// edge-to-edge (SDK 58): adjustResize לא מקטין את החלון באנדרואיד — KAV של keyboard-controller עובד בשתי הפלטפורמות
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { legacyAlert } from '../../utils/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { PortfolioFormFooter } from './components/PortfolioFormFooter';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { FloatingLabelField, FieldGroupLabel } from '../../components/ui/FloatingLabelField';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import {
  SettingsActionRow,
  SettingsGlassCard,
  SettingsSwitchRow,
} from '../../components/profile/ProfileSettingsUI';
import { SlidersHorizontal } from 'lucide-react-native';
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

/** ההתממשקות ל-Colmex Pro עוד לא פתוחה לכולם — false כשמשיקים */
const COLMEX_CONNECT_COMING_SOON = true;
const COLMEX_LOGO = require('../../assets/colmex-logo.png');

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'CreatePortfolio'>;

type CreateMode = 'manual' | 'import' | 'broker' | 'watchlist';

const MODE_TABS = [
  { id: 'journal' as const, label: i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s13') },
  { id: 'broker' as const, label: i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s15') },
];

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
  // ההתממשקות ל-Colmex Pro — «בקרוב» לכולם
  const brokerSoon = COLMEX_CONNECT_COMING_SOON;
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
    const parsed = parseFormattedNumber(raw);
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
  const canSubmit = isBrokerMode ? !brokerSoon : !blockingError && !submitting;
  const dimmed = !canSubmit && !submitting;

  // ריבית לא תקינה חיה בתוך "הגדרות מתקדמות" — נפתח אותן כדי שלא ייווצר מבוי סתום
  useEffect(() => {
    if (riskError) setAdvancedOpen(true);
  }, [riskError]);

  const handleSubmit = useCallback(async () => {
    if (mode === 'broker') {
      if (brokerSoon) return;
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
      const initialCashNum = parseFormattedNumber(initialCash) || 0;
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
  , brokerSoon]);

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
        // הסבר קצר מתחת למתג סוג התיק
        modeHint: {
          ...journalCardSubtitleStyle,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          marginTop: 10,
          marginBottom: 6,
          paddingHorizontal: 4,
        },
        fields: { gap: 12 },
        fieldsSpaced: { marginTop: 16 },
        card: { marginBottom: 0 },
        cardSpaced: { marginTop: 20, marginBottom: 0 },
        chipsRow: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 8,
        },
        currencyAdornment: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.secondary,
        },
        benefitRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        rowDivider: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        soonHero: {
          marginTop: APP_LAYOUT.componentGap,
          borderRadius: 26,
          overflow: 'hidden',
          alignItems: 'center',
          paddingTop: 28,
          paddingBottom: 22,
          gap: 10,
        },
        // הלוגו עצמו מוגדל ומטושטש — הילה בצבע המותג
        soonHeroBlur: {
          position: 'absolute',
          top: -60,
          left: -40,
          right: -40,
          height: 260,
          opacity: 0.55,
        },
        soonLogoTile: {
          width: 72,
          height: 72,
          borderRadius: 20,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          backgroundColor: '#fff',
        },
        soonLogo: {
          width: '100%',
          height: '100%',
        },
        soonTitle: {
          ...APP_TYPE.sectionTitle,
          marginTop: 4,
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        soonPill: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          height: 28,
          paddingHorizontal: 12,
          borderRadius: 14,
        },
        soonPillText: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
        },
        benefitText: {
          ...journalCardBodyStyle,
          flex: 1,
          textAlign: 'right',
          color: tokens.colors.text.primary,
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
          behavior="padding"
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* סוג התיק — מתג מקטעים כמו בטאבים של התיק */}
            <SegmentedTabs
              options={MODE_TABS}
              value={isBrokerMode ? 'broker' : 'journal'}
              onChange={(id) => {
                void HapticFeedback.selection();
                setMode(id === 'broker' ? 'broker' : importCsv ? 'import' : 'manual');
              }}
            />
            <Text style={styles.modeHint}>
              {isBrokerMode
                ? brokerSoon
                  ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.soon2')
                  : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s16')
                : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s14')}
            </Text>

            {isBrokerMode ? (
              <>
                {brokerSoon ? (
                  // «בקרוב» — הלוגו מטושטש ומוגדל כרקע, הלוגו החד במרכז, תגית CTA וכותרת
                  <View style={[styles.soonHero, { backgroundColor: tokens.colors.background.cardSolid }]}>
                    <ExpoImage
                      source={COLMEX_LOGO}
                      style={styles.soonHeroBlur}
                      contentFit="cover"
                      blurRadius={36}
                    />
                    <LinearGradient
                      colors={['transparent', tokens.colors.background.cardSolid]}
                      locations={[0.15, 1]}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.soonLogoTile}>
                      <ExpoImage source={COLMEX_LOGO} style={styles.soonLogo} contentFit="cover" />
                    </View>
                    <Text style={styles.soonTitle}>Colmex Pro</Text>
                    <View style={[styles.soonPill, { backgroundColor: tokens.colors.primary.lightCta }]}>
                      <Ionicons name="time-outline" size={14} color={tokens.colors.text.inverse} />
                      <Text style={[styles.soonPillText, { color: tokens.colors.text.inverse }]}>
                        {i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.soon1')}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {/* «מה קורה בחיבור» — רק כשהחיבור פתוח (לא במצב בקרוב) */}
                {!brokerSoon ? (
                  <>
                <FieldGroupLabel>{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s17')}</FieldGroupLabel>
                <SettingsGlassCard style={styles.card}>
                  {BROKER_BENEFITS.map((line, i) => (
                    <View
                      key={line}
                      style={[styles.benefitRow, i < BROKER_BENEFITS.length - 1 && styles.rowDivider]}
                    >
                      <Ionicons
                        name={brokerSoon ? 'ellipse-outline' : 'checkmark-circle'}
                        size={20}
                        color={brokerSoon ? tokens.colors.text.tertiary : tokens.colors.success.main}
                      />
                      <Text style={[styles.benefitText, brokerSoon && { color: tokens.colors.text.secondary }]}>{line}</Text>
                    </View>
                  ))}
                </SettingsGlassCard>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <FieldGroupLabel>{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s18')}</FieldGroupLabel>
                <View style={styles.fields}>
                  <FloatingLabelField
                    label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s19')}
                    hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s20')}
                    value={name}
                    onChangeText={setName}
                    onBlur={() => setTouchedName(true)}
                    maxLength={128}
                    editable={!submitting}
                    error={touchedName && !!nameError}
                    helper={touchedName && nameError ? nameError : undefined}
                  />
                  <FloatingLabelField
                    label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s22')}
                    value={initialCash}
                    // פסיקי אלפים תוך כדי הקלדה; השמירה על המספר הנקי (QA 9.4)
                    onChangeText={(v) => setInitialCash(formatThousandsInput(v))}
                    onBlur={() => setTouchedCash(true)}
                    keyboardType="decimal-pad"
                    ltr
                    editable={!submitting}
                    trailing={<Text style={styles.currencyAdornment}>{currencySymbol}</Text>}
                    error={touchedCash && !!cashError}
                    helper={
                      touchedCash && cashError
                        ? cashError
                        : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s23')
                    }
                  />
                </View>

                <FieldGroupLabel>{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s24')}</FieldGroupLabel>
                <View style={styles.chipsRow}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <DayDividerPill
                      key={c.code}
                      selected={currency === c.code}
                      instantSelection
                      onPress={() => {
                        if (currency !== c.code) void HapticFeedback.selection();
                        setCurrency(c.code);
                      }}
                      accessibilityLabel={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s25', { v0: c.label })}
                    >
                      {`${c.symbol} ${c.label}`}
                    </DayDividerPill>
                  ))}
                </View>

                {/* הגדרות מתקדמות — כרטיס בסגנון ההגדרות: שורה נפתחת + מתגים */}
                <SettingsGlassCard style={styles.cardSpaced}>
                  <SettingsActionRow
                    title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s26')}
                    subtitle={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s27')}
                    icon={SlidersHorizontal}
                    showDivider={advancedOpen}
                    onPress={() => {
                      void HapticFeedback.selection();
                      setAdvancedOpen((v) => !v);
                    }}
                    trailing={
                      <Ionicons
                        name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={tokens.colors.text.tertiary}
                      />
                    }
                  />
                  {advancedOpen ? (
                    <>
                      <SettingsSwitchRow
                        title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s32')}
                        value={autoSplits}
                        onValueChange={setAutoSplits}
                      />
                      <SettingsSwitchRow
                        title={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s34')}
                        value={importCsv}
                        onValueChange={(v) => setMode(v ? 'import' : 'manual')}
                        showDivider={false}
                      />
                    </>
                  ) : null}
                </SettingsGlassCard>

                {advancedOpen ? (
                  <>
                    <FieldGroupLabel>{i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s28')}</FieldGroupLabel>
                    <SettingsGlassCard style={styles.card}>
                      {BENCHMARK_PRESETS.map((b, i) => {
                        const active = benchmark === b.symbol;
                        return (
                          <SettingsActionRow
                            key={b.symbol}
                            title={b.label}
                            subtitle={b.description}
                            showDivider={i < BENCHMARK_PRESETS.length - 1}
                            onPress={() => {
                              if (!active) void HapticFeedback.selection();
                              setBenchmark(b.symbol);
                            }}
                            trailing={
                              active ? (
                                <Ionicons name="checkmark" size={22} color={tokens.colors.success.main} />
                              ) : (
                                <View style={{ width: 22 }} />
                              )
                            }
                          />
                        );
                      })}
                    </SettingsGlassCard>

                    <View style={[styles.fields, styles.fieldsSpaced]}>
                      <FloatingLabelField
                        label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s30')}
                        value={riskFree}
                        onChangeText={setRiskFree}
                        keyboardType="decimal-pad"
                        ltr
                        editable={!submitting}
                        error={!!riskError}
                        helper={riskError ?? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s31')}
                      />
                      <FloatingLabelField
                        label={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s36')}
                        hint={i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s37')}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        minHeight={96}
                        maxLength={1200}
                        editable={!submitting}
                      />
                    </View>
                  </>
                ) : null}
              </>
            )}
          </ScrollView>

          <PortfolioFormFooter
            title={
              submitting
                ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s38')
                : isBrokerMode
                  ? brokerSoon
                    ? i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.soon1')
                    : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s39')
                  : i18n.t('auto.screens__Portfolios__CreatePortfolioScreen.s40')
            }
            icon={isBrokerMode ? (brokerSoon ? 'time-outline' : 'link') : 'checkmark'}
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
