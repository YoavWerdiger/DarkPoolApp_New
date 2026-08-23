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
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
import { adminService, type AdminTicketRow } from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const STATUS_LABEL: Record<string, string> = {
  new: 'חדש',
  in_progress: 'בטיפול',
  closed: 'סגור',
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
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'טעינה נכשלה');
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
    legacyAlert('עדכון סטטוס', `לשנות ל־${STATUS_LABEL[next]}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'עדכן',
        onPress: async () => {
          try {
            await adminService.updateTicket(ticket.id, { status: next });
            void HapticFeedback.success();
            await load();
          } catch (e) {
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'עדכון נכשל');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="פניות תמיכה" onBack={() => navigation.goBack()} />
      <View style={styles.filters}>
        {[
          { key: undefined, label: 'הכל' },
          { key: 'new', label: 'חדש' },
          { key: 'in_progress', label: 'בטיפול' },
          { key: 'closed', label: 'סגור' },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={String(f.key)}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? `${tokens.colors.primary.main}28`
                    : 'rgba(255,255,255,0.05)',
                  borderColor: active ? tokens.colors.primary.main : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? tokens.colors.primary.main : tokens.colors.text.secondary,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: tokens.colors.text.tertiary }]}>
              אין פניות
            </Text>
          }
          renderItem={({ item }) => {
            const name =
              item.users?.display_name ||
              item.users?.full_name ||
              item.users?.email ||
              'משתמש';
            return (
              <TouchableOpacity onPress={() => cycleStatus(item)} activeOpacity={0.8}>
                <UICard
                  variant="glass"
                  glassIntensity="light"
                  padding="md"
                  style={{ marginBottom: 10 }}
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
                    {name} · {new Date(item.created_at).toLocaleDateString('he-IL')}
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
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: DesignTokens.borderRadius.button,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subject: {
    fontWeight: '800',
    flex: 1,
    ...DesignTokens.rtlText,
  },
  status: {
    fontWeight: '700',
    fontSize: 12,
  },
  body: {
    fontSize: 13,
    marginBottom: 8,
    ...DesignTokens.rtlText,
  },
  meta: {
    fontSize: 11,
    ...DesignTokens.rtlText,
  },
  empty: {
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 40,
  },
});
