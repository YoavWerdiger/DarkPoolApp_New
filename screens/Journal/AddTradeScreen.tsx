import { legacyAlert } from '../../utils/appDialog';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { BRANDFETCH_CLIENT_ID } from '../../config/publicEnv';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  TIMEFRAME_OPTIONS,
  MOOD_OPTIONS,
  MISTAKE_OPTIONS,
  type TradeTimeframe,
  type MoodId,
} from './tradeJournalConstants';
import {
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCaption2Style,
  journalCaptionStyle,
  journalPhysicalRightText,
  journalRow,
  journalRtlContent,
  journalSectionSubtitleStyle,
} from './journalLayout';

const STEPS = ['פרטי עסקה', 'מחירים וכמות', 'תאריכים ושעות', 'יומן מסחר'] as const;

type Nav = NativeStackNavigationProp<JournalStackParamList, 'AddTrade'>;

export default function AddTradeScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState(
    () => String(route.params?.initialSymbol ?? '').toUpperCase()
  );
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState(() => {
    const p = route.params?.initialEntryPrice;
    return p != null && Number.isFinite(Number(p)) ? String(p) : '';
  });
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [entryDateText, setEntryDateText] = useState('');
  const [exitDateText, setExitDateText] = useState('');
  const [entryTimeText, setEntryTimeText] = useState('');
  const [exitTimeText, setExitTimeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  const [timeframe, setTimeframe] = useState<TradeTimeframe | null>(null);
  const [moodBefore, setMoodBefore] = useState<MoodId | null>(null);
  const [moodAfter, setMoodAfter] = useState<MoodId | null>(null);
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(null);
  const [strategyType, setStrategyType] = useState('');
  const [entryReason, setEntryReason] = useState(
    () => String(route.params?.initialNotes ?? '')
  );
  const [exitReason, setExitReason] = useState('');
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);

  const brandLogoUri = useMemo(() => {
    if (!symbol.trim()) return null;
    return brandfetchTickerLogoUri(symbol);
  }, [symbol]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [symbol]);

  const getDefaultDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const date = `${day}/${month}/${year}`;
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const time = `${hour}:${minute}`;
    return { date, time };
  };

  useEffect(() => {
    const d = getDefaultDateTime();
    setEntryDateText(d.date);
    setExitDateText(d.date);
    setEntryTimeText(d.time);
    setExitTimeText(d.time);
  }, []);

  const parseDateTime = (dateText: string, timeText: string): Date | null => {
    if (!dateText || !timeText) return null;
    try {
      const dateParts = dateText.includes('/') ? dateText.split('/') : dateText.split('.');
      if (dateParts.length !== 3) return null;
      const [day, month, year] = dateParts.map(Number);
      const [hour, minute] = timeText.split(':').map(Number);
      if (
        isNaN(day) || isNaN(month) || isNaN(year) ||
        isNaN(hour) || isNaN(minute) ||
        day < 1 || day > 31 || month < 1 || month > 12 ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59
      ) {
        return null;
      }
      const date = new Date(year, month - 1, day, hour, minute);
      // Verify the date is real — new Date(2024, 1, 30) silently overflows to March 1
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  };

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!symbol.trim()) {
        legacyAlert('שגיאה', 'יש להזין סמל');
        return false;
      }
      return true;
    }
    if (s === 1) {
      if (!entryPrice || parseFloat(entryPrice) <= 0) {
        legacyAlert('שגיאה', 'יש להזין מחיר כניסה תקין');
        return false;
      }
      if (!exitPrice || parseFloat(exitPrice) <= 0) {
        legacyAlert('שגיאה', 'יש להזין מחיר יציאה תקין');
        return false;
      }
      if (!quantity || parseFloat(quantity) <= 0) {
        legacyAlert('שגיאה', 'יש להזין כמות תקינה');
        return false;
      }
      return true;
    }
    return true;
  };

  const toggleMistake = (id: string) => {
    setMistakeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const buildJournalDetails = () => {
    const jd: Record<string, unknown> = {};
    if (timeframe) jd.timeframe = timeframe;
    if (moodBefore) jd.mood_before = moodBefore;
    if (moodAfter) jd.mood_after = moodAfter;
    if (followedPlan !== null) jd.followed_plan = followedPlan;
    const st = strategyType.trim();
    if (st) jd.strategy_type = st;
    const er = entryReason.trim();
    if (er) jd.entry_reason = er;
    const xr = exitReason.trim();
    if (xr) jd.exit_reason = xr;
    if (mistakeIds.length) jd.mistakes = [...mistakeIds];
    return jd;
  };

  const handleSubmit = async () => {
    if (!user) {
      legacyAlert('שגיאה', 'יש להתחבר כדי להוסיף טרייד');
      return;
    }
    const finalEntryDateText = entryDateText.trim() || getDefaultDateTime().date;
    const finalEntryTimeText = entryTimeText.trim() || getDefaultDateTime().time;
    const finalExitDateText = exitDateText.trim() || getDefaultDateTime().date;
    const finalExitTimeText = exitTimeText.trim() || getDefaultDateTime().time;

    const parsedEntryDate = parseDateTime(finalEntryDateText, finalEntryTimeText);
    const parsedExitDate = parseDateTime(finalExitDateText, finalExitTimeText);

    if (!parsedEntryDate || !parsedExitDate) {
      legacyAlert('שגיאה', 'יש להזין תאריכים ושעות תקינים (פורמט: DD/MM/YYYY HH:MM)');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from('trades').insert({
        user_id: user.id,
        symbol: symbol.trim().toUpperCase(),
        direction,
        entry_price: parseFloat(entryPrice),
        exit_price: parseFloat(exitPrice),
        quantity: parseFloat(quantity),
        entry_date: parsedEntryDate.toISOString(),
        exit_date: parsedExitDate.toISOString(),
        notes: null,
        journal_details: buildJournalDetails(),
        stop_loss: stopLoss.trim() ? parseFloat(stopLoss) : null,
        target_price: targetPrice.trim() ? parseFloat(targetPrice) : null,
        strategy_name: strategyName.trim() || null,
      });

      if (error) throw error;
      void HapticFeedback.success();
      navigation.goBack();
    } catch {
      void HapticFeedback.error();
      legacyAlert('שגיאה', 'לא ניתן להוסיף את הטרייד');
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) {
      void HapticFeedback.impactLight();
      setStep((x) => x + 1);
    } else void handleSubmit();
  };

  const goBackStep = () => {
    if (step > 0) setStep((x) => x - 1);
    else navigation.goBack();
  };

  return (
    <View style={styles.screenRoot}>
      <ChatSessionBackdrop />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.topBar}>
            <DayNavBlurButton
              onPress={goBackStep}
              size={44}
              accessibilityLabel={step === 0 ? 'סגור' : 'שלב קודם'}
            >
              <Ionicons
                name={step === 0 ? 'close' : 'chevron-forward'}
                size={26}
                color={DesignTokens.colors.text.primary}
              />
            </DayNavBlurButton>
            <Text style={styles.topTitle} numberOfLines={1}>
              הוסף טרייד
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.stepDots}>
            {STEPS.map((label, i) => (
              <View key={label} style={styles.stepDotWrap}>
                <View
                  style={[
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  ]}
                />
                <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {step === 0 && (
              <>
                <Text style={styles.stepIntro}>
                  הזן טיקר (מניה / נייר ערך). אפשר להמשיך למחירי כניסה ויציאה בשלב הבא.
                </Text>
                {!BRANDFETCH_CLIENT_ID ? (
                  <Text style={styles.envHint}>
                    להצגת לוגו: הגדר EXPO_PUBLIC_BRANDFETCH_CLIENT_ID בקובץ env (מפתח Brandfetch).
                  </Text>
                ) : null}
                <View style={styles.symbolRow}>
                  <View style={styles.logoSlot}>
                    {brandLogoUri && !logoLoadFailed ? (
                      <Image
                        source={{ uri: brandLogoUri }}
                        style={styles.logoImage}
                        contentFit="cover"
                        transition={150}
                        onError={() => setLogoLoadFailed(true)}
                      />
                    ) : (
                      <View style={[styles.logoPlaceholder, { borderColor: DesignTokens.colors.border.primary }]}>
                        <Ionicons name="stats-chart" size={32} color={DesignTokens.colors.text.tertiary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.symbolInputWrap}>
                    <Text style={styles.label}>סמל *</Text>
                    <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                      <TextInput
                        style={styles.inputGlassInner}
                        value={symbol}
                        onChangeText={setSymbol}
                        placeholder="למשל AAPL, TSLA, MSFT"
                        placeholderTextColor={DesignTokens.colors.text.tertiary}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        textAlign="right"
                      />
                    </UICard>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>כיוון *</Text>
                  <View style={styles.directionButtons}>
                    <UICard
                      variant="inputGlass"
                      padding="none"
                      style={[
                        styles.directionGlass,
                        direction === 'long' && styles.directionGlassLongOn,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.directionTouch}
                        onPress={() => {
                          if (direction !== 'long') void HapticFeedback.selection();
                          setDirection('long');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.directionButtonText,
                            direction === 'long'
                              ? { color: DesignTokens.colors.primary.main }
                              : { color: DesignTokens.colors.text.secondary },
                          ]}
                        >
                          Long
                        </Text>
                      </TouchableOpacity>
                    </UICard>
                    <UICard
                      variant="inputGlass"
                      padding="none"
                      style={[
                        styles.directionGlass,
                        direction === 'short' && styles.directionGlassShortOn,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.directionTouch}
                        onPress={() => {
                          if (direction !== 'short') void HapticFeedback.selection();
                          setDirection('short');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.directionButtonText,
                            direction === 'short'
                              ? { color: DesignTokens.colors.text.danger }
                              : { color: DesignTokens.colors.text.secondary },
                          ]}
                        >
                          Short
                        </Text>
                      </TouchableOpacity>
                    </UICard>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>שם אסטרטגיה</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={strategyName}
                      onChangeText={setStrategyName}
                      placeholder="למשל: Breakout, Mean Reversion..."
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      autoCorrect={false}
                      textAlign="right"
                    />
                  </UICard>
                </View>
              </>
            )}

            {step === 1 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>מחיר כניסה *</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={entryPrice}
                      onChangeText={setEntryPrice}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>מחיר יציאה *</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={exitPrice}
                      onChangeText={setExitPrice}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>כמות *</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={quantity}
                      onChangeText={setQuantity}
                      placeholder="1"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Stop Loss</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={stopLoss}
                      onChangeText={setStopLoss}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Target Price</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={targetPrice}
                      onChangeText={setTargetPrice}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                  </UICard>
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>תאריך כניסה * (DD/MM/YYYY)</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={entryDateText}
                      onChangeText={setEntryDateText}
                      placeholder="01/01/2024"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>שעת כניסה * (HH:MM)</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={entryTimeText}
                      onChangeText={setEntryTimeText}
                      placeholder="09:30"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>תאריך יציאה * (DD/MM/YYYY)</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={exitDateText}
                      onChangeText={setExitDateText}
                      placeholder="01/01/2024"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>שעת יציאה * (HH:MM)</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={exitTimeText}
                      onChangeText={setExitTimeText}
                      placeholder="16:00"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                    />
                  </UICard>
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.stepIntro}>
                  שדות אופציונליים — ניתן לדלג ולשמור; אפשר לערוך מאוחר יותר כשיהיה עריכת טרייד.
                </Text>

                <Text style={styles.label}>מסגרת זמן</Text>
                <View style={styles.chipRow}>
                  {TIMEFRAME_OPTIONS.map((opt) => {
                    const selected = timeframe === opt.id;
                    return (
                      <DayDividerPill
                        key={opt.id}
                        selected={selected}
                        onPress={() => setTimeframe(selected ? null : opt.id)}
                      >
                        {opt.label}
                      </DayDividerPill>
                    );
                  })}
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>מצב רגשי לפני הטרייד</Text>
                <View style={styles.chipWrap}>
                  {MOOD_OPTIONS.map((opt) => {
                    const selected = moodBefore === opt.id;
                    return (
                      <DayDividerPill
                        key={`b-${opt.id}`}
                        selected={selected}
                        onPress={() => setMoodBefore(selected ? null : opt.id)}
                      >
                        {opt.label}
                      </DayDividerPill>
                    );
                  })}
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>מצב רגשי אחרי הטרייד</Text>
                <View style={styles.chipWrap}>
                  {MOOD_OPTIONS.map((opt) => {
                    const selected = moodAfter === opt.id;
                    return (
                      <DayDividerPill
                        key={`a-${opt.id}`}
                        selected={selected}
                        onPress={() => setMoodAfter(selected ? null : opt.id)}
                      >
                        {opt.label}
                      </DayDividerPill>
                    );
                  })}
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>עמידה בתוכנית</Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      { v: true as const, label: 'כן' },
                      { v: false as const, label: 'לא' },
                      { v: null as null, label: 'לא צוין' },
                    ] as const
                  ).map((opt) => {
                    const selected = followedPlan === opt.v;
                    return (
                      <DayDividerPill
                        key={String(opt.v)}
                        selected={selected}
                        haptic={followedPlan !== opt.v}
                        onPress={() => setFollowedPlan(opt.v)}
                      >
                        {opt.label}
                      </DayDividerPill>
                    );
                  })}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>סוג אסטרטגיה</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShell}>
                    <TextInput
                      style={styles.inputGlassInner}
                      value={strategyType}
                      onChangeText={setStrategyType}
                      placeholder="למשל: פריצה, גרף מחיר, ביקוש..."
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>סיבת כניסה</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShellMultiline}>
                    <TextInput
                      style={[styles.inputGlassInner, styles.inputGlassInnerMultiline]}
                      value={entryReason}
                      onChangeText={setEntryReason}
                      placeholder="למה נכנסתי לעסקה"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                      multiline
                    />
                  </UICard>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>סיבת יציאה</Text>
                  <UICard variant="inputGlass" padding="none" style={styles.inputGlassShellMultiline}>
                    <TextInput
                      style={[styles.inputGlassInner, styles.inputGlassInnerMultiline]}
                      value={exitReason}
                      onChangeText={setExitReason}
                      placeholder="למה יצאתי"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      textAlign="right"
                      multiline
                    />
                  </UICard>
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>טעויות (סמן מה שרלוונטי)</Text>
                <View style={styles.mistakeList}>
                  {MISTAKE_OPTIONS.map((m) => {
                    const on = mistakeIds.includes(m.id);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => {
                          void HapticFeedback.selection();
                          toggleMistake(m.id);
                        }}
                        activeOpacity={0.85}
                      >
                        <UICard
                          variant="inputGlass"
                          padding="sm"
                          style={[styles.mistakeCard, on && styles.mistakeCardOn]}
                        >
                          <View style={styles.mistakeRowInner}>
                            <View style={[styles.mistakeBox, on && styles.mistakeBoxOn]}>
                              {on ? (
                                <Ionicons name="checkmark" size={16} color={DesignTokens.colors.primary.main} />
                              ) : null}
                            </View>
                            <Text style={styles.mistakeLabel}>{m.label}</Text>
                          </View>
                        </UICard>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <UIButton
              title={loading ? 'שומר…' : step === STEPS.length - 1 ? 'שמור טרייד' : 'המשך'}
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
              haptic={false}
              onPress={() => {
                void HapticFeedback.medium();
                goNext();
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: 'transparent',
      ...journalRtlContent,
    },
    flex1: { flex: 1 },
    safe: { flex: 1, backgroundColor: 'transparent' },
    stepIntro: {
      ...journalBodyTextStyle,
      color: tokens.colors.text.secondary,
      marginBottom: tokens.spacing.md,
    },
    envHint: {
      ...journalCaption2Style,
      color: tokens.colors.text.tertiary,
      marginBottom: tokens.spacing.sm,
    },
    symbolRow: {
      ...journalRow,
      alignItems: 'flex-start',
      gap: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    logoSlot: {
      paddingTop: 22,
    },
    logoImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.tertiary,
    },
    logoPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: tokens.colors.border.primary,
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    symbolInputWrap: {
      flex: 1,
      minWidth: 0,
    },
    topBar: {
      ...journalRow,
      alignItems: 'center',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.primary,
    },
    topBarSpacer: { width: 44 },
    topTitle: {
      flex: 1,
      fontSize: JOURNAL_TYPE.screenTitle.fontSize,
      fontWeight: JOURNAL_TYPE.screenTitle.fontWeight,
      lineHeight: JOURNAL_TYPE.screenTitle.lineHeight,
      letterSpacing: JOURNAL_TYPE.screenTitle.letterSpacing,
      color: tokens.colors.text.primary,
      direction: 'ltr',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    stepDots: {
      ...journalRow,
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      flexWrap: 'wrap',
    },
    stepDotWrap: {
      alignItems: 'center',
      maxWidth: 100,
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: tokens.colors.border.primary,
      marginBottom: 6,
    },
    stepDotActive: {
      backgroundColor: tokens.colors.primary.main,
      transform: [{ scale: 1.15 }],
    },
    stepDotDone: {
      backgroundColor: tokens.colors.primary.main,
      opacity: 0.45,
    },
    stepLabel: {
      ...journalCaptionStyle,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
    },
    stepLabelActive: {
      color: tokens.colors.primary.main,
      fontWeight: tokens.typography.fontWeight.semibold as '600',
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.xs,
      paddingBottom: 24,
    },
    inputGroup: {
      marginBottom: tokens.spacing.md,
    },
    label: {
      ...journalSectionSubtitleStyle,
      marginTop: 0,
      color: tokens.colors.text.secondary,
      marginBottom: tokens.spacing.xs,
    },
    inputGlassShell: {
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
      paddingHorizontal: tokens.spacing.md,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputGlassShellMultiline: {
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
    },
    inputGlassInner: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingVertical: tokens.spacing.sm,
      ...journalPhysicalRightText,
      fontSize: JOURNAL_TYPE.body.fontSize,
      fontWeight: JOURNAL_TYPE.body.fontWeight,
      lineHeight: JOURNAL_TYPE.body.lineHeight,
      color: tokens.colors.text.primary,
      width: '100%',
    },
    inputGlassInnerMultiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    directionButtons: {
      ...journalRow,
      gap: tokens.spacing.sm,
    },
    directionGlass: {
      flex: 1,
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
    },
    directionGlassLongOn: {
      backgroundColor: `${tokens.colors.primary.main}18`,
    },
    directionGlassShortOn: {
      backgroundColor: `${tokens.colors.text.danger}18`,
    },
    directionTouch: {
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directionButtonText: {
      fontSize: JOURNAL_TYPE.body.fontSize,
      fontWeight: tokens.typography.fontWeight.bold,
      lineHeight: JOURNAL_TYPE.body.lineHeight,
    },
    chipRow: {
      ...journalRow,
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    chipWrap: {
      ...journalRow,
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    labelSpaced: {
      marginTop: tokens.spacing.sm,
    },
    mistakeList: {
      gap: tokens.spacing.xs,
      marginBottom: tokens.spacing.lg,
    },
    mistakeCard: {
      width: '100%',
      borderRadius: tokens.borderRadius['3xl'],
      overflow: 'hidden',
    },
    mistakeCardOn: {
      backgroundColor: tokens.colors.background.tertiary,
    },
    mistakeRowInner: {
      ...journalRow,
      alignItems: 'center',
      gap: tokens.spacing.sm,
    },
    mistakeBox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: tokens.colors.border.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mistakeBoxOn: {
      borderColor: tokens.colors.border.primary,
      backgroundColor: tokens.colors.background.tertiary,
    },
    mistakeLabel: {
      flex: 1,
      ...journalBodyTextStyle,
      color: tokens.colors.text.primary,
    },
    footer: {
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 8,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
    },
  });
