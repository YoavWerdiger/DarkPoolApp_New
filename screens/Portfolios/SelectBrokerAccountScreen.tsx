import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioFormFooter } from './components/PortfolioFormFooter';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import {
  JOURNAL_LAYOUT,
  journalCardBodyStyle,
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
  PORTFOLIO_FORM,
} from './portfolioLayout';
import {
  listBrokerAccounts,
  linkBrokerAccountToPortfolio,
} from '../../services/brokers';
import type { BrokerAccount } from '../../services/brokers';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'SelectBrokerAccount'>;
type RouteParams = RouteProp<PortfoliosStackParamList, 'SelectBrokerAccount'>;

export default function SelectBrokerAccountScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteParams>();
  const connectionId = params?.connectionId;

  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listBrokerAccounts(connectionId);
        if (!alive) return;
        setAccounts(list);
        if (list.length === 1) setSelectedId(list[0].id);
      } catch (e) {
        Alert.alert('שגיאה', (e as Error).message ?? 'לא הצלחנו לטעון את החשבונות');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [connectionId]);

  const handleLink = useCallback(
    async (acc: BrokerAccount) => {
      try {
        setLinkingId(acc.id);
        const res = await linkBrokerAccountToPortfolio({
          brokerAccountId: acc.id,
          triggerSync: true,
        });
        if (res.syncOk === false) {
          Alert.alert(
            'התיק נוצר',
            'הסנכרון המלא מול Colmex לא הושלם. פתח את התיק ומשוך לרענון, או חבר מחדש אם הנתונים חסרים.'
          );
        }
        navigation.replace('PortfolioDetail', { portfolioId: res.portfolioId });
      } catch (e) {
        Alert.alert('שגיאה', (e as Error).message ?? 'לא הצלחנו ליצור את התיק');
      } finally {
        setLinkingId(null);
      }
    },
    [navigation]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: 'transparent' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: {
          paddingHorizontal: PORTFOLIO_FORM.screenPadH,
          paddingTop: 4,
          paddingBottom: 80,
        },
        sectionHint: {
          ...journalCardBodyStyle,
          color: tokens.colors.text.secondary,
          marginBottom: JOURNAL_LAYOUT.sectionHeaderToContent,
        },
        emptyInner: {
          alignItems: 'center',
          paddingVertical: 8,
        },
        emptyText: {
          ...journalCardBodyStyle,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          marginTop: 10,
        },
        accountInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        accountIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
        },
        accountInfo: { flex: 1 },
        accountName: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.primary,
        },
        accountMeta: {
          ...journalCardSubtitleStyle,
          color: tokens.colors.text.secondary,
          marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
        },
        accountChips: {
          flexDirection: 'row-reverse',
          gap: 6,
          marginTop: 6,
        },
        chip: {
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.07)',
        },
        chipText: {
          ...journalPhysicalRightText,
          fontSize: 10,
          color: tokens.colors.text.secondary,
          fontWeight: '600',
        },
        linkedBadge: {
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(0, 200, 5, 0.15)',
        },
        linkedBadgeText: {
          fontSize: 10,
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
      }),
    [tokens]
  );

  const renderAccountCard = (acc: BrokerAccount) => {
    const active = selectedId === acc.id;
    const alreadyLinked = !!acc.portfolio_id;
    return (
      <UICard
        key={acc.id}
        variant="soft"
        padding="none"
        disableBlur
        onPress={
          alreadyLinked || linkingId !== null
            ? undefined
            : () => {
                if (selectedId !== acc.id) void HapticFeedback.selection();
                setSelectedId(acc.id);
              }
        }
        style={[
          { marginBottom: JOURNAL_LAYOUT.cardStackGap, opacity: alreadyLinked ? 0.55 : 1 },
          active && {
            borderWidth: 1,
            borderColor: `${tokens.colors.primary.main}44`,
            backgroundColor: tokens.colors.primary.subtle,
          },
        ]}
        contentContainerStyle={styles.accountInner}
      >
        <View
          style={[
            styles.accountIcon,
            {
              backgroundColor: active
                ? 'rgba(0, 200, 5, 0.20)'
                : tokens.colors.background.tertiary,
            },
          ]}
        >
          <Ionicons
            name={acc.account_type === 'demo' ? 'flask' : 'briefcase'}
            size={22}
            color={active ? tokens.colors.primary.main : tokens.colors.text.secondary}
          />
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{acc.account_name ?? acc.broker_account_id}</Text>
          <Text style={styles.accountMeta}>
            #{acc.broker_account_id} · {acc.currency}
          </Text>
          <View style={styles.accountChips}>
            {acc.account_type ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{acc.account_type.toUpperCase()}</Text>
              </View>
            ) : null}
            {acc.status ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{acc.status}</Text>
              </View>
            ) : null}
            {alreadyLinked ? (
              <View style={styles.linkedBadge}>
                <Text style={styles.linkedBadgeText}>כבר מקושר</Text>
              </View>
            ) : null}
          </View>
        </View>
        {!alreadyLinked ? (
          <Ionicons
            name={active ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={active ? tokens.colors.primary.main : tokens.colors.text.tertiary}
          />
        ) : null}
      </UICard>
    );
  };

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title="בחירת חשבון Colmex"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHint}>
            בחר את חשבון ה-Trading שתרצה לסנכרן. עבור כל חשבון נוצר תיק נפרד באפליקציה,
            וכל הנתונים (פוזיציות, פקודות, עסקאות, יתרה) יתעדכנו אוטומטית.
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : accounts.length === 0 ? (
            <UICard variant="soft" padding="md" disableBlur contentContainerStyle={styles.emptyInner}>
              <Ionicons name="alert-circle" size={32} color={tokens.colors.text.tertiary} />
              <Text style={styles.emptyText}>
                לא נמצאו חשבונות trading פעילים בחשבון Colmex Pro שלך.
              </Text>
            </UICard>
          ) : (
            accounts.map(renderAccountCard)
          )}

        </ScrollView>
        {selectedId && !accounts.find((a) => a.id === selectedId)?.portfolio_id ? (
          <PortfolioFormFooter
            title={linkingId !== null ? 'יוצר תיק…' : 'צור תיק מסונכרן'}
            icon="checkmark"
            loading={linkingId !== null}
            disabled={linkingId !== null}
            onPress={() => {
              const acc = accounts.find((a) => a.id === selectedId);
              if (acc) void handleLink(acc);
            }}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}
