import { appLocale } from '../../lib/i18n/locale';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { ActivityIndicator } from '../../components/ui/AppSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { AdminEmptyState, AdminFilterChip } from '../../components/admin';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { adminCaption, adminCardSubtitle, adminCardTitle, adminHebrewText } from '../../components/admin/adminType';
import { supabase } from '../../services/supabase';
import { REPORT_REASONS } from '../../services/moderationService';
import { showAppAlert, showAppDialog } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useAuth } from '../../context/AuthContext';

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  reason: string;
  content_snapshot: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  message: 'הודעה בצ׳אט',
  post: 'פוסט בקהילה',
  post_reply: 'תגובה לפוסט',
  message_comment: 'תגובה להודעה',
  story: 'סטורי',
  user: 'משתמש',
};
const STATUS_LABEL: Record<string, string> = { open: 'פתוח', actioned: 'טופל', dismissed: 'נדחה' };
const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));

/** תור דיווחים על תוכן גולשים — Apple דורשת טיפול תוך 24 שעות. */
export default function AdminReportsScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'actioned' | 'dismissed'>('open');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, reporter_id, target_type, target_id, target_user_id, reason, content_snapshot, status, created_at')
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      showAppAlert('שגיאה', error.message, 'error');
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ReportRow[];
    setRows(list);
    const ids = [...new Set(list.flatMap((r) => [r.reporter_id, r.target_user_id]).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profiles } = await supabase.from('v_public_profiles').select('id, display_name, full_name').in('id', ids);
      setNames(
        Object.fromEntries(
          (profiles ?? []).map((p: { id: string; display_name?: string; full_name?: string }) => [
            p.id,
            p.display_name || p.full_name || 'משתמש',
          ]),
        ),
      );
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (row: ReportRow, status: 'actioned' | 'dismissed') => {
    const { error } = await supabase
      .from('content_reports')
      .update({ status, handled_by: user?.id ?? null, handled_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) throw error;
  };

  const act = async (row: ReportRow) => {
    // משתמש — אין תוכן אחד להסיר; שאר הסוגים נמחקים בשרת (admin_remove_reported_content)
    const canRemove = row.target_type !== 'user';
    const choice = await showAppDialog({
      title: TYPE_LABEL[row.target_type] ?? row.target_type,
      message: row.content_snapshot || undefined,
      buttons: [
        ...(canRemove ? [{ text: 'הסרת התוכן וסימון כטופל', style: 'destructive' as const }] : []),
        { text: 'סימון כטופל' },
        { text: 'דחיית הדיווח' },
        { text: 'ביטול', style: 'cancel' as const },
      ],
    });
    if (choice == null) return;
    const idx = canRemove ? choice : choice + 1;
    try {
      if (idx === 0) {
        const { error } = await supabase.rpc('admin_remove_reported_content', { p_report_id: row.id });
        if (error) throw error;
      } else if (idx === 1) await setStatus(row, 'actioned');
      else if (idx === 2) await setStatus(row, 'dismissed');
      else return;
      void HapticFeedback.success();
      await load();
    } catch (e) {
      showAppAlert('שגיאה', e instanceof Error ? e.message : 'הפעולה נכשלה', 'error');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="דיווחים על תוכן" onBack={() => navigation.goBack()} />
      <View style={styles.filters}>
        {(['open', 'actioned', 'dismissed'] as const).map((key) => (
          <AdminFilterChip key={key} label={STATUS_LABEL[key]} active={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 40 }}
          ListEmptyComponent={<AdminEmptyState title="אין דיווחים" subtitle="כשמשתמשים ידווחו על תוכן, הדיווחים יופיעו כאן." />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => void act(item)} activeOpacity={0.8} disabled={item.status !== 'open'}>
              <UICard variant="soft" padding="md" style={{ marginBottom: APP_LAYOUT.cardStackGap }}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
                    {TYPE_LABEL[item.target_type] ?? item.target_type} · {REASON_LABEL[item.reason] ?? item.reason}
                  </Text>
                  <Text style={[styles.status, { color: tokens.colors.primary.main }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
                {item.content_snapshot ? (
                  <Text style={[styles.body, { color: tokens.colors.text.secondary }]} numberOfLines={4}>
                    {item.content_snapshot}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: tokens.colors.text.tertiary }]}>
                  {item.target_user_id ? `על: ${names[item.target_user_id] ?? '—'} · ` : ''}
                  מדווח: {names[item.reporter_id] ?? '—'} · {new Date(item.created_at).toLocaleString(appLocale())}
                </Text>
              </UICard>
            </TouchableOpacity>
          )}
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
  title: { ...adminHebrewText, ...adminCardTitle, flex: 1 },
  status: { ...adminCaption },
  body: { ...adminHebrewText, ...adminCardSubtitle, marginBottom: APP_LAYOUT.stackGapSmall },
  meta: { ...adminHebrewText, ...adminCaption },
});
