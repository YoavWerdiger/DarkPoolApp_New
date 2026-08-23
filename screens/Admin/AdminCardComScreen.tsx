import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import UICard from '../../components/ui/UICard';
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
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
  { key: 'ChargeOnly', label: 'ChargeOnly', hint: 'חיוב מיידי' },
  { key: 'CreateTokenOnly', label: 'CreateTokenOnly', hint: 'טוקן בלבד (חיובי ידני בהמשך)' },
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
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת הגדרות');
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
      legacyAlert('חסר ערך', 'יש למלא ApiName');
      return;
    }
    if (!Number.isFinite(terminal) || terminal <= 0) {
      legacyAlert('חסר ערך', 'יש למלא מספר מסוף תקין');
      return;
    }

    legacyAlert('שמירת הגדרות CardCom', 'לשמור את הקונפיגורציה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'שמור',
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
            legacyAlert('נשמר', 'הגדרות CardCom נשמרו (סיסמה מוצגת ממוסכת).');
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'שמירה נכשלה');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const header = (
    <ChatSubScreenHeader
      title="הגדרות CardCom"
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
        <AdminLoadingState label="טוען הגדרות CardCom..." />
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
            paddingHorizontal: tokens.spacing.base,
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

          <AdminSectionLabel>שער תשלומים</AdminSectionLabel>
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="md"
            style={{
              borderRadius: tokens.borderRadius.xl,
              borderWidth: 1,
              borderColor: chatPalette.glassBorder,
              marginBottom: tokens.spacing.md,
            }}
          >
            <Text style={[styles.note, { color: tokens.colors.text.tertiary, fontSize: 12 }]}>
              סודות לא נשלחים לקליינט. מקור נוכחי:{' '}
              {source === 'db' ? 'מסד נתונים' : source === 'env' ? 'Edge secrets' : 'ברירת מחדל'}
              {hasPassword ? ' · סיסמה מוגדרת' : ' · ללא סיסמה'}
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
                  borderColor: chatPalette.glassBorder,
                  backgroundColor: 'rgba(0,0,0,0.25)',
                },
              ]}
            />

            <FieldLabel color={tokens.colors.text.tertiary}>
              ApiPassword {hasPassword && !passwordDirty ? '(השאר ריק כדי לא לשנות)' : ''}
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
              placeholder={hasPassword ? '••••••••' : 'אופציונלי (להחזרים)'}
              placeholderTextColor={tokens.colors.text.muted}
              style={[
                styles.input,
                {
                  color: tokens.colors.text.primary,
                  borderColor: chatPalette.glassBorder,
                  backgroundColor: 'rgba(0,0,0,0.25)',
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
                  borderColor: chatPalette.glassBorder,
                  backgroundColor: 'rgba(0,0,0,0.25)',
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
            <Text style={[styles.note, { color: tokens.colors.text.muted, fontSize: 11, marginTop: 8 }]}>
              למנויים חוזרים השרת שולח Operation &quot;2&quot; (Charge+Token) זמנית כדי לא לשבור חידוש
              אוטומטי — עד מימוש Charge דחוי (Task 7).
            </Text>
          </UICard>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            style={[
              styles.saveBtn,
              {
                backgroundColor: tokens.colors.primary.main,
                opacity: saving ? 0.6 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#041006" />
            ) : (
              <Text style={styles.saveText}>שמור הגדרות</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Text style={{ color, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 6, marginTop: 12 }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  note: {
    ...DesignTokens.rtlText,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  opsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: DesignTokens.borderRadius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#041006',
    fontWeight: '800',
    fontSize: 16,
    writingDirection: 'rtl',
  },
});
