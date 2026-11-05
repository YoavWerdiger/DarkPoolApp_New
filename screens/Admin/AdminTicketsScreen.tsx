import i18n from '../../lib/i18n';
import { appLocale } from '../../lib/i18n/locale';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { AdminEmptyState, AdminFilterChip } from '../../components/admin';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  adminCaption,
  adminCardSubtitle,
  adminCardTitle,
  adminHebrewText,
} from '../../components/admin/adminType';
import { adminService, type AdminTicketRow } from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const STATUS_LABEL: Record<string, string> = {
  new: i18n.t('auto.screens__Admin__AdminTicketsScreen.s1'),
  in_progress: i18n.t('auto.screens__Admin__AdminTicketsScreen.s2'),
  closed: i18n.t('auto.screens__Admin__AdminTicketsScreen.s3'),
};

export default function AdminTicketsScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listTickets({ status: filter, pageSize: 50 });
      setTickets(res.tickets);
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminTicketsScreen.s4'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminTicketsScreen.s5'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycleStatus = (ticket: AdminTicketRow) => {
    const order = ['new', 'in_progress', 'closed'] as const;
    const next = order[(order.indexOf(ticket.status) + 1) % order.length];
    legacyAlert(i18n.t('auto.screens__Admin__AdminTicketsScreen.s6'), i18n.t('auto.screens__Admin__AdminTicketsScreen.s7', { v0: STATUS_LABEL[next] }), [
      { text: i18n.t('auto.screens__Admin__AdminTicketsScreen.s8'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminTicketsScreen.s9'),
        onPress: async () => {
          try {
            await adminService.updateTicket(ticket.id, { status: next });
            void HapticFeedback.success();
            await load();
          } catch (e) {
            legacyAlert(i18n.t('auto.screens__Admin__AdminTicketsScreen.s4'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminTicketsScreen.s10'));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={i18n.t('auto.screens__Admin__AdminTicketsScreen.s11')} onBack={() => navigation.goBack()} />
      <View style={styles.filters}>
        {[
          { key: undefined, label: i18n.t('auto.screens__Admin__AdminTicketsScreen.s12') },
          { key: 'new', label: i18n.t('auto.screens__Admin__AdminTicketsScreen.s1') },
          { key: 'in_progress', label: i18n.t('auto.screens__Admin__AdminTicketsScreen.s2') },
          { key: 'closed', label: i18n.t('auto.screens__Admin__AdminTicketsScreen.s3') },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <AdminFilterChip
              key={String(f.key)}
              label={f.label}
              active={active}
              onPress={() => setFilter(f.key)}
            />
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingBottom: 40,
          }}
          ListEmptyComponent={
            <AdminEmptyState title={i18n.t('auto.screens__Admin__AdminTicketsScreen.s13')} subtitle={i18n.t('auto.screens__Admin__AdminTicketsScreen.s14')} />
          }
          renderItem={({ item }) => {
            const name =
              item.users?.display_name ||
              item.users?.full_name ||
              item.users?.email ||
              i18n.t('auto.screens__Admin__AdminTicketsScreen.s15');
            return (
              <TouchableOpacity onPress={() => cycleStatus(item)} activeOpacity={0.8}>
                <UICard
                  variant="soft"
                  padding="md"
                  style={{ marginBottom: APP_LAYOUT.cardStackGap }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.subject, { color: tokens.colors.text.primary }]}>
                      {item.subject}
                    </Text>
                    <Text style={[styles.status, { color: tokens.colors.primary.main }]}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                  <Text
                    style={[styles.body, { color: tokens.colors.text.secondary }]}
                    numberOfLines={3}
                  >
                    {item.body}
                  </Text>
                  <Text style={[styles.meta, { color: tokens.colors.text.tertiary }]}>
                    {name} · {new Date(item.created_at).toLocaleDateString(appLocale())}
                  </Text>
                </UICard>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: APP_LAYOUT.stackGapSmall,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingBottom: APP_LAYOUT.stackGapSmall,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  subject: {
    ...adminHebrewText,
    ...adminCardTitle,
    flex: 1,
  },
  status: {
    ...adminCaption,
  },
  body: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  meta: {
    ...adminHebrewText,
    ...adminCaption,
  },
});
