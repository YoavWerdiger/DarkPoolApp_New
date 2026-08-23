import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import BottomSheet, {
  useBottomSheetClose,
} from '../../../components/ui/BottomSheet/BottomSheet';
import { sheetActionColors } from '../../../components/ui/BottomSheet/sheetGlass';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { PortfolioScreenHeader } from './PortfolioScreenHeader';
import type { PortfoliosStackParamList } from '../../../navigation/PortfoliosStack';
import { archivePortfolio, updatePortfolio } from '../../../services/portfolios';
import { resetPortfolio } from '../../../services/portfolios/portfolioTradeDerive';
import { clearHistoricalSeriesCache } from '../../../services/portfolios/portfolioService';
import type { Portfolio } from '../portfolioTypes';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfolioDetail'>;

type Phase = 'menu' | 'confirmDelete';

const NAV_AFTER_CLOSE_MS = 280;

interface BodyProps {
  portfolioId: string;
  portfolio: Portfolio;
  portfolioName?: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
  navigation: Nav;
  onRequestClose: () => void;
  onPortfolioUpdated?: () => void;
  /** סנכרון ידני לתיק Colmex — מוצג בתפריט במקום טאב ברוקר */
  onSyncBroker?: () => Promise<void> | void;
  lastSyncAt?: Date | null;
  isSyncing?: boolean;
}

