import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  adminBody,
  adminCaption,
  adminCaption2,
  adminCardSubtitle,
  adminCardTitle,
  adminHebrewText,
} from '../../components/admin/adminType';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminBadge,
  AdminEmptyState,
} from '../../components/admin';
import {
  adminService,
  type AdminPushAudience,
  type AdminPushCampaign,
} from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const AUDIENCES: { key: AdminPushAudience; label: string }[] = [
  { key: 'all', label: 'כולם' },
  { key: 'free', label: 'חינמי' },
  { key: 'premium', label: 'פרימיום' },
  { key: 'active_7d', label: 'פעילים 7 ימים' },
];

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'כולם',
  free: 'חינמי',
  premium: 'פרימיום',
  active_7d: 'פעילים 7 ימים',
  custom: 'מותאם',
};

export default function AdminPushScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AdminPushAudience>('all');
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<AdminPushCampaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const res = await adminService.listCampaigns();
      setCampaigns(res.campaigns);
    } catch {
      /* non-critical */
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      legacyAlert('חסר תוכן', 'יש למלא כותרת וגוף הודעה');
      return;
    }

    legacyAlert('שליחת פוש', `לשלוח לקהל: ${AUDIENCES.find((a) => a.key === audience)?.label}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'שלח',
        onPress: async () => {
          setSending(true);
          try {
            const res = await adminService.sendPush({
              title: title.trim(),
              body: body.trim(),
              audience,
            });
            void HapticFeedback.success();
            legacyAlert(
              'נשלח',
              `נשלחו ${res.sent} התראות (${res.failed} נכשלו)\nקהל: ${res.audienceSize} · טוקנים: ${res.tokens}`,
            );
            setTitle('');
            setBody('');
            await loadHistory();
          } catch (e) {
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'שליחה נכשלה');
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  const statusColor = (status: string) => {
    if (status === 'sent' || status === 'completed') return tokens.colors.primary.main;
    if (status === 'failed') return tokens.colors.danger.main;
    return tokens.colors.warning.main;
  };

  const statusLabel = (status: string) => {
    if (status === 'sent' || status === 'completed') return 'נשלח';
    if (status === 'failed') return 'נכשל';
    if (status === 'partial') return 'חלקי';
    return status;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ChatSubScreenHeader
        title="שליחת פוש"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: tokens.spacing.sm,
            paddingBottom: 48,
          }}
        >
          {/* Composer */}
          <UICard
            variant="soft"
            padding="none"
            style={{
              marginBottom: APP_LAYOUT.cardStackGap,
              padding: APP_LAYOUT.cardPadding,
            }}
          >
            <View style={styles.composerHeader}>
              <Text style={[styles.composerTitle, { color: tokens.colors.text.primary }]}>
                הודעה חדשה
              </Text>
              <Text style={[styles.composerSub, { color: tokens.colors.text.tertiary }]}>
                שליחה מיידית לקהל שנבחר
              </Text>
            </View>

            <AdminSectionLabel style={{ marginTop: 4 }}>קהל יעד</AdminSectionLabel>
            <View style={styles.filters}>
              {AUDIENCES.map((a) => (
                <AdminFilterChip
                  key={a.key}
                  label={a.label}
                  active={audience === a.key}
                  onPress={() => setAudience(a.key)}
                />
              ))}
            </View>

            <View style={styles.fieldHeader}>
              <Text style={[styles.counter, { color: tokens.colors.text.muted }]}>
                {title.length}/80
              </Text>
              <Text style={[styles.fieldLabel, { color: tokens.colors.text.secondary }]}>
                כותרת
              </Text>
            </View>
            <View
              style={[
                formFieldShellStyle({ tokens, focused: false }),
                styles.fieldShell,
                { marginBottom: APP_LAYOUT.componentGap },
              ]}
            >
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                placeholder="כותרת ההתראה"
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[styles.inputInner, { color: tokens.colors.text.primary }]}
              />
            </View>

            <View style={styles.fieldHeader}>
              <Text style={[styles.counter, { color: tokens.colors.text.muted }]}>
                {body.length}/240
              </Text>
              <Text style={[styles.fieldLabel, { color: tokens.colors.text.secondary }]}>
                תוכן
              </Text>
            </View>
            <View
              style={[
                formFieldShellStyle({ tokens, focused: false, multiline: true }),
                styles.fieldShell,
                styles.fieldShellMultiline,
                { marginBottom: APP_LAYOUT.componentGap },
              ]}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                maxLength={240}
                multiline
                placeholder="גוף ההודעה"
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[
                  styles.inputInner,
                  styles.textarea,
                  { color: tokens.colors.text.primary },
                ]}
              />
            </View>

            <UIButton
              title="שלח התראה"
              variant="primary"
              onPress={handleSend}
              disabled={!canSend}
              loading={sending}
              fullWidth
            />
          </UICard>

          {/* History */}
          <AdminSectionLabel>היסטוריה</AdminSectionLabel>

          {loadingHistory ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : campaigns.length === 0 ? (
            <AdminEmptyState
              title="עדיין אין קמפיינים"
              subtitle="הודעות שנשלחו יופיעו כאן"
            />
          ) : (
            campaigns.map((c) => (
              <UICard
                key={c.id}
                variant="soft"
                padding="none"
                style={{
                  marginBottom: APP_LAYOUT.cardStackGap,
                  padding: APP_LAYOUT.cardPadding,
                }}
              >
                <View style={styles.campaignTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.campaignTitle, { color: tokens.colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {c.title}
                    </Text>
                    <Text
                      style={[styles.campaignBody, { color: tokens.colors.text.secondary }]}
                      numberOfLines={2}
                    >
                      {c.body}
                    </Text>
                  </View>
                  <AdminBadge label={statusLabel(c.status)} color={statusColor(c.status)} />
                </View>

                <View style={[styles.campaignMeta, { borderTopColor: tokens.colors.border.divider }]}>
                  <Text style={[adminCaption2, { color: tokens.colors.text.muted }]}>
                    {formatDate(c.sent_at || c.created_at)}
                  </Text>
                  <Text style={[styles.campaignMetaText, { color: tokens.colors.text.tertiary }]}>
                    {AUDIENCE_LABELS[c.audience] ?? c.audience}
                    {' · '}
                    נשלח {c.sent_count}
                    {c.failed_count > 0 ? ` · נכשל ${c.failed_count}` : ''}
                  </Text>
                </View>
              </UICard>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  composerHeader: {
    marginBottom: 16,
  },
  composerTitle: {
    ...adminHebrewText,
    ...adminCardTitle,
  },
  composerSub: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    marginTop: 2,
  },
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    ...adminHebrewText,
    ...adminCaption,
  },
  counter: {
    ...adminCaption,
  },
  fieldShell: {
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  fieldShellMultiline: {
    borderRadius: 24,
    minHeight: 110,
    alignItems: 'stretch',
  },
  inputInner: {
    flex: 1,
    padding: 0,
    ...adminHebrewText,
    ...adminBody,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  campaignTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  campaignTitle: {
    ...adminHebrewText,
    ...adminCardTitle,
  },
  campaignBody: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    marginTop: 2,
  },
  campaignMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  campaignMetaText: {
    ...adminHebrewText,
    ...adminCaption,
  },
});
