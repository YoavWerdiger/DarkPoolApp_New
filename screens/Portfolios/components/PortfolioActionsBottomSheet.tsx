import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { PortfolioScreenHeader } from './PortfolioScreenHeader';
import type { PortfoliosStackParamList } from '../../../navigation/PortfoliosStack';
import { archivePortfolio, updatePortfolio } from '../../../services/portfolios';
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
}: BodyProps) {
  const tokens = useDesignTokens();
  const animatedClose = useBottomSheetClose();
  const [shareBusy, setShareBusy] = useState(false);

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
    if (phase === 'confirmDelete') {
      setPhase('menu');
      return;
    }
    if (animatedClose) animatedClose();
    else onRequestClose();
  }, [phase, animatedClose, onRequestClose, setPhase]);

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
      : portfolioName?.trim() || 'פעולות תיק';

  const sheetSubtitle =
    phase === 'confirmDelete'
      ? 'האם למחוק לצמיתות?'
      : 'בחר פעולה לתיק';

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
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        actionBtnText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        actionBtnDanger: {
          borderColor: 'rgba(239,68,68,0.4)',
          backgroundColor: 'rgba(239,68,68,0.1)',
        },
        actionBtnDangerText: {
          color: tokens.colors.text.danger,
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
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.07)',
        },
        pillDanger: {
          borderColor: tokens.colors.text.danger,
          backgroundColor: 'rgba(239,68,68,0.14)',
        },
        pillTextCancel: {
          fontSize: 15,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        pillTextDanger: {
          fontSize: 15,
          fontWeight: '800',
          color: tokens.colors.text.danger,
        },
        shareBlock: {
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.05)',
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
      }),
    [tokens]
  );

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
        {phase === 'menu' ? (
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
        ) : (
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
}

export default function PortfolioActionsBottomSheet({
  visible,
  onClose,
  portfolioId,
  portfolio,
  portfolioName,
  navigation,
  onPortfolioUpdated,
}: Props) {
  const [phase, setPhase] = useState<Phase>('menu');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) setPhase('menu');
  }, [visible]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.58]}
      showHandle={false}
      topCornerRadius={28}
      enablePanDownToClose
      useModal
      backdropOpacity={0.45}
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
      />
    </BottomSheet>
  );
}