function PortfolioActionsSheetBody({
  portfolioId,
  portfolio,
  portfolioName,
  phase,
  setPhase,
  deleting,
  setDeleting,
  navigation,
  onRequestClose,
  onPortfolioUpdated,
  onSyncBroker,
  lastSyncAt,
  isSyncing,
}: BodyProps) {
  const tokens = useDesignTokens();
  const animatedClose = useBottomSheetClose();
  const [shareBusy, setShareBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState(portfolio.name ?? '');
  const isColmex = portfolio.source === 'colmex_pro';

  useEffect(() => {
    setNameDraft(portfolio.name ?? '');
    setRenaming(false);
  }, [portfolio.name]);

  const closeThen = useCallback(
    (fn: () => void) => {
      const run = () => setTimeout(fn, NAV_AFTER_CLOSE_MS);
      if (animatedClose) {
        animatedClose();
        run();
      } else {
        onRequestClose();
        run();
      }
    },
    [animatedClose, onRequestClose]
  );

  const handleHeaderBack = useCallback(() => {
    if (renaming) {
      setRenaming(false);
      setNameDraft(portfolio.name ?? '');
      return;
    }
    if (phase === 'confirmDelete') {
      setPhase('menu');
      return;
    }
    if (animatedClose) animatedClose();
    else onRequestClose();
  }, [renaming, phase, animatedClose, onRequestClose, setPhase, portfolio.name]);

  const goImport = useCallback(() => {
    closeThen(() => navigation.navigate('ImportTransactions', { portfolioId }));
  }, [closeThen, navigation, portfolioId]);

  const goAddCash = useCallback(() => {
    closeThen(() =>
      navigation.navigate('AddTransaction', {
        portfolioId,
        initialMode: 'cash',
      })
    );
  }, [closeThen, navigation, portfolioId]);

  const goAddDividend = useCallback(() => {
    closeThen(() =>
      navigation.navigate('AddTransaction', {
        portfolioId,
        initialMode: 'dividend',
      })
    );
  }, [closeThen, navigation, portfolioId]);

  const handleReset = useCallback(() => {
    void HapticFeedback.warning();
    const isColmex = portfolio.source === 'colmex_pro';
    Alert.alert(
      'אפס תיק',
      isColmex
        ? 'פעולה זו תמחק את כל הטריידים, הטרנזקציות, ה-snapshots והפוזיציות המקומיות מהברוקר, ותאפס את יתרת המזומן. סנכרון הבא מ-Colmex ימלא מחדש מהחשבון. לא ניתן לבטל.'
        : 'פעולה זו תמחק את כל הטריידים, הטרנזקציות וה-snapshots, ותאפס את יתרת המזומן ל־0. לא ניתן לבטל.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await resetPortfolio(portfolioId);
              clearHistoricalSeriesCache(portfolioId);
              onPortfolioUpdated?.();
              onRequestClose();
            } catch (err) {
              console.error('reset portfolio:', err);
              Alert.alert('שגיאה', 'האיפוס נכשל. נסה שוב.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [portfolioId, portfolio.source, onPortfolioUpdated, onRequestClose]);

  const onArchive = useCallback(async () => {
    try {
      setDeleting(true);
      await archivePortfolio(portfolioId);
      onRequestClose();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'PortfoliosHub' }],
        })
      );
    } catch (e) {
      console.error('archive portfolio:', e);
      Alert.alert('שגיאה', 'לא הצלחנו למחוק את התיק. נסה שוב.');
    } finally {
      setDeleting(false);
    }
  }, [navigation, onRequestClose, portfolioId, setDeleting]);

  const sheetTitle =
    phase === 'confirmDelete'
      ? 'מחיקת תיק'
      : renaming
        ? 'שנה שם תיק'
        : portfolioName?.trim() || 'פעולות תיק';

  const sheetSubtitle =
    phase === 'confirmDelete'
      ? 'האם למחוק לצמיתות?'
      : renaming
        ? 'השם שיוצג לך ולקהילה'
        : 'בחר פעולה לתיק';

  const actionColors = useMemo(() => sheetActionColors(tokens), [tokens]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: 'transparent' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          padding: 16,
          paddingBottom: 80,
        },
        actionBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 10,
          borderRadius: 28,
          borderWidth: actionColors.secondary.borderWidth,
          borderColor: actionColors.secondary.borderColor,
          backgroundColor: actionColors.secondary.backgroundColor,
        },
        actionBtnText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '700',
          color: actionColors.secondary.color,
          textAlign: 'right',
        },
        actionBtnDanger: {
          borderColor: actionColors.destructive.borderColor,
          backgroundColor: actionColors.destructive.backgroundColor,
        },
        actionBtnDangerText: {
          color: actionColors.destructive.color,
        },
        confirmText: {
          fontSize: 14,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          lineHeight: 21,
          marginBottom: 16,
        },
        actionsRow: {
          flexDirection: 'row-reverse',
          gap: 10,
        },
        pill: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 32,
          alignItems: 'center',
          borderWidth: 1.5,
        },
        pillCancel: {
          borderColor: actionColors.cancel.borderColor,
          backgroundColor: actionColors.cancel.backgroundColor,
        },
        pillDanger: {
          borderColor: actionColors.destructive.borderColor,
          backgroundColor: actionColors.destructive.backgroundColor,
        },
        pillTextCancel: {
          fontSize: 15,
          fontWeight: '800',
          color: actionColors.cancel.color,
        },
        pillTextDanger: {
          fontSize: 15,
          fontWeight: '800',
          color: actionColors.destructive.color,
        },
        shareBlock: {
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: actionColors.secondary.backgroundColor,
        },
        shareRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        shareTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        shareHint: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          marginTop: 4,
          lineHeight: 16,
        },
        brokerRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
        },
        brokerLogoWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        brokerLogo: { width: 36, height: 36 },
        renameRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          marginTop: 10,
        },
        renameInput: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: actionColors.secondary.backgroundColor,
          color: tokens.colors.text.primary,
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        renameCheckBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: actionColors.primary.backgroundColor,
          borderWidth: 1.5,
          borderColor: actionColors.primary.borderColor,
        },
      }),
    [tokens, actionColors],
  );

  const onSaveName = useCallback(async () => {
    const next = nameDraft.trim().slice(0, 128);
    if (!next) {
      Alert.alert('שם לא תקין', 'יש להזין שם לתיק.');
      return;
    }
    if (next === (portfolio.name ?? '')) {
      setRenaming(false);
      return;
    }
    try {
      setRenameBusy(true);
      await updatePortfolio(portfolioId, { name: next });
      setRenaming(false);
      onPortfolioUpdated?.();
    } catch (e) {
      console.error('rename portfolio:', e);
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן את שם התיק.');
    } finally {
      setRenameBusy(false);
    }
  }, [nameDraft, portfolio.name, portfolioId, onPortfolioUpdated]);

  const onTogglePublic = useCallback(
    async (next: boolean) => {
      try {
        setShareBusy(true);
        await updatePortfolio(portfolioId, { is_public: next });
        onPortfolioUpdated?.();
      } catch (e) {
        console.error('update portfolio public:', e);
        Alert.alert('שגיאה', 'לא הצלחנו לעדכן את הגדרת השיתוף.');
      } finally {
        setShareBusy(false);
      }
    },
    [portfolioId, onPortfolioUpdated]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <PortfolioScreenHeader
        title={sheetTitle}
        subtitle={sheetSubtitle}
        onBack={handleHeaderBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'confirmDelete' ? (
          <>
            <Text style={styles.confirmText}>
              התיק יועבר לארכיון וייעלם מהרשימה. כל הטרנזקציות לא יוצגו עוד. לא ניתן לבטל
              מהאפליקציה.
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.pill, styles.pillCancel]}
                onPress={() => {
                  void HapticFeedback.selection();
                  setPhase('menu');
                }}
                disabled={deleting}
                activeOpacity={0.88}
              >
                <Text style={styles.pillTextCancel}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, styles.pillDanger]}
                onPress={() => {
                  void HapticFeedback.heavy();
                  void onArchive();
                }}
                disabled={deleting}
                activeOpacity={0.88}
              >
                <Text style={styles.pillTextDanger}>
                  {deleting ? 'מוחק…' : 'מחק'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : renaming ? (
          <View style={styles.shareBlock}>
            <Text style={styles.shareTitle}>שם התיק</Text>
            <Text style={styles.shareHint}>
              השם שיוצג לך ולמשתמשים אחרים אם התיק משותף עם הקהילה.
            </Text>
            <View style={styles.renameRow}>
              <TextInput
                style={styles.renameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="שם התיק"
                placeholderTextColor={tokens.colors.text.tertiary}
                maxLength={128}
                editable={!renameBusy}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void onSaveName()}
              />
              <TouchableOpacity
                style={[styles.renameCheckBtn, renameBusy && { opacity: 0.7 }]}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  void onSaveName();
                }}
                disabled={renameBusy}
                activeOpacity={0.88}
                accessibilityLabel="שמור שם תיק"
              >
                <Ionicons
                  name="checkmark"
                  size={22}
                  color={actionColors.primary.color}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.shareBlock}>
              <View style={styles.shareRow}>
                <Switch
                  value={portfolio.is_public === true}
                  onValueChange={(v) => void onTogglePublic(v)}
                  disabled={shareBusy || deleting}
                  trackColor={{
                    false: 'rgba(255,255,255,0.2)',
                    true: `${tokens.colors.primary.main}88`,
                  }}
                  thumbColor={
                    portfolio.is_public === true
                      ? tokens.colors.primary.main
                      : tokens.colors.text.tertiary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareTitle}>שיתוף עם הקהילה</Text>
                  <Text style={styles.shareHint}>
                    כשפעיל — משתמשים מאומתים אחרים רואים את התיק בלשונית «מהקהילה» (צפייה
                    בלבד, בלי עריכה).
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                void HapticFeedback.impactLight();
                setNameDraft(portfolio.name ?? '');
                setRenaming(true);
              }}
              disabled={deleting}
              activeOpacity={0.88}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={tokens.colors.text.primary}
              />
              <Text style={styles.actionBtnText}>שנה שם תיק</Text>
            </TouchableOpacity>
            {isColmex ? (
              <>
                <View style={styles.shareBlock}>
                  <View style={styles.brokerRow}>
                    <View style={styles.brokerLogoWrap}>
                      <Image
                        source={require('../../../assets/colmex-logo.png')}
                        style={styles.brokerLogo}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shareTitle}>מחובר ל-Colmex Pro</Text>
                      <Text style={styles.shareHint}>
                        {lastSyncAt
                          ? `סנכרון אחרון: ${lastSyncAt.toLocaleString('he-IL')}`
                          : 'הנתונים מסונכרנים אוטומטית מהברוקר'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    void onSyncBroker?.();
                  }}
                  disabled={isSyncing || !onSyncBroker}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="sync-outline"
                    size={22}
                    color={tokens.colors.primary.main}
                  />
                  <Text style={styles.actionBtnText}>
                    {isSyncing ? 'מסנכרן…' : 'סנכרן עכשיו מ-Colmex'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    goImport();
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={22}
                    color={tokens.colors.text.primary}
                  />
                  <Text style={styles.actionBtnText}>ייבוא טרנזקציות מ־CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    goAddCash();
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={22}
                    color={tokens.colors.primary.main}
                  />
                  <Text style={styles.actionBtnText}>הוסף הפקדה</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    goAddDividend();
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="gift-outline"
                    size={22}
                    color={tokens.colors.primary.main}
                  />
                  <Text style={styles.actionBtnText}>הוסף דיבידנד</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={handleReset}
              disabled={resetting || deleting}
              activeOpacity={0.88}
            >
              <Ionicons
                name="refresh-outline"
                size={22}
                color={tokens.colors.text.danger}
              />
              <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>
                {resetting ? 'מאפס…' : 'אפס תיק'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => {
                void HapticFeedback.warning();
                setPhase('confirmDelete');
              }}
              activeOpacity={0.88}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={tokens.colors.text.danger}
              />
              <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>
                מחק תיק
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  portfolioId: string;
  portfolio: Portfolio;
  portfolioName?: string;
  navigation: Nav;
  onPortfolioUpdated?: () => void;
  onSyncBroker?: () => Promise<void> | void;
  lastSyncAt?: Date | null;
  isSyncing?: boolean;
}

export default function PortfolioActionsBottomSheet({
  visible,
  onClose,
  portfolioId,
  portfolio,
  portfolioName,
  navigation,
  onPortfolioUpdated,
  onSyncBroker,
  lastSyncAt,
  isSyncing,
}: Props) {
  const [phase, setPhase] = useState<Phase>('menu');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhase('menu');
    }
  }, [visible]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.68]}
      showHandle={false}
      topCornerRadius={28}
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      useGlassBackground
      avoidKeyboard
    >
      <PortfolioActionsSheetBody
        portfolioId={portfolioId}
        portfolio={portfolio}
        portfolioName={portfolioName}
        phase={phase}
        setPhase={setPhase}
        deleting={deleting}
        setDeleting={setDeleting}
        navigation={navigation}
        onRequestClose={onClose}
        onPortfolioUpdated={onPortfolioUpdated}
        onSyncBroker={onSyncBroker}
        lastSyncAt={lastSyncAt}
        isSyncing={isSyncing}
      />
    </BottomSheet>
  );
}
