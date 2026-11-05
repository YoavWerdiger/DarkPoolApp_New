import i18n from '../../lib/i18n';
import { appLocale } from '../../lib/i18n/locale';
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
  { key: 'all', label: i18n.t('auto.screens__Admin__AdminPushScreen.s1') },
  { key: 'free', label: i18n.t('auto.screens__Admin__AdminPushScreen.s2') },
  { key: 'premium', label: i18n.t('auto.screens__Admin__AdminPushScreen.s3') },
  { key: 'active_7d', label: i18n.t('auto.screens__Admin__AdminPushScreen.s4') },
];

const AUDIENCE_LABELS: Record<string, string> = {
  all: i18n.t('auto.screens__Admin__AdminPushScreen.s1'),
  free: i18n.t('auto.screens__Admin__AdminPushScreen.s2'),
  premium: i18n.t('auto.screens__Admin__AdminPushScreen.s3'),
  active_7d: i18n.t('auto.screens__Admin__AdminPushScreen.s4'),
  custom: i18n.t('auto.screens__Admin__AdminPushScreen.s5'),
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
      legacyAlert(i18n.t('auto.screens__Admin__AdminPushScreen.s6'), i18n.t('auto.screens__Admin__AdminPushScreen.s7'));
      return;
    }

    legacyAlert(i18n.t('auto.screens__Admin__AdminPushScreen.s8'), i18n.t('auto.screens__Admin__AdminPushScreen.s9', { v0: AUDIENCES.find((a) => a.key === audience)?.label }), [
      { text: i18n.t('auto.screens__Admin__AdminPushScreen.s10'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminPushScreen.s11'),
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
              i18n.t('auto.screens__Admin__AdminPushScreen.s12'),
              i18n.t('auto.screens__Admin__AdminPushScreen.s13', { v0: res.sent, v1: res.failed, v2: res.audienceSize, v3: res.tokens }),
            );
            setTitle('');
            setBody('');
            await loadHistory();
          } catch (e) {
            legacyAlert(i18n.t('auto.screens__Admin__AdminPushScreen.s14'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPushScreen.s15'));
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
    if (status === 'sent' || status === 'completed') return i18n.t('auto.screens__Admin__AdminPushScreen.s12');
    if (status === 'failed') return i18n.t('auto.screens__Admin__AdminPushScreen.s16');
    if (status === 'partial') return i18n.t('auto.screens__Admin__AdminPushScreen.s17');
    return status;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(appLocale(), {
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
        title={i18n.t('auto.screens__Admin__AdminPushScreen.s8')}
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
              <Text style={[styles.composerTitle, { color: tokens.colors.text.primary }]}>{i18n.t('auto.screens__Admin__AdminPushScreen.s18')}</Text>
              <Text style={[styles.composerSub, { color: tokens.colors.text.tertiary }]}>{i18n.t('auto.screens__Admin__AdminPushScreen.s19')}</Text>
            </View>

            <AdminSectionLabel style={{ marginTop: 4 }}>{i18n.t('auto.screens__Admin__AdminPushScreen.s20')}</AdminSectionLabel>
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
              <Text style={[styles.fieldLabel, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Admin__AdminPushScreen.s21')}</Text>
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
                placeholder={i18n.t('auto.screens__Admin__AdminPushScreen.s22')}
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[styles.inputInner, { color: tokens.colors.text.primary }]}
              />
            </View>

            <View style={styles.fieldHeader}>
              <Text style={[styles.counter, { color: tokens.colors.text.muted }]}>
                {body.length}/240
              </Text>
              <Text style={[styles.fieldLabel, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Admin__AdminPushScreen.s23')}</Text>
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
                placeholder={i18n.t('auto.screens__Admin__AdminPushScreen.s24')}
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[
                  styles.inputInner,
                  styles.textarea,
                  { color: tokens.colors.text.primary },
                ]}
              />
            </View>

            <UIButton
              title={i18n.t('auto.screens__Admin__AdminPushScreen.s25')}
              variant="primary"
              onPress={handleSend}
              disabled={!canSend}
              loading={sending}
              fullWidth
            />
          </UICard>

          {/* History */}
          <AdminSectionLabel>{i18n.t('auto.screens__Admin__AdminPushScreen.s26')}</AdminSectionLabel>

          {loadingHistory ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : campaigns.length === 0 ? (
            <AdminEmptyState
              title={i18n.t('auto.screens__Admin__AdminPushScreen.s27')}
              subtitle={i18n.t('auto.screens__Admin__AdminPushScreen.s28')}
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
                    {i18n.t('auto.screens__Admin__AdminPushScreen.s12')} {c.sent_count}
                    {c.failed_count > 0 ? i18n.t('auto.screens__Admin__AdminPushScreen.s29', { v0: c.failed_count }) : ''}
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
