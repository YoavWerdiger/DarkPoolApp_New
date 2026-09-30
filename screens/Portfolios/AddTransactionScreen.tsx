import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCardBodyStyle,
  journalCardSubtitleStyle,
  journalSectionTitleStyle,
  PORTFOLIO_FORM,
} from './portfolioLayout';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { useToast } from '../../components/ui/Toast';
import { SymbolSearchModal } from './components/SymbolSearchModal';
import {
  createTransaction,
  updateTransaction,
  getTransaction,
  getQuote,
} from '../../services/portfolios';
import {
  insertOpenTrade,
  getTrade,
  updateTrade,
} from '../../services/portfolios/portfolioTradeDerive';
import { ASSET_TYPE_LABELS } from './portfolioConstants';
import { supabase } from '../../lib/supabase';
import type {
  AssetType,
  AssetTransactionType,
  CashTransactionType,
  TradeDirection,
} from './portfolioTypes';
import { TRANSACTION_LABELS } from './portfolioConstants';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'AddTransaction'>;
type Route = RouteProp<PortfoliosStackParamList, 'AddTransaction'>;

type Mode = 'asset' | 'cash' | 'dividend';

export default function AddTransactionScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {
    portfolioId,
    initialMode = 'asset',
    transactionId,
    editTradeId,
    initialSymbol,
  } = route.params;

  const isEdit = Boolean(transactionId) || Boolean(editTradeId);
  const [mode, setMode] = useState<Mode>(initialMode);
  const { showToast } = useToast();

  // Asset/dividend fields
  const [side, setSide] = useState<AssetTransactionType>('buy');
  const [direction, setDirection] = useState<TradeDirection>('long');
  const [symbol, setSymbol] = useState(
    () => String(initialSymbol ?? '').toUpperCase()
  );
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [commission, setCommission] = useState('0');

  // Cash fields
  const [cashSide, setCashSide] = useState<CashTransactionType>('deposit');
  const [amount, setAmount] = useState('');

  const [tradeDate, setTradeDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cash & position validation
  const [availableCash, setAvailableCash] = useState<number | null>(null);
  const [leverage, setLeverage] = useState('1');
  const [pointValue, setPointValue] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');

  // טען נתונים אם זה ריידיט
  useEffect(() => {
    if (!transactionId) return;
    (async () => {
      try {
        const tx = await getTransaction(transactionId);
        if (!tx) return;
        if (tx.type === 'buy' || tx.type === 'sell') {
          setMode('asset');
          setSide(tx.type);
          setDirection((tx as { direction?: TradeDirection }).direction ?? 'long');
          setSymbol(tx.symbol ?? '');
          setAssetType((tx.asset_type as AssetType) ?? 'stock');
          setQuantity(String(tx.quantity ?? ''));
          setPrice(String(tx.price ?? ''));
          setCommission(String(tx.commission ?? 0));
        } else if (tx.type === 'dividend') {
          setMode('dividend');
          setSymbol(tx.symbol ?? '');
          setAmount(String(tx.amount ?? ''));
        } else {
          setMode('cash');
          setCashSide(tx.type);
          setAmount(String(tx.amount ?? ''));
        }
        setTradeDate(new Date(tx.date));
        setNotes(tx.notes ?? '');
        setCurrency(tx.currency);
      } catch {
        Alert.alert('שגיאה', 'לא הצלחנו לטעון את הטרנזקציה');
      }
    })();
  }, [transactionId]);

  // טעינת trade קיים ממודל החדש (editTradeId)
  useEffect(() => {
    if (!editTradeId) return;
    (async () => {
      try {
        const trade = await getTrade(editTradeId);
        if (!trade) return;
        setMode('asset');
        setDirection(trade.direction);
        setSide(trade.direction === 'long' ? 'buy' : 'sell');
        setSymbol(trade.symbol);
        setAssetType((trade.asset_type as AssetType) ?? 'stock');
        setQuantity(String(trade.quantity));
        setPrice(String(trade.entry_price));
        setCommission(String(trade.commission ?? 0));
        setLeverage(String(trade.leverage ?? 1));
        if (trade.point_value) setPointValue(String(trade.point_value));
        setStopLoss(trade.stop_loss != null ? String(trade.stop_loss) : '');
        setTargetPrice(trade.target_price != null ? String(trade.target_price) : '');
        setTradeDate(new Date(trade.entry_date));
        setNotes(trade.notes ?? '');
        setCurrency(trade.currency);
      } catch {
        Alert.alert('שגיאה', 'לא הצלחנו לטעון את הטרייד');
      }
    })();
  }, [editTradeId]);

  // טעינת יתרת מזומן מ-portfolios.available_cash לצורך validation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('available_cash')
          .eq('id', portfolioId)
          .single();
        if (cancelled) return;
        if (error) {
          console.warn('[AddTransaction] failed to load available_cash:', error.message);
          return;
        }
        setAvailableCash(Number(data?.available_cash ?? 0));
      } catch (err) {
        console.warn('[AddTransaction] available_cash fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [portfolioId]);

  const handlePickSymbol = useCallback(async (sym: string) => {
    setSymbol(sym);
    if (mode === 'asset' && !price) {
      const q = await getQuote(sym);
      if (q) {
        setPrice(String(q.price.toFixed(2)));
        setCurrency(q.currency);
      }
    }
  }, [mode, price]);

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitting(true);
      const dateIso = tradeDate.toISOString();

      if (mode === 'asset') {
        const qtyNum = parseFloat(quantity);
        const priceNum = parseFloat(price);
        const commNum = parseFloat(commission) || 0;
        const leverageNum = parseFloat(leverage) || 1;
        const pvNum = parseFloat(pointValue) || null;
        const stopLossNum = stopLoss.trim() ? parseFloat(stopLoss) : null;
        const targetPriceNum = targetPrice.trim() ? parseFloat(targetPrice) : null;
        if (stopLossNum != null && (isNaN(stopLossNum) || stopLossNum < 0)) {
          Alert.alert('סטופ לא תקין', 'הכנס מחיר סטופ תקין, או השאר ריק.');
          return;
        }
        if (targetPriceNum != null && (isNaN(targetPriceNum) || targetPriceNum < 0)) {
          Alert.alert('יעד לא תקין', 'הכנס מחיר יעד תקין, או השאר ריק.');
          return;
        }

        if (!symbol) {
          Alert.alert('שדה חסר', 'יש לבחור סימבול לנכס.');
          return;
        }
        if (!qtyNum || qtyNum <= 0) {
          Alert.alert('כמות לא תקינה', 'הכנס כמות גדולה מ-0.');
          return;
        }
        if (isNaN(priceNum) || priceNum < 0) {
          Alert.alert('מחיר לא תקין', 'הכנס מחיר אמיתי (0 ומעלה).');
          return;
        }
        // ולידציה: תאריך פתיחה לא יכול להיות בעתיד (רק לפוזיציות חדשות)
        if (!editTradeId && !transactionId && tradeDate > new Date()) {
          Alert.alert('תאריך לא תקין', 'תאריך הפתיחה לא יכול להיות בעתיד.');
          return;
        }

        if (editTradeId) {
          // עריכת trade קיים ממודל החדש (trades table)
          await updateTrade(editTradeId, {
            portfolio_id: portfolioId,
            symbol: symbol.toUpperCase(),
            asset_type: assetType,
            currency,
            direction,
            entry_date: dateIso,
            entry_price: priceNum,
            quantity: qtyNum,
            leverage: leverageNum,
            point_value: pvNum,
            commission: commNum,
            notes: notes.trim() || null,
            stop_loss: stopLossNum,
            target_price: targetPriceNum,
          });
        } else if (transactionId) {
          // מצב עריכה — עדכן ב-portfolio_transactions (backward compat)
          await updateTransaction(transactionId, {
            portfolio_id: portfolioId,
            type: side,
            direction,
            symbol: symbol.toUpperCase(),
            asset_type: assetType,
            quantity: qtyNum,
            price: priceNum,
            commission: commNum,
            currency,
            date: dateIso,
            notes: notes.trim() || null,
          } as const);
        } else {
          // פתיחת פוזיציה חדשה — INSERT ל-trades עם status='OPEN'
          await insertOpenTrade({
            portfolio_id: portfolioId,
            symbol: symbol.toUpperCase(),
            asset_type: assetType,
            currency,
            direction,
            entry_date: dateIso,
            entry_price: priceNum,
            quantity: qtyNum,
            leverage: leverageNum,
            point_value: pvNum,
            commission: commNum,
            notes: notes.trim() || null,
            stop_loss: stopLossNum,
            target_price: targetPriceNum,
          });
        }
      } else if (mode === 'cash') {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum <= 0) {
          Alert.alert('סכום לא תקין', 'הכנס סכום גדול מ-0.');
          return;
        }
        const payload = {
          portfolio_id: portfolioId,
          type: cashSide,
          amount: amountNum,
          currency,
          date: dateIso,
          notes: notes.trim() || null,
        } as const;
        if (transactionId) await updateTransaction(transactionId, payload);
        else await createTransaction(payload);
      } else if (mode === 'dividend') {
        const amountNum = parseFloat(amount);
        if (!symbol) {
          Alert.alert('שדה חסר', 'יש לבחור סימבול לדיבידנד.');
          return;
        }
        if (!amountNum || amountNum <= 0) {
          Alert.alert('סכום לא תקין', 'הכנס סכום דיבידנד גדול מ-0.');
          return;
        }
        const payload = {
          portfolio_id: portfolioId,
          type: 'dividend' as const,
          symbol: symbol.toUpperCase(),
          amount: amountNum,
          currency,
          date: dateIso,
          notes: notes.trim() || null,
        };
        if (transactionId) await updateTransaction(transactionId, payload);
        else await createTransaction(payload);
      }
      showToast(isEdit ? 'העסקה עודכנה בהצלחה' : 'העסקה נוספה בהצלחה', 'success', 2500);
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
      console.error('[AddTransaction] submit error:', err);
      Alert.alert(
        'שגיאה',
        isEdit
          ? `עדכון העסקה נכשל: ${msg}`
          : `הוספת העסקה נכשלה: ${msg}`,
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    mode, side, direction, cashSide, symbol, assetType, quantity, price, commission,
    leverage, pointValue, stopLoss, targetPrice, amount, tradeDate, notes, currency, portfolioId,
    transactionId, editTradeId, navigation,
  ]);

  // עלות עסקה בזמן אמת
  const txCost = useMemo(() => {
    if (mode !== 'asset') return null;
    const qty = parseFloat(quantity);
    const pr = parseFloat(price);
    const comm = parseFloat(commission) || 0;
    if (!qty || qty <= 0 || isNaN(pr) || pr < 0) return null;
    return qty * pr + comm;
  }, [mode, quantity, price, commission]);

  type CashValidation =
    | { kind: 'cash'; available: number; cost: number; remaining: number; ok: boolean }
    | null;

  const cashValidation = useMemo((): CashValidation => {
    if (mode !== 'asset') return null;
    if (direction === 'long' && side === 'buy') {
      if (availableCash === null || txCost === null) return null;
      return { kind: 'cash', available: availableCash, cost: txCost, remaining: availableCash - txCost, ok: availableCash >= txCost };
    }
    return null;
  }, [mode, direction, side, availableCash, txCost]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: 'transparent', direction: 'rtl' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          paddingHorizontal: PORTFOLIO_FORM.screenPadH,
          paddingTop: 4,
          paddingBottom: 40,
        },
        modeRow: {
          flexDirection: 'row',
          gap: JOURNAL_LAYOUT.stackGapSmall,
          marginBottom: PORTFOLIO_FORM.sectionGap,
        },
        modeChip: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: tokens.borderRadius.full,
          alignItems: 'center',
          borderWidth: 0,
          backgroundColor: tokens.colors.background.input,
        },
        modeChipActive: {
          backgroundColor: tokens.colors.background.tertiary,
          borderWidth: 0,
        },
        modeChipText: {
          ...journalCardSubtitleStyle,
          fontWeight: '700',
          textAlign: 'center',
        },
        modeChipTextActive: {
          color: tokens.colors.primary.main,
        },
        section: { marginBottom: PORTFOLIO_FORM.sectionGap },
        label: formFieldLabelStyle({ tokens, focused: false, error: false }),
        input: {
          ...formFieldShellStyle({ tokens, focused: false, multiline: false }),
          ...formFieldInputStyle(),
          borderRadius: tokens.borderRadius.full,
          paddingHorizontal: 16,
          paddingVertical: 14,
          minHeight: 52,
        },
        inputMultiline: {
          borderRadius: 14,
          paddingVertical: 12,
          minHeight: 88,
        },
        symbolPicker: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          ...formFieldShellStyle({ tokens, focused: false, multiline: false }),
          borderRadius: tokens.borderRadius.full,
          paddingHorizontal: 16,
          paddingVertical: 14,
          minHeight: 52,
        },
        symbolText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        symbolPlaceholder: {
          flex: 1,
          ...journalCardBodyStyle,
          color: tokens.colors.text.tertiary,
        },
        sideRow: {
          flexDirection: 'row',
          gap: 10,
        },
        sideBtn: {
          flex: 1,
          flexDirection: 'row',
          gap: 6,
          paddingVertical: 14,
          borderRadius: tokens.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 0,
          backgroundColor: tokens.colors.background.input,
        },
        sideBtnText: {
          fontSize: JOURNAL_TYPE.cardBody.fontSize,
          fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
          lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
          letterSpacing: 0.3,
        },
        assetTypeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        assetTypeChip: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: tokens.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 0,
          backgroundColor: tokens.colors.background.input,
        },
        twoCol: {
          flexDirection: 'row',
          gap: 10,
        },
        col: { flex: 1 },
        advancedBlock: {
          marginTop: 4,
          marginBottom: 4,
          paddingTop: 4,
          gap: 0,
        },
        advancedTitle: {
          ...journalSectionTitleStyle,
          fontSize: journalCardSubtitleStyle.fontSize,
          lineHeight: journalCardSubtitleStyle.lineHeight,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
          marginBottom: JOURNAL_LAYOUT.stackGapSmall,
        },
        validationCard: {
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 18,
          borderWidth: 1,
          gap: 8,
        },
        validationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        validationLabel: {
          ...journalCardSubtitleStyle,
          width: undefined,
          color: tokens.colors.text.secondary,
        },
        validationValue: {
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'left',
          fontVariant: ['tabular-nums'],
        },
        validationDivider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
        },
        validationWarningRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingTop: 4,
        },
        validationWarningText: {
          fontSize: 12,
          fontWeight: '700',
          textAlign: 'right',
          flex: 1,
        },
        dateRow: {
          flexDirection: 'row',
          gap: 10,
        },
        datePill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          ...formFieldShellStyle({ tokens, focused: false, multiline: false }),
          borderRadius: tokens.borderRadius.full,
          paddingHorizontal: 14,
          paddingVertical: 14,
        },
        datePillText: {
          ...journalBodyTextStyle,
          color: tokens.colors.text.primary,
          flex: 1,
          width: undefined,
        },
        pickerModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        pickerModalSheet: {
          backgroundColor: tokens.colors.background.cardSolid,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 36,
        },
        pickerModalTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: 8,
        },
        pickerDoneBtn: {
          marginTop: 12,
          backgroundColor: tokens.colors.primary.main,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: 'center',
        },
        pickerDoneBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
        footerRow: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 8,
          marginBottom: 8,
        },
        cancelBtn: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'transparent',
        },
        cancelBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        submit: {
          flex: 1.4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingVertical: 16,
          borderRadius: 14,
        },
        submitText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title={isEdit ? 'עריכת עסקה' : 'פוזיציה חדשה'}
          subtitle={
            isEdit
              ? 'עדכון פרטי הפוזיציה'
              : 'הזן את פרטי הפוזיציה החדשה'
          }
          onBack={() => navigation.goBack()}
        />
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Mode tabs */}
            {!isEdit ? (
              <View style={styles.modeRow}>
                {(['asset', 'cash', 'dividend'] as Mode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      if (mode !== m) void HapticFeedback.selection();
                      setMode(m);
                    }}
                    style={[styles.modeChip, mode === m && styles.modeChipActive]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        mode === m && styles.modeChipTextActive,
                      ]}
                    >
                      {m === 'asset' ? 'פוזיציה' : m === 'cash' ? 'מזומן' : 'דיבידנד'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Asset mode — hierarchy inspired by clear journal-style entry */}
            {mode === 'asset' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>סוג נכס</Text>
                  <View style={styles.assetTypeRow}>
                    {(['stock', 'etf', 'crypto', 'forex', 'futures', 'fund'] as AssetType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        activeOpacity={1}
                        style={[
                          styles.assetTypeChip,
                          assetType === t && {
                            backgroundColor: tokens.colors.background.tertiary,
                          },
                        ]}
                        onPress={() => {
                          if (assetType !== t) void HapticFeedback.selection();
                          setAssetType(t);
                        }}
                      >
                        <Text
                          style={[
                            styles.sideBtnText,
                            { fontSize: 13 },
                            {
                              color:
                                assetType === t
                                  ? tokens.colors.primary.main
                                  : tokens.colors.text.secondary,
                            },
                          ]}
                        >
                          {ASSET_TYPE_LABELS[t]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>סימבול</Text>
                  <TouchableOpacity
                    style={styles.symbolPicker}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setSearchOpen(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="search"
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                    {symbol ? (
                      <Text style={styles.symbolText}>{symbol}</Text>
                    ) : (
                      <Text style={styles.symbolPlaceholder}>לדוגמה: AAPL</Text>
                    )}
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>סוג עסקה</Text>
                  <View style={styles.sideRow}>
                    <TouchableOpacity
                      activeOpacity={1}
                      style={[
                        styles.sideBtn,
                        {
                          borderColor:
                            direction === 'long'
                              ? tokens.colors.primary.main
                              : tokens.colors.border.subtle,
                          backgroundColor:
                            direction === 'long'
                              ? 'rgba(0, 200, 5, 0.12)'
                              : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        if (direction !== 'long') void HapticFeedback.selection();
                        setDirection('long');
                        setSide('buy');
                      }}
                    >
                      <Text
                        style={[
                          styles.sideBtnText,
                          {
                            color:
                              direction === 'long'
                                ? tokens.colors.primary.main
                                : tokens.colors.text.secondary,
                          },
                        ]}
                      >
                        LONG
                      </Text>
                      <Ionicons
                        name="trending-up"
                        size={18}
                        color={
                          direction === 'long'
                            ? tokens.colors.primary.main
                            : tokens.colors.text.secondary
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={1}
                      style={[
                        styles.sideBtn,
                        {
                          borderColor:
                            direction === 'short'
                              ? tokens.colors.text.danger
                              : tokens.colors.border.subtle,
                          backgroundColor:
                            direction === 'short'
                              ? 'rgba(255, 68, 68, 0.12)'
                              : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        if (direction !== 'short') void HapticFeedback.selection();
                        setDirection('short');
                        setSide('sell');
                      }}
                    >
                      <Text
                        style={[
                          styles.sideBtnText,
                          {
                            color:
                              direction === 'short'
                                ? tokens.colors.text.danger
                                : tokens.colors.text.secondary,
                          },
                        ]}
                      >
                        SHORT
                      </Text>
                      <Ionicons
                        name="trending-down"
                        size={18}
                        color={
                          direction === 'short'
                            ? tokens.colors.text.danger
                            : tokens.colors.text.secondary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>{assetType === 'futures' ? 'מספר חוזים' : 'כמות'}</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder={assetType === 'futures' ? '1' : '10'}
                    placeholderTextColor={tokens.colors.text.tertiary}
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>מחיר כניסה</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="150.00"
                    placeholderTextColor={tokens.colors.text.tertiary}
                  />
                </View>

                <View style={styles.twoCol}>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>סטופ (אופציונלי)</Text>
                    <TextInput
                      style={styles.input}
                      value={stopLoss}
                      onChangeText={setStopLoss}
                      keyboardType="decimal-pad"
                      placeholder="145.00"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>יעד (אופציונלי)</Text>
                    <TextInput
                      style={styles.input}
                      value={targetPrice}
                      onChangeText={setTargetPrice}
                      keyboardType="decimal-pad"
                      placeholder="165.00"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Cash mode */}
            {mode === 'cash' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>סוג טרנזקציה</Text>
                  <View style={styles.sideRow}>
                    {(['deposit', 'withdrawal', 'fee'] as CashTransactionType[]).map(
                      (t) => (
                        <TouchableOpacity
                          key={t}
                          activeOpacity={1}
                          style={[
                            styles.sideBtn,
                            {
                              borderColor:
                                cashSide === t
                                  ? tokens.colors.primary.main
                                  : tokens.colors.border.subtle,
                              backgroundColor:
                                cashSide === t
                                  ? 'rgba(0, 200, 5, 0.10)'
                                  : 'transparent',
                            },
                          ]}
                          onPress={() => {
                            if (cashSide !== t) void HapticFeedback.selection();
                            setCashSide(t);
                          }}
                        >
                          <Text
                            style={[
                              styles.sideBtnText,
                              {
                                color:
                                  cashSide === t
                                    ? tokens.colors.primary.main
                                    : tokens.colors.text.secondary,
                                fontSize: 12,
                              },
                            ]}
                          >
                            {TRANSACTION_LABELS[t]}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>סכום</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={tokens.colors.text.tertiary}
                  />
                </View>
              </>
            )}

            {/* Dividend mode */}
            {mode === 'dividend' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>סימבול</Text>
                  <TouchableOpacity
                    style={styles.symbolPicker}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setSearchOpen(true);
                    }}
                  >
                    <Ionicons
                      name="search"
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                    {symbol ? (
                      <Text style={styles.symbolText}>{symbol}</Text>
                    ) : (
                      <Text style={styles.symbolPlaceholder}>בחר/י סימבול…</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>סך הדיבידנד שהתקבל</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={tokens.colors.text.tertiary}
                  />
                </View>
              </>
            )}

            {/* Cash Validation Bar */}
            {cashValidation && (
              <View
                style={[
                  styles.validationCard,
                  {
                    backgroundColor: cashValidation.ok
                      ? 'rgba(0,200,5,0.06)'
                      : 'rgba(255,68,68,0.08)',
                    borderColor: cashValidation.ok
                      ? 'rgba(0,200,5,0.25)'
                      : 'rgba(255,68,68,0.35)',
                  },
                ]}
              >
                <View style={styles.validationRow}>
                  <Text style={styles.validationLabel}>מזומן זמין</Text>
                  <Text style={[styles.validationValue, { color: tokens.colors.text.primary }]}>
                    {cashValidation.available.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.validationRow}>
                  <Text style={styles.validationLabel}>עלות עסקה</Text>
                  <Text style={[styles.validationValue, { color: tokens.colors.text.danger }]}>
                    −{cashValidation.cost.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.validationDivider} />
                <View style={styles.validationRow}>
                  <Text style={[styles.validationLabel, { fontWeight: '700', color: tokens.colors.text.primary }]}>
                    לאחר עסקה
                  </Text>
                  <Text style={[
                    styles.validationValue,
                    { color: cashValidation.ok ? tokens.colors.primary.main : tokens.colors.text.danger, fontSize: 14 }
                  ]}>
                    {cashValidation.remaining.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                {!cashValidation.ok && (
                  <View style={styles.validationWarningRow}>
                    <Ionicons name="warning" size={14} color={tokens.colors.text.danger} />
                    <Text style={[styles.validationWarningText, { color: tokens.colors.text.danger }]}>
                      מזומן לא מספיק — חסרים{' '}
                      {Math.abs(cashValidation.remaining).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Common: Date + Time */}
            <View style={styles.section}>
              <Text style={styles.label}>
                {mode === 'asset' ? 'תאריך ושעת כניסה' : 'תאריך ושעה'}
              </Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.datePill}
                  activeOpacity={0.8}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={tokens.colors.text.tertiary} />
                  <Text style={styles.datePillText}>
                    {tradeDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.datePill}
                  activeOpacity={0.8}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color={tokens.colors.text.tertiary} />
                  <Text style={styles.datePillText}>
                    {tradeDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date picker modal (iOS) / inline (Android) */}
              {Platform.OS === 'ios' ? (
                <Modal
                  visible={showDatePicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowDatePicker(false)}
                >
                  <TouchableOpacity
                    style={styles.pickerModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <View style={styles.pickerModalSheet}>
                      <Text style={styles.pickerModalTitle}>בחר תאריך</Text>
                      <DateTimePicker
                        value={tradeDate}
                        mode="date"
                        display="inline"
                        locale="he-IL"
                        themeVariant="dark"
                        onChange={(_, d) => { if (d) setTradeDate(d); }}
                        style={{ alignSelf: 'stretch' }}
                      />
                      <TouchableOpacity
                        style={styles.pickerDoneBtn}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.pickerDoneBtnText}>אישור</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              ) : showDatePicker ? (
                <DateTimePicker
                  value={tradeDate}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setTradeDate(d);
                  }}
                />
              ) : null}

              {/* Time picker modal (iOS) / inline (Android) */}
              {Platform.OS === 'ios' ? (
                <Modal
                  visible={showTimePicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowTimePicker(false)}
                >
                  <TouchableOpacity
                    style={styles.pickerModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <View style={styles.pickerModalSheet}>
                      <Text style={styles.pickerModalTitle}>בחר שעה</Text>
                      <DateTimePicker
                        value={tradeDate}
                        mode="time"
                        display="spinner"
                        locale="he-IL"
                        themeVariant="dark"
                        is24Hour
                        onChange={(_, d) => { if (d) setTradeDate(d); }}
                        style={{ alignSelf: 'stretch' }}
                      />
                      <TouchableOpacity
                        style={styles.pickerDoneBtn}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.pickerDoneBtnText}>אישור</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              ) : showTimePicker ? (
                <DateTimePicker
                  value={tradeDate}
                  mode="time"
                  display="default"
                  is24Hour
                  onChange={(_, d) => {
                    setShowTimePicker(false);
                    if (d) setTradeDate(d);
                  }}
                />
              ) : null}
            </View>

            {mode === 'asset' ? (
              <View style={styles.advancedBlock}>
                <Text style={styles.advancedTitle}>פרטים נוספים</Text>
                <View style={styles.twoCol}>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>עמלה (אופציונלי)</Text>
                    <TextInput
                      style={styles.input}
                      value={commission}
                      onChangeText={setCommission}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>מינוף</Text>
                    <TextInput
                      style={styles.input}
                      value={leverage}
                      onChangeText={setLeverage}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                </View>
                {assetType === 'futures' ? (
                  <View style={styles.section}>
                    <Text style={styles.label}>ערך לנקודה</Text>
                    <TextInput
                      style={styles.input}
                      value={pointValue}
                      onChangeText={setPointValue}
                      keyboardType="decimal-pad"
                      placeholder="לדוגמה: 50 ל-ES, 20 ל-NQ"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>הערות (אופציונלי)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  { textAlignVertical: 'top' },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="הוסף הערות על העסקה…"
                placeholderTextColor={tokens.colors.text.tertiary}
                multiline
                maxLength={128}
              />
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  navigation.goBack();
                }}
                activeOpacity={0.85}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submit, submitting && { opacity: 0.6 }]}
                onPress={() => {
                  void HapticFeedback.medium();
                  void handleSubmit();
                }}
                disabled={submitting}
                activeOpacity={0.88}
              >
                <Ionicons name="checkmark" size={20} color={tokens.colors.text.inverse} />
                <Text style={styles.submitText}>
                  {submitting ? 'שומר…' : isEdit ? 'עדכן עסקה' : 'הוסף עסקה'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SymbolSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(r) => handlePickSymbol(r.symbol)}
      />
    </View>
  );
}
