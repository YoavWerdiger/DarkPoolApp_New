import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Gift, Pencil, RefreshCw, RotateCcw, Trash2, Wallet } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import BottomSheet, {
  useBottomSheetClose,
} from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  appPhysicalRightText,
  appSheetSubtitleStyle,
  appSheetTitleStyle,
} from '../../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import UIButton from '../../../components/ui/UIButton';
import { SettingsActionRow, SettingsGlassCard } from '../../../components/profile/ProfileSettingsUI';
import { HapticFeedback } from '../../../utils/hapticFeedback';
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
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const [nameFocused, setNameFocused] = useState(false);
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
        ? 'שינוי שם'
        : portfolioName?.trim() || 'פעולות תיק';

  const sheetSubtitle =
    phase === 'confirmDelete'
      ? 'התיק יועבר לארכיון וייעלם מהרשימה. לא ניתן לבטל מהאפליקציה.'
      : renaming
        ? 'השם שיוצג לך ולקהילה'
        : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          direction: 'rtl',
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        header: {
          marginBottom: APP_LAYOUT.cardTitleToBodyGap,
        },
        title: {
          ...appSheetTitleStyle,
          color: tokens.colors.text.primary,
        },
        subtitle: {
          ...appSheetSubtitleStyle,
          marginTop: APP_LAYOUT.titleSubtitleGap,
          color: tokens.colors.text.secondary,
        },
        fieldShell: {
          ...formFieldShellStyle({ tokens, focused: nameFocused }),
          borderRadius: tokens.borderRadius.md,
          paddingHorizontal: APP_LAYOUT.cardPadding,
        },
        fieldInput: {
          ...formFieldInputStyle(tokens),
          ...appPhysicalRightText,
          alignSelf: 'stretch',
          minHeight: 48,
          color: tokens.colors.text.primary,
        },
        buttons: {
          gap: APP_LAYOUT.stackGapSmall,
          marginTop: APP_LAYOUT.cardTitleToBodyGap,
        },
      }),
    [tokens, insets.bottom, nameFocused],
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

  // שורות פעולה — בלי שברון (פעולה, לא ניווט)
  const noChevron = <View />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {sheetTitle}
        </Text>
        {sheetSubtitle ? <Text style={styles.subtitle}>{sheetSubtitle}</Text> : null}
      </View>

      {phase === 'confirmDelete' ? (
        <View style={styles.buttons}>
          <UIButton
            title={deleting ? 'מוחק…' : 'מחק תיק'}
            variant="danger"
            fullWidth
            loading={deleting}
            disabled={deleting}
            onPress={() => {
              void HapticFeedback.heavy();
              void onArchive();
            }}
          />
          <UIButton
            title="ביטול"
            variant="secondary"
            fullWidth
            disabled={deleting}
            onPress={() => setPhase('menu')}
          />
        </View>
      ) : renaming ? (
        <>
          <View style={styles.fieldShell}>
            <TextInput
              style={styles.fieldInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="שם התיק"
              placeholderTextColor={formFieldPlaceholderColor(tokens)}
              maxLength={128}
              editable={!renameBusy}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void onSaveName()}
            />
          </View>
          <View style={styles.buttons}>
            <UIButton
              title="שמור"
              variant="primary"
              fullWidth
              loading={renameBusy}
              disabled={renameBusy}
              onPress={() => void onSaveName()}
            />
            <UIButton
              title="ביטול"
              variant="secondary"
              fullWidth
              disabled={renameBusy}
              onPress={handleHeaderBack}
            />
          </View>
        </>
      ) : (
        <>
          <SettingsGlassCard>
            <SettingsActionRow
              title="שנה שם תיק"
              icon={Pencil}
              trailing={noChevron}
              onPress={() => {
                void HapticFeedback.impactLight();
                setNameDraft(portfolio.name ?? '');
                setRenaming(true);
              }}
            />
            {isColmex ? (
              <SettingsActionRow
                title={isSyncing ? 'מסנכרן…' : 'סנכרן עכשיו מ-Colmex'}
                subtitle={
                  lastSyncAt
                    ? `סנכרון אחרון: ${lastSyncAt.toLocaleString('he-IL')}`
                    : 'הנתונים מסונכרנים אוטומטית מהברוקר'
                }
                icon={RefreshCw}
                trailing={noChevron}
                showDivider={false}
                onPress={() => {
                  if (isSyncing || !onSyncBroker) return;
                  void HapticFeedback.impactLight();
                  void onSyncBroker();
                }}
              />
            ) : (
              <>
                <SettingsActionRow
                  title="ייבוא טרנזקציות מ־CSV"
                  icon={FileText}
                  trailing={noChevron}
                  onPress={goImport}
                />
                <SettingsActionRow
                  title="מזומן"
                  icon={Wallet}
                  trailing={noChevron}
                  onPress={goAddCash}
                />
                <SettingsActionRow
                  title="דיבידנד"
                  icon={Gift}
                  trailing={noChevron}
                  showDivider={false}
                  onPress={goAddDividend}
                />
              </>
            )}
          </SettingsGlassCard>

          <SettingsGlassCard style={{ marginBottom: 0 }}>
            <SettingsActionRow
              title={resetting ? 'מאפס…' : 'אפס תיק'}
              icon={RotateCcw}
              danger
              trailing={noChevron}
              onPress={() => {
                if (resetting || deleting) return;
                handleReset();
              }}
            />
            <SettingsActionRow
              title="מחק תיק"
              icon={Trash2}
              danger
              trailing={noChevron}
              showDivider={false}
              onPress={() => {
                void HapticFeedback.warning();
                setPhase('confirmDelete');
              }}
            />
          </SettingsGlassCard>
        </>
      )}
    </View>
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
  const tokens = useDesignTokens();
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
      snapPoints={[0.9]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard
      contentPaddingBottom={0}
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
