import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
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
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: { padding: 16, paddingBottom: 80 },
        sectionHint: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 14,
          lineHeight: 18,
        },
        emptyCard: {
          padding: 24,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.subtle,
          alignItems: 'center',
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          writingDirection: 'rtl',
          marginTop: 10,
          lineHeight: 19,
        },
        accountCard: {
          padding: 16,
          borderRadius: 24,
          borderWidth: 1.5,
          marginBottom: 12,
          overflow: 'hidden',
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
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
          fontSize: 15,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        accountMeta: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginTop: 2,
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
        submitArea: {
          paddingTop: 8,
          paddingBottom: 0,
        },
        submit: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingVertical: 16,
          borderRadius: 32,
          ...tokens.shadows.md,
        },
        submitText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
      }),
    [tokens]
  );

  const renderAccountCard = (acc: BrokerAccount) => {
    const active = selectedId === acc.id;
    const alreadyLinked = !!acc.portfolio_id;
    return (
      <TouchableOpacity
        key={acc.id}
        activeOpacity={alreadyLinked ? 1 : 0.85}
        disabled={alreadyLinked || linkingId !== null}
        onPress={() => {
          if (selectedId !== acc.id) void HapticFeedback.selection();
          setSelectedId(acc.id);
        }}
        style={[
          styles.accountCard,
          {
            borderColor: active
              ? tokens.colors.primary.main
              : tokens.colors.border.subtle,
            backgroundColor: active
              ? 'rgba(0, 200, 5, 0.08)'
              : 'rgba(255,255,255,0.04)',
            opacity: alreadyLinked ? 0.55 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.accountIcon,
            {
              backgroundColor: active
                ? 'rgba(0, 200, 5, 0.20)'
                : 'rgba(255,255,255,0.07)',
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
      </TouchableOpacity>
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
            <View style={styles.emptyCard}>
              <Ionicons name="alert-circle" size={32} color={tokens.colors.text.tertiary} />
              <Text style={styles.emptyText}>
                לא נמצאו חשבונות trading פעילים בחשבון Colmex Pro שלך.
              </Text>
            </View>
          ) : (
            accounts.map(renderAccountCard)
          )}

          {selectedId && !accounts.find((a) => a.id === selectedId)?.portfolio_id ? (
            <View style={styles.submitArea}>
              <TouchableOpacity
                style={[styles.submit, linkingId !== null && { opacity: 0.7 }]}
                onPress={() => {
                  void HapticFeedback.medium();
                  const acc = accounts.find((a) => a.id === selectedId);
                  if (acc) void handleLink(acc);
                }}
                disabled={linkingId !== null}
                activeOpacity={0.88}
              >
                {linkingId !== null ? (
                  <ActivityIndicator color={tokens.colors.text.inverse} />
                ) : (
                  <Ionicons name="checkmark" size={22} color={tokens.colors.text.inverse} />
                )}
                <Text style={styles.submitText}>
                  {linkingId !== null ? 'יוצר תיק…' : 'צור תיק מסונכרן'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
