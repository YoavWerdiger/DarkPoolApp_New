import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { chromeSurfaceFill } from '../../components/ui/chromeControl';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import UIButton from '../../components/ui/UIButton';
import UICard from '../../components/ui/UICard';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCaptionStyle,
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
  PORTFOLIO_FORM,
} from './portfolioLayout';
import { FieldLabel, TextField } from './components/PortfolioFormFields';
import { PortfolioFormFooter } from './components/PortfolioFormFooter';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import { useToast } from '../../components/ui/Toast';
import { SymbolSearchModal } from './components/SymbolSearchModal';
import { assetTypeFromSearchType } from '../../services/portfolios/symbolSearchFilter';
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
        // LTR Yoga + row-reverse — כמו CreatePortfolio / PortfolioFormFields (בלי direction:rtl כפול)
        root: { flex: 1, backgroundColor: tokens.colors.background.primary },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          paddingHorizontal: PORTFOLIO_FORM.screenPadH,
          paddingTop: 4,
          paddingBottom: 40,
        },
        /** DayDividerPill / AdminFilterChip — גלולה lightCta נבחרת, לא ירוק ניאון */
        filterChipGrow: {
          flex: 1,
          alignSelf: 'stretch',
          borderRadius: tokens.borderRadius.full,
          minHeight: 44,
        },
        filterChipPad: {
          minHeight: 44,
          paddingVertical: 12,
          paddingHorizontal: 12,
          width: '100%',
        },
        assetChip: {
          alignSelf: 'flex-start',
          borderRadius: tokens.borderRadius.full,
          minHeight: 40,
        },
        assetChipPad: {
          minHeight: 40,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        /** תווית צ'יפ — APP_TYPE; נבחר = text.inverse על lightCta כמו DayDividerPill */
        chipLabel: {
          ...journalCardSubtitleStyle,
          width: undefined,
          marginTop: 0,
          fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
          textAlign: 'center',
          color: tokens.colors.text.primary,
        },
        chipLabelSelected: {
          color: tokens.colors.text.inverse,
        },
        chipsWrap: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: JOURNAL_LAYOUT.stackGapSmall,
          marginBottom: PORTFOLIO_FORM.fieldSpacing,
        },
        fieldBlock: { marginBottom: PORTFOLIO_FORM.fieldSpacing },
        symbolPicker: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          ...formFieldShellStyle({ tokens, focused: false, multiline: false }),
          borderRadius: tokens.borderRadius.search,
          paddingHorizontal: 16,
          minHeight: 52,
          borderWidth: 0,
        },
        symbolText: {
          ...journalCardTitleStyle,
          flex: 1,
          width: undefined,
          marginTop: 0,
          // appCardTitleStyle מביא alignSelf: stretch — דורס את המרכוז האנכי של השורה
          alignSelf: 'center',
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'right',
          direction: 'ltr',
        },
        symbolPlaceholder: {
          ...journalBodyTextStyle,
          ...journalPhysicalRightText,
          flex: 1,
          width: undefined,
          alignSelf: 'center',
          color: tokens.colors.text.secondary,
        },
        /** לונג/שורט — שורת half-width כמו DayDividerPill, צבע רק בנבחר */
        sideRow: {
          flexDirection: 'row-reverse',
          alignSelf: 'stretch',
          width: '100%',
          alignItems: 'stretch',
          gap: JOURNAL_LAYOUT.stackGapSmall,
        },
        sideBtn: {
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          borderRadius: tokens.borderRadius.full,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 0,
        },
        sideBtnLongSelected: {
          backgroundColor: tokens.colors.primary.main,
        },
        sideBtnLongIdle: {
          backgroundColor: chromeSurfaceFill(tokens),
        },
        sideBtnShortSelected: {
          backgroundColor: tokens.colors.danger.main,
        },
        sideBtnShortIdle: {
          backgroundColor: chromeSurfaceFill(tokens),
        },
        /** cardTitle — אותה משפחת כותרת כמו הדר, בלי screenTitle ענק שמתנגש */
        sideLabel: {
          ...journalCardTitleStyle,
          width: undefined,
          marginTop: 0,
          textAlign: 'center',
        },
        sideLabelOnFill: {
          color: tokens.colors.text.inverse,
        },
        sideLabelIdle: {
          color: tokens.colors.text.primary,
        },
        twoCol: {
          flexDirection: 'row-reverse',
          gap: JOURNAL_LAYOUT.stackGapSmall,
          marginBottom: PORTFOLIO_FORM.fieldSpacing,
        },
        col: { flex: 1 },
        advancedBlock: {
          marginBottom: PORTFOLIO_FORM.fieldSpacing,
        },
        advancedTitle: {
          ...JOURNAL_TYPE.groupLabel,
          ...journalPhysicalRightText,
          color: tokens.colors.text.primary,
          marginBottom: JOURNAL_LAYOUT.groupLabelToContent,
        },
        validationInner: {
          gap: JOURNAL_LAYOUT.stackGapSmall,
        },
        validationCard: {
          marginBottom: PORTFOLIO_FORM.fieldSpacing,
          borderRadius: UI_CARD_RADIUS,
          overflow: 'hidden',
          borderWidth: 0,
        },
        validationRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        },
        validationLabel: {
          ...journalCardSubtitleStyle,
          width: undefined,
          marginTop: 0,
          color: tokens.colors.text.primary,
        },
        validationValue: {
          ...journalCardSubtitleStyle,
          width: undefined,
          marginTop: 0,
          fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
          textAlign: 'left',
          writingDirection: 'ltr',
          direction: 'ltr',
          fontVariant: ['tabular-nums'],
          color: tokens.colors.text.primary,
        },
        validationDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: tokens.colors.border.divider,
        },
        validationWarningRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          paddingTop: 4,
        },
        validationWarningText: {
          ...journalCaptionStyle,
          flex: 1,
          width: undefined,
          color: tokens.colors.text.danger,
        },
        dateRow: {
          flexDirection: 'row-reverse',
          gap: JOURNAL_LAYOUT.stackGapSmall,
        },
        datePill: {
          flex: 1,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          ...formFieldShellStyle({ tokens, focused: false, multiline: false }),
          borderRadius: tokens.borderRadius.search,
          paddingHorizontal: 14,
          minHeight: 52,
          borderWidth: 0,
        },
        datePillText: {
          ...journalBodyTextStyle,
          color: tokens.colors.text.primary,
          flex: 1,
          width: undefined,
        },
        pickerModalOverlay: {
          flex: 1,
          backgroundColor: tokens.colors.background.overlay,
          justifyContent: 'flex-end',
        },
        pickerModalSheet: {
          backgroundColor: tokens.colors.background.cardSolid,
          borderTopLeftRadius: UI_CARD_RADIUS,
          borderTopRightRadius: UI_CARD_RADIUS,
          paddingTop: JOURNAL_LAYOUT.cardPadding,
          paddingHorizontal: PORTFOLIO_FORM.screenPadH,
          paddingBottom: 28,
          borderWidth: 0,
          overflow: 'hidden',
        },
        pickerModalTitle: {
          ...journalCardTitleStyle,
          width: undefined,
          marginTop: 0,
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: JOURNAL_LAYOUT.stackGapSmall,
        },
      }),
    [tokens]
  );

  const pickerTheme = tokens.colors.background.primary === LIGHT_CANVAS ? 'light' : 'dark';

  const headerTitle = isEdit
    ? 'עריכת עסקה'
    : mode === 'cash'
      ? 'מזומן'
      : mode === 'dividend'
        ? 'דיבידנד'
        : 'פוזיציה חדשה';

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title={headerTitle}
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
            {/* Asset / position — מצב ברירת מחדל; מזומן/דיבידנד מגיעים מ־initialMode בתפריט */}
            {mode === 'asset' && (
              <>
                {/* סוג הנכס מזוהה אוטומטית מהחיפוש (assetTypeFromSearchType) — בלי בחירה ידנית */}
                <View style={styles.fieldBlock}>
                  <FieldLabel label="סימבול" />
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
                      color={tokens.colors.text.secondary}
                    />
                    {symbol ? (
                      <Text style={styles.symbolText}>{symbol}</Text>
                    ) : (
                      <Text style={styles.symbolPlaceholder}>לדוגמה: AAPL</Text>
                    )}
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={tokens.colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldBlock}>
                  <FieldLabel label="סוג עסקה" />
                  <View style={styles.sideRow}>
                    <TouchableOpacity
                      style={[
                        styles.sideBtn,
                        direction === 'long'
                          ? styles.sideBtnLongSelected
                          : styles.sideBtnLongIdle,
                      ]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: direction === 'long' }}
                      accessibilityLabel="לונג"
                      onPress={() => {
                        if (direction !== 'long') void HapticFeedback.selection();
                        setDirection('long');
                        setSide('buy');
                      }}
                    >
                      <Text
                        style={[
                          styles.sideLabel,
                          direction === 'long'
                            ? styles.sideLabelOnFill
                            : styles.sideLabelIdle,
                        ]}
                      >
                        לונג
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sideBtn,
                        direction === 'short'
                          ? styles.sideBtnShortSelected
                          : styles.sideBtnShortIdle,
                      ]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: direction === 'short' }}
                      accessibilityLabel="שורט"
                      onPress={() => {
                        if (direction !== 'short') void HapticFeedback.selection();
                        setDirection('short');
                        setSide('sell');
                      }}
                    >
                      <Text
                        style={[
                          styles.sideLabel,
                          direction === 'short'
                            ? styles.sideLabelOnFill
                            : styles.sideLabelIdle,
                        ]}
                      >
                        שורט
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TextField
                  label={assetType === 'futures' ? 'מספר חוזים' : 'כמות'}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  numeric
                  placeholder={assetType === 'futures' ? '1' : '10'}
                  spacing={PORTFOLIO_FORM.fieldSpacing}
                />
                <TextField
                  label="מחיר כניסה"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  numeric
                  placeholder="150.00"
                  spacing={PORTFOLIO_FORM.fieldSpacing}
                />

                <View style={styles.twoCol}>
                  <View style={styles.col}>
                    <TextField
                      label="סטופ"
                      optional
                      value={stopLoss}
                      onChangeText={setStopLoss}
                      keyboardType="decimal-pad"
                      numeric
                      placeholder="145.00"
                      spacing={0}
                    />
                  </View>
                  <View style={styles.col}>
                    <TextField
                      label="יעד"
                      optional
                      value={targetPrice}
                      onChangeText={setTargetPrice}
                      keyboardType="decimal-pad"
                      numeric
                      placeholder="165.00"
                      spacing={0}
                    />
                  </View>
                </View>
              </>
            )}

            {mode === 'cash' && (
              <>
                <View>
                  <FieldLabel label="סוג טרנזקציה" />
                  <View style={styles.chipsWrap}>
                    {(['deposit', 'withdrawal', 'fee'] as CashTransactionType[]).map((t) => (
                      <DayDividerPill
                        key={t}
                        selected={cashSide === t}
                        haptic={cashSide !== t}
                        style={styles.filterChipGrow}
                        contentContainerStyle={styles.filterChipPad}
                        accessibilityLabel={TRANSACTION_LABELS[t]}
                        onPress={() => {
                          if (cashSide !== t) setCashSide(t);
                        }}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            cashSide === t && styles.chipLabelSelected,
                          ]}
                        >
                          {TRANSACTION_LABELS[t]}
                        </Text>
                      </DayDividerPill>
                    ))}
                  </View>
                </View>
                <TextField
                  label="סכום"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  numeric
                  placeholder="0.00"
                  spacing={PORTFOLIO_FORM.fieldSpacing}
                />
              </>
            )}

            {mode === 'dividend' && (
              <>
                <View style={styles.fieldBlock}>
                  <FieldLabel label="סימבול" />
                  <TouchableOpacity
                    style={styles.symbolPicker}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setSearchOpen(true);
                    }}
                  >
                    <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
                    {symbol ? (
                      <Text style={styles.symbolText}>{symbol}</Text>
                    ) : (
                      <Text style={styles.symbolPlaceholder}>בחר סימבול</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TextField
                  label="סך הדיבידנד שהתקבל"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  numeric
                  placeholder="0.00"
                  spacing={PORTFOLIO_FORM.fieldSpacing}
                />
              </>
            )}

            {/* Cash Validation Bar */}
            {cashValidation && (
              <UICard
                variant="soft"
                padding="md"
                disableBlur
                style={styles.validationCard}
                contentContainerStyle={styles.validationInner}
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
                  <Text style={[styles.validationLabel, { color: tokens.colors.text.primary }]}>
                    לאחר עסקה
                  </Text>
                  <Text style={[
                    styles.validationValue,
                    { color: cashValidation.ok ? tokens.colors.primary.main : tokens.colors.text.danger }
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
              </UICard>
            )}

            {/* Common: Date + Time */}
            <View style={styles.fieldBlock}>
              <FieldLabel label={mode === 'asset' ? 'תאריך ושעת כניסה' : 'תאריך ושעה'} />
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.datePill}
                  activeOpacity={0.8}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={tokens.colors.text.secondary} />
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
                  <Ionicons name="time-outline" size={18} color={tokens.colors.text.secondary} />
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
                        themeVariant={pickerTheme}
                        onChange={(_, d) => { if (d) setTradeDate(d); }}
                        style={{ alignSelf: 'stretch' }}
                      />
                      <UIButton
                        title="אישור"
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={() => setShowDatePicker(false)}
                        style={{ marginTop: 12 }}
                      />
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
                        themeVariant={pickerTheme}
                        is24Hour
                        onChange={(_, d) => { if (d) setTradeDate(d); }}
                        style={{ alignSelf: 'stretch' }}
                      />
                      <UIButton
                        title="אישור"
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={() => setShowTimePicker(false)}
                        style={{ marginTop: 12 }}
                      />
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
                  <View style={styles.col}>
                    <TextField
                      label="עמלה"
                      optional
                      value={commission}
                      onChangeText={setCommission}
                      keyboardType="decimal-pad"
                      numeric
                      placeholder="0.00"
                      spacing={0}
                    />
                  </View>
                  <View style={styles.col}>
                    <TextField
                      label="מינוף"
                      value={leverage}
                      onChangeText={setLeverage}
                      keyboardType="decimal-pad"
                      numeric
                      placeholder="1"
                      spacing={0}
                    />
                  </View>
                </View>
                {assetType === 'futures' ? (
                  <TextField
                    label="ערך לנקודה"
                    value={pointValue}
                    onChangeText={setPointValue}
                    keyboardType="decimal-pad"
                    numeric
                    placeholder="לדוגמה: 50 ל-ES, 20 ל-NQ"
                    spacing={0}
                  />
                ) : null}
              </View>
            ) : null}

            <TextField
              label="הערות"
              optional
              value={notes}
              onChangeText={setNotes}
              placeholder="הוסף הערות על העסקה"
              multiline
              maxLength={128}
              spacing={8}
            />
          </ScrollView>
          <PortfolioFormFooter
            title={submitting ? 'שומר…' : isEdit ? 'עדכן עסקה' : 'הוסף עסקה'}
            icon="checkmark"
            loading={submitting}
            disabled={submitting}
            onPress={() => {
              void HapticFeedback.medium();
              void handleSubmit();
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SymbolSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(r) => {
          // סוג הנכס מזוהה מהחיפוש (ETF/קריפטו/מניה); חוזים/פורקס נשארים בחירה ידנית
          if (r.type) setAssetType(assetTypeFromSearchType(r.type));
          void handlePickSymbol(r.symbol);
        }}
      />
    </View>
  );
}
