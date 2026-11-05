import i18n from '../../../lib/i18n';
import { TEXT_DIR } from '../../../lib/i18n/language';
import { appLocale } from '../../../lib/i18n/locale';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Dimensions } from 'react-native';
import { legacyAlert } from '../../../utils/appDialog';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Gift, Pencil, RefreshCw, RotateCcw, Trash2, Wallet } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import BottomSheet, {
  useBottomSheetClose,
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  resolveFitContentSnapPoint,
} from '../../../components/ui/BottomSheet/BottomSheet';
import {
  DayNavBlurButton,
  DAY_NAV_BUTTON_SIZE,
  headerExitButtonFill,
} from '../../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  APP_TYPE,
  appPhysicalRightText,
  appSheetSubtitleStyle,
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
const SCREEN_HEIGHT = Dimensions.get('window').height;

/** גובה התפריט האחרון שנמדד (לפי סוג תיק) — הפתיחה הבאה עולה ישר בגובה הנכון */
const lastMenuHeight: Record<'manual' | 'colmex', number> = { manual: 0, colmex: 0 };

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
  onContentHeight: (h: number) => void;
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
  onContentHeight,
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
    legacyAlert(
      i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s1'),
      isColmex
        ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s2')
        : i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s3'),
      [
        { text: i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s4'), style: 'cancel' },
        {
          text: i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s5'),
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
              legacyAlert(i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s6'), i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s7'));
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
      legacyAlert(i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s6'), i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s8'));
    } finally {
      setDeleting(false);
    }
  }, [navigation, onRequestClose, portfolioId, setDeleting]);

  const sheetTitle =
    phase === 'confirmDelete'
      ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s9')
      : renaming
        ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s10')
        : portfolioName?.trim() || i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s11');

  const sheetSubtitle =
    phase === 'confirmDelete'
      ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s12')
      : renaming
        ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s13')
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
        /** כמו שאר השיטים: חזרה מימין, כותרת ממורכזת, ריווח שמאלי */
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: APP_LAYOUT.cardTitleToBodyGap,
        },
        headerCenter: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerSideSpacer: {
          width: DAY_NAV_BUTTON_SIZE,
          height: DAY_NAV_BUTTON_SIZE,
        },
        title: {
          fontSize: APP_TYPE.sectionTitle.fontSize,
          fontWeight: APP_TYPE.sectionTitle.fontWeight,
          lineHeight: APP_TYPE.sectionTitle.lineHeight,
          letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
          color: tokens.colors.text.primary,
          direction: 'ltr',
          textAlign: 'center',
          writingDirection: TEXT_DIR,
          width: '100%',
        },
        subtitle: {
          ...appSheetSubtitleStyle,
          textAlign: 'center',
          marginBottom: APP_LAYOUT.cardTitleToBodyGap,
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
      legacyAlert(i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s14'), i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s15'));
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
      legacyAlert(i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s6'), i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s16'));
    } finally {
      setRenameBusy(false);
    }
  }, [nameDraft, portfolio.name, portfolioId, onPortfolioUpdated]);

  // שורות פעולה — בלי שברון (פעולה, לא ניווט)
  const noChevron = <View />;

  return (
    <View style={styles.root} onLayout={(e) => onContentHeight(e.nativeEvent.layout.height)}>
      <View style={styles.header}>
        <DayNavBlurButton
          onPress={handleHeaderBack}
          size={DAY_NAV_BUTTON_SIZE}
          glass={false}
          style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
          accessibilityLabel={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s17')}
        >
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
        </DayNavBlurButton>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {sheetTitle}
          </Text>
        </View>
        <View style={styles.headerSideSpacer} />
      </View>
      {sheetSubtitle ? <Text style={styles.subtitle}>{sheetSubtitle}</Text> : null}

      {phase === 'confirmDelete' ? (
        <View style={styles.buttons}>
          <UIButton
            title={deleting ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s18') : i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s19')}
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
            title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s4')}
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
              placeholder={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s20')}
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
              title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s21')}
              variant="primary"
              fullWidth
              loading={renameBusy}
              disabled={renameBusy}
              onPress={() => void onSaveName()}
            />
            <UIButton
              title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s4')}
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
              title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s22')}
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
                title={isSyncing ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s23') : i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s24')}
                subtitle={
                  lastSyncAt
                    ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s25', { v0: lastSyncAt.toLocaleString(appLocale()) })
                    : i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s26')
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
                  title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s27')}
                  icon={FileText}
                  trailing={noChevron}
                  onPress={goImport}
                />
                <SettingsActionRow
                  title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s28')}
                  icon={Wallet}
                  trailing={noChevron}
                  onPress={goAddCash}
                />
                <SettingsActionRow
                  title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s29')}
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
              title={resetting ? i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s30') : i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s1')}
              icon={RotateCcw}
              danger
              trailing={noChevron}
              onPress={() => {
                if (resetting || deleting) return;
                handleReset();
              }}
            />
            <SettingsActionRow
              title={i18n.t('auto.screens__Portfolios__components__PortfolioActionsBottomSheet.s19')}
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
  const variant = portfolio.source === 'colmex_pro' ? 'colmex' : 'manual';
  const [contentH, setContentH] = useState<number>(lastMenuHeight[variant]);

  const handleContentHeight = useCallback(
    (h: number) => {
      if (!(h > 0)) return;
      if (phase === 'menu') lastMenuHeight[variant] = h;
      setContentH((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    },
    [phase, variant],
  );

  const snapPoints = useMemo(
    () => [
      resolveFitContentSnapPoint({
        contentHeight: contentH,
        screenHeight: SCREEN_HEIGHT,
        handlePx: BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
        initialEstimate: 0.55,
        maxSnap: 0.9,
      }),
    ],
    [contentH],
  );

  useEffect(() => {
    if (visible) {
      setPhase('menu');
    }
  }, [visible]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={snapPoints}
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
        onContentHeight={handleContentHeight}
      />
    </BottomSheet>
  );
}
