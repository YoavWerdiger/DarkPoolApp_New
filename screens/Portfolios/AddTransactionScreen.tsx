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
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { SymbolSearchModal } from './components/SymbolSearchModal';
import {
  createTransaction,
  updateTransaction,
  getTransaction,
  getQuote,
  getCashFlowSummary,
  getHoldingsRaw,
} from '../../services/portfolios';
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
  const { portfolioId, initialMode = 'asset', transactionId } = route.params;

  const isEdit = Boolean(transactionId);
  const [mode, setMode] = useState<Mode>(initialMode);

  // Asset/dividend fields
  const [side, setSide] = useState<AssetTransactionType>('buy');
  const [direction, setDirection] = useState<TradeDirection>('long');
  const [symbol, setSymbol] = useState('');
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
  const [holdingsMap, setHoldingsMap] = useState<Record<string, number>>({});

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

  // טעינת יתרת מזומן + אחזקות קיימות לצורך validation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cf, rawHoldings] = await Promise.all([
          getCashFlowSummary(portfolioId),
          getHoldingsRaw(portfolioId),
        ]);
        if (cancelled) return;
        const cash = cf
          ? Number(cf.total_deposits) -
            Number(cf.total_withdrawals) -
            Number(cf.total_fees) -
            Number(cf.total_buys) +
            Number(cf.total_sells) +
            Number(cf.total_dividends)
          : 0;
        setAvailableCash(cash);
        const map: Record<string, number> = {};
        for (const h of rawHoldings) {
          if (h.quantity > 0) map[h.symbol.toUpperCase()] = h.quantity;
        }
        setHoldingsMap(map);
      } catch {
        // non-critical
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
        if (!symbol || !qtyNum || qtyNum <= 0 || isNaN(priceNum) || priceNum < 0) {
          Alert.alert('שגיאה', 'מלא symbol, quantity (>0) ו-price');
          return;
        }
        const payload = {
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
        } as const;
        if (transactionId) await updateTransaction(transactionId, payload);
        else await createTransaction(payload);
      } else if (mode === 'cash') {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum < 0) {
          Alert.alert('שגיאה', 'מלא amount תקין');
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
        if (!symbol || !amountNum || amountNum < 0) {
          Alert.alert('שגיאה', 'מלא symbol ו-amount');
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
      navigation.goBack();
    } catch (err) {
      Alert.alert('שגיאה', 'הוספת הטרנזקציה נכשלה');
    } finally {
      setSubmitting(false);
    }
  }, [
    mode, side, direction, cashSide, symbol, assetType, quantity, price, commission,
    amount, tradeDate, notes, currency, portfolioId, transactionId, navigation,
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

  const heldQty = useMemo(
    () => (symbol ? (holdingsMap[symbol.toUpperCase()] ?? 0) : null),
    [symbol, holdingsMap]
  );

  type CashValidation =
    | { kind: 'cash'; available: number; cost: number; remaining: number; ok: boolean }
    | { kind: 'position'; held: number; selling: number; remaining: number; ok: boolean }
    | null;

  const cashValidation = useMemo((): CashValidation => {
    if (mode !== 'asset') return null;
    if (direction === 'long' && side === 'buy') {
      if (availableCash === null || txCost === null) return null;
      return { kind: 'cash', available: availableCash, cost: txCost, remaining: availableCash - txCost, ok: availableCash >= txCost };
    }
    if (direction === 'long' && side === 'sell') {
      const qty = parseFloat(quantity);
      if (!qty || qty <= 0 || heldQty === null) return null;
      return { kind: 'position', held: heldQty, selling: qty, remaining: heldQty - qty, ok: qty <= heldQty };
    }
    return null;
  }, [mode, direction, side, availableCash, txCost, heldQty, quantity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: { padding: 16, paddingBottom: 80 },
        modeRow: {
          flexDirection: 'row-reverse',
          gap: 8,
          marginBottom: 18,
        },
        modeChip: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 26,
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
        },
        modeChipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: 'rgba(0, 200, 5, 0.10)',
        },
        modeChipText: {
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        modeChipTextActive: {
          color: tokens.colors.primary.main,
        },
        section: { marginBottom: 16 },
        labelHint: {
          fontSize: 11,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
        },
        label: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          marginBottom: 8,
          textAlign: 'right',
        },
        input: {
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 28,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 15,
          color: tokens.colors.text.primary,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        /** שדה מרובה שורות — פחות עיגול מלא כדי שלא ייראה כקפסולה */
        inputMultiline: {
          borderRadius: 22,
          paddingVertical: 12,
        },
        symbolPicker: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 28,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        symbolText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        symbolPlaceholder: {
          flex: 1,
          fontSize: 15,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
        },
        sideRow: {
          flexDirection: 'row-reverse',
          gap: 8,
        },
        sideBtn: {
          flex: 1,
          flexDirection: 'row-reverse',
          gap: 6,
          paddingVertical: 12,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
        },
        sideBtnText: {
          fontSize: 14,
          fontWeight: '700',
        },
        twoCol: {
          flexDirection: 'row-reverse',
          gap: 8,
        },
        col: { flex: 1 },
        validationCard: {
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 16,
          borderWidth: 1,
          gap: 8,
        },
        validationRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        validationLabel: {
          fontSize: 13,
          fontWeight: '500',
          color: tokens.colors.text.secondary,
          textAlign: 'right',
        },
        validationValue: {
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'left',
          fontVariant: ['tabular-nums'],
        },
        validationDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: tokens.colors.border.subtle,
        },
        validationWarningRow: {
          flexDirection: 'row-reverse',
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
          flexDirection: 'row-reverse',
          gap: 8,
        },
        datePill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 28,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        datePillText: {
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        pickerModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        pickerModalSheet: {
          backgroundColor: '#1A201A',
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
          borderRadius: 28,
          paddingVertical: 14,
          alignItems: 'center',
        },
        pickerDoneBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
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
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title={isEdit ? 'עריכת עסקה' : 'עסקה חדשה'}
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
          >
            {/* Mode tabs */}
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
                  disabled={isEdit}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      mode === m && styles.modeChipTextActive,
                    ]}
                  >
                    {m === 'asset' ? 'נכס / מניה' : m === 'cash' ? 'מזומן' : 'דיבידנד'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Asset mode */}
            {mode === 'asset' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>כיוון פוזיציה</Text>
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
                              ? 'rgba(0, 200, 5, 0.10)'
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
                        לונג
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
                              ? 'rgba(255, 68, 68, 0.10)'
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
                        שורט
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
                      <Text style={styles.symbolPlaceholder}>בחר/י סימבול…</Text>
                    )}
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.twoCol}>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>כמות</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                  <View style={[styles.section, styles.col]}>
                    <Text style={styles.label}>מחיר ליחידה</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>עמלה</Text>
                  <TextInput
                    style={styles.input}
                    value={commission}
                    onChangeText={setCommission}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={tokens.colors.text.tertiary}
                  />
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

            {/* Cash / Position Validation Bar */}
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
                {cashValidation.kind === 'cash' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <View style={styles.validationRow}>
                      <Text style={styles.validationLabel}>מניות בידך</Text>
                      <Text style={[styles.validationValue, { color: tokens.colors.text.primary }]}>
                        {cashValidation.held.toLocaleString()} {symbol}
                      </Text>
                    </View>
                    <View style={styles.validationRow}>
                      <Text style={styles.validationLabel}>מוכר</Text>
                      <Text style={[styles.validationValue, { color: tokens.colors.text.danger }]}>
                        −{cashValidation.selling.toLocaleString()} {symbol}
                      </Text>
                    </View>
                    <View style={styles.validationDivider} />
                    <View style={styles.validationRow}>
                      <Text style={[styles.validationLabel, { fontWeight: '700', color: tokens.colors.text.primary }]}>
                        נותר לאחר מכירה
                      </Text>
                      <Text style={[
                        styles.validationValue,
                        { color: cashValidation.ok ? tokens.colors.primary.main : tokens.colors.text.danger, fontSize: 14 }
                      ]}>
                        {cashValidation.remaining.toLocaleString()} {symbol}
                      </Text>
                    </View>
                    {!cashValidation.ok && (
                      <View style={styles.validationWarningRow}>
                        <Ionicons name="warning" size={14} color={tokens.colors.text.danger} />
                        <Text style={[styles.validationWarningText, { color: tokens.colors.text.danger }]}>
                          כמות גבוהה מהמצאי — בידך {cashValidation.held.toLocaleString()} {symbol} בלבד
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Common: Date + Time */}
            <View style={styles.section}>
              <Text style={styles.label}>תאריך ושעה</Text>
              <View style={styles.dateRow}>
                {/* Date picker */}
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

                {/* Time picker */}
                <TouchableOpacity
                  style={[styles.datePill, { flex: 0.7 }]}
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

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>הערות (עד 128 תווים)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  { minHeight: 70, textAlignVertical: 'top' },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="(אופציונלי)"
                placeholderTextColor={tokens.colors.text.tertiary}
                multiline
                maxLength={128}
              />
            </View>

            <TouchableOpacity
              style={[styles.submit, submitting && { opacity: 0.6 }]}
              onPress={() => {
                void HapticFeedback.medium();
                void handleSubmit();
              }}
              disabled={submitting}
              activeOpacity={0.88}
            >
              <Ionicons name="checkmark" size={22} color={tokens.colors.text.inverse} />
              <Text style={styles.submitText}>
                {submitting ? 'שומר…' : isEdit ? 'עדכן עסקה' : 'הוסף עסקה'}
              </Text>
            </TouchableOpacity>
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
