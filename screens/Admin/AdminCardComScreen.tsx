import { ROW_REV, TEXT_END, TEXT_START } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { adminBody, adminCaption, adminHebrewText } from '../../components/admin/adminType';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminLoadingState,
  AdminErrorState,
  AdminDeniedState,
} from '../../components/admin';
import {
  adminService,
  type CardComAdminOperation,
  type CardComConfigView,
} from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const OPS: { key: CardComAdminOperation; label: string; hint: string }[] = [
  { key: 'ChargeOnly', label: 'ChargeOnly', hint: i18n.t('auto.screens__Admin__AdminCardComScreen.s1') },
  { key: 'CreateTokenOnly', label: 'CreateTokenOnly', hint: i18n.t('auto.screens__Admin__AdminCardComScreen.s2') },
];

export default function AdminCardComScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<CardComConfigView['source'] | null>(null);

  const [apiName, setApiName] = useState('CardTest1994');
  const [apiPassword, setApiPassword] = useState('');
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [terminalNumber, setTerminalNumber] = useState('1000');
  const [operation, setOperation] = useState<CardComAdminOperation>('ChargeOnly');

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await adminService.getCardcomConfig();
      const cfg = res.config;
      if (cfg) {
        setApiName(cfg.apiName || res.defaults.apiName);
        setTerminalNumber(String(cfg.terminalNumber || res.defaults.terminalNumber));
        setOperation(cfg.operation || 'ChargeOnly');
        setHasPassword(cfg.hasPassword);
        setSource(cfg.source);
        setApiPassword('');
        setPasswordDirty(false);
      } else {
        setApiName(res.defaults.apiName);
        setTerminalNumber(String(res.defaults.terminalNumber));
        setOperation(res.defaults.operation);
        setSource(null);
        setHasPassword(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCardComScreen.s3'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) void load();
    else if (!adminLoading && !isAdmin) setLoading(false);
  }, [adminLoading, isAdmin, load]);

  const handleSave = () => {
    const terminal = Number(terminalNumber);
    if (!apiName.trim()) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCardComScreen.s4'), i18n.t('auto.screens__Admin__AdminCardComScreen.s5'));
      return;
    }
    if (!Number.isFinite(terminal) || terminal <= 0) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCardComScreen.s4'), i18n.t('auto.screens__Admin__AdminCardComScreen.s6'));
      return;
    }

    legacyAlert(i18n.t('auto.screens__Admin__AdminCardComScreen.s7'), i18n.t('auto.screens__Admin__AdminCardComScreen.s8'), [
      { text: i18n.t('auto.screens__Admin__AdminCardComScreen.s9'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminCardComScreen.s10'),
        onPress: async () => {
          setSaving(true);
          try {
            const res = await adminService.upsertCardcomConfig({
              apiName: apiName.trim(),
              terminalNumber: terminal,
              operation,
              apiPassword: passwordDirty ? apiPassword : undefined,
            });
            setHasPassword(res.config.hasPassword);
            setSource(res.config.source);
            setApiPassword('');
            setPasswordDirty(false);
            void HapticFeedback.success();
            legacyAlert(i18n.t('auto.screens__Admin__AdminCardComScreen.s11'), i18n.t('auto.screens__Admin__AdminCardComScreen.s12'));
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert(i18n.t('auto.screens__Admin__AdminCardComScreen.s13'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCardComScreen.s14'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const header = (
    <ChatSubScreenHeader
      title={i18n.t('auto.screens__Admin__AdminCardComScreen.s15')}
      onBack={() => {
        void HapticFeedback.impactLight();
        navigation.goBack();
      }}
    />
  );

  if (adminLoading || loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminLoadingState label={i18n.t('auto.screens__Admin__AdminCardComScreen.s16')} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminDeniedState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: tokens.spacing.sm,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <AdminErrorState
              message={error}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : null}

          <AdminSectionLabel>{i18n.t('auto.screens__Admin__AdminCardComScreen.s17')}</AdminSectionLabel>
          <UICard
            variant="soft"
            padding="md"
            style={{ marginBottom: tokens.spacing.md }}
          >
            <Text style={[styles.note, { color: tokens.colors.text.tertiary }]}>
              {i18n.t('auto.screens__Admin__AdminCardComScreen.s18')}{' '}
              {source === 'db' ? i18n.t('auto.screens__Admin__AdminCardComScreen.s19') : source === 'env' ? 'Edge secrets' : i18n.t('auto.screens__Admin__AdminCardComScreen.s20')}
              {hasPassword ? i18n.t('auto.screens__Admin__AdminCardComScreen.s21') : i18n.t('auto.screens__Admin__AdminCardComScreen.s22')}
            </Text>

            <FieldLabel color={tokens.colors.text.tertiary}>ApiName</FieldLabel>
            <TextInput
              value={apiName}
              onChangeText={setApiName}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="CardTest1994"
              placeholderTextColor={tokens.colors.text.muted}
              style={[
                styles.input,
                {
                  color: tokens.colors.text.primary,
                  backgroundColor: tokens.colors.background.input,
                },
              ]}
            />

            <FieldLabel color={tokens.colors.text.tertiary}>
              ApiPassword {hasPassword && !passwordDirty ? i18n.t('auto.screens__Admin__AdminCardComScreen.s23') : ''}
            </FieldLabel>
            <TextInput
              value={apiPassword}
              onChangeText={(t) => {
                setApiPassword(t);
                setPasswordDirty(true);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder={hasPassword ? '••••••••' : i18n.t('auto.screens__Admin__AdminCardComScreen.s24')}
              placeholderTextColor={tokens.colors.text.muted}
              style={[
                styles.input,
                {
                  color: tokens.colors.text.primary,
                  backgroundColor: tokens.colors.background.input,
                },
              ]}
            />

            <FieldLabel color={tokens.colors.text.tertiary}>TerminalNumber</FieldLabel>
            <TextInput
              value={terminalNumber}
              onChangeText={setTerminalNumber}
              keyboardType="number-pad"
              placeholder="1000"
              placeholderTextColor={tokens.colors.text.muted}
              style={[
                styles.input,
                {
                  color: tokens.colors.text.primary,
                  backgroundColor: tokens.colors.background.input,
                },
              ]}
            />

            <FieldLabel color={tokens.colors.text.tertiary}>Operation</FieldLabel>
            <View style={styles.opsRow}>
              {OPS.map((op) => (
                <AdminFilterChip
                  key={op.key}
                  label={op.label}
                  active={operation === op.key}
                  onPress={() => setOperation(op.key)}
                />
              ))}
            </View>
            <Text style={[styles.note, { color: tokens.colors.text.secondary, marginTop: 8 }]}>{i18n.t('auto.screens__Admin__AdminCardComScreen.s25')}</Text>
          </UICard>

          <UIButton
            title={i18n.t('auto.screens__Admin__AdminCardComScreen.s26')}
            variant="primary"
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Text style={[adminHebrewText, adminCaption, { color, textAlign: TEXT_START, marginBottom: 6, marginTop: 12 }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  note: {
    ...adminHebrewText,
    ...adminCaption,
  },
  input: {
    borderWidth: 0,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...adminBody,
    textAlign: TEXT_END,
    writingDirection: 'ltr',
  },
  opsRow: {
    flexDirection: ROW_REV,
    flexWrap: 'wrap',
    gap: 8,
  },
});
