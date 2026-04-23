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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { BRANDFETCH_CLIENT_ID } from '../../config/publicEnv';
import { HapticFeedback } from '../../utils/hapticFeedback';

const STEPS = ['פרטי עסקה', 'מחירים וכמות', 'תאריכים ושעות'] as const;

type Nav = NativeStackNavigationProp<JournalStackParamList, 'AddTrade'>;

export default function AddTradeScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [entryDateText, setEntryDateText] = useState('');
  const [exitDateText, setExitDateText] = useState('');
  const [entryTimeText, setEntryTimeText] = useState('');
  const [exitTimeText, setExitTimeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

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
        isNaN(day) ||
        isNaN(month) ||
        isNaN(year) ||
        isNaN(hour) ||
        isNaN(minute) ||
        day < 1 ||
        day > 31 ||
        month < 1 ||
        month > 12 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
      ) {
        return null;
      }
      return new Date(year, month - 1, day, hour, minute);
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
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* כותרת — כמו יומן: ימין־שמאל, בלי Bottom Sheet */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={goBackStep}
              style={styles.topBarBtn}
              accessibilityRole="button"
              accessibilityLabel={step === 0 ? 'סגור' : 'שלב קודם'}
            >
              <Ionicons
                name={step === 0 ? 'close' : 'chevron-forward'}
                size={26}
                color={DesignTokens.colors.text.primary}
              />
            </TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>
              הוסף טרייד
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          {/* אינדיקטור שלבים */}
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
                    <TextInput
                      style={styles.input}
                      value={symbol}
                      onChangeText={setSymbol}
                      placeholder="למשל AAPL, TSLA, MSFT"
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      textAlign="right"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>כיוון *</Text>
                  <View style={styles.directionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.directionButton,
                        direction === 'long'
                          ? { backgroundColor: `${DesignTokens.colors.primary.main}20` }
                          : { backgroundColor: DesignTokens.colors.background.tertiary },
                      ]}
                      onPress={() => setDirection('long')}
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
                    <TouchableOpacity
                      style={[
                        styles.directionButton,
                        direction === 'short'
                          ? { backgroundColor: `${DesignTokens.colors.text.danger}20` }
                          : { backgroundColor: DesignTokens.colors.background.tertiary },
                      ]}
                      onPress={() => setDirection('short')}
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
                  </View>
                </View>
              </>
            )}

            {step === 1 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>מחיר כניסה *</Text>
                  <TextInput
                    style={styles.input}
                    value={entryPrice}
                    onChangeText={setEntryPrice}
                    placeholder="0.00"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    keyboardType="decimal-pad"
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>מחיר יציאה *</Text>
                  <TextInput
                    style={styles.input}
                    value={exitPrice}
                    onChangeText={setExitPrice}
                    placeholder="0.00"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    keyboardType="decimal-pad"
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>כמות *</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    keyboardType="decimal-pad"
                    textAlign="right"
                  />
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>תאריך כניסה * (DD/MM/YYYY)</Text>
                  <TextInput
                    style={styles.input}
                    value={entryDateText}
                    onChangeText={setEntryDateText}
                    placeholder="01/01/2024"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>שעת כניסה * (HH:MM)</Text>
                  <TextInput
                    style={styles.input}
                    value={entryTimeText}
                    onChangeText={setEntryTimeText}
                    placeholder="09:30"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>תאריך יציאה * (DD/MM/YYYY)</Text>
                  <TextInput
                    style={styles.input}
                    value={exitDateText}
                    onChangeText={setExitDateText}
                    placeholder="01/01/2024"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>שעת יציאה * (HH:MM)</Text>
                  <TextInput
                    style={styles.input}
                    value={exitTimeText}
                    onChangeText={setExitTimeText}
                    placeholder="16:00"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    textAlign="right"
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={goNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'שומר…' : step === STEPS.length - 1 ? 'שמור טרייד' : 'המשך'}
              </Text>
            </TouchableOpacity>
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
      backgroundColor: '#0A0E0A',
    },
    flex1: { flex: 1 },
    safe: { flex: 1, backgroundColor: 'transparent' },
    stepIntro: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 20,
      marginBottom: tokens.spacing.md,
    },
    envHint: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: tokens.spacing.sm,
    },
    symbolRow: {
      flexDirection: 'row-reverse',
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
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.primary,
    },
    topBarBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topBarSpacer: { width: 44 },
    topTitle: {
      flex: 1,
      fontSize: tokens.typography.title2.size,
      lineHeight: tokens.typography.title2.lineHeight,
      fontWeight: tokens.typography.title2.weight as '700',
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    stepDots: {
      flexDirection: 'row-reverse',
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
      fontSize: tokens.typography.caption.size,
      lineHeight: tokens.typography.caption.lineHeight,
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
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
      marginBottom: tokens.spacing.xs,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    input: {
      backgroundColor: tokens.colors.background.tertiary,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.primary,
    },
    directionButtons: {
      flexDirection: 'row-reverse',
      gap: tokens.spacing.sm,
    },
    directionButton: {
      flex: 1,
      padding: tokens.spacing.md,
      borderRadius: tokens.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directionButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    footer: {
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 8,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.primary,
    },
    primaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.primary.main,
      borderRadius: tokens.borderRadius.md,
      paddingVertical: 14,
    },
    primaryBtnDisabled: { opacity: 0.55 },
    primaryBtnText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.inverse,
    },
  });
