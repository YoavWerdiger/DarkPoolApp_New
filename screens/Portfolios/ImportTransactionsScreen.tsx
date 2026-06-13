import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { PortfolioScreenHeader } from './components/PortfolioScreenHeader';
import {
  parsePortfolioCsv,
  RECOMMENDED_CSV_HEADERS,
  type ParseResult,
} from '../../services/portfolios/portfolioImport';
import { bulkCreateTransactions } from '../../services/portfolios';
import { TRANSACTION_LABELS } from './portfolioConstants';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'ImportTransactions'>;
type Route = RouteProp<PortfoliosStackParamList, 'ImportTransactions'>;

export default function ImportTransactionsScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { portfolioId } = route.params;

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setFileName(asset.name);
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'utf8',
      });
      const parsed = parsePortfolioCsv(content, portfolioId);
      setParseResult(parsed);
    } catch (err) {
      Alert.alert('שגיאה', 'קריאת הקובץ נכשלה');
    }
  }, [portfolioId]);

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    try {
      setSubmitting(true);
      const inputs = parseResult.validRows
        .map((r) => r.transaction!)
        .filter(Boolean);
      const inserted = await bulkCreateTransactions(inputs);
      Alert.alert(
        'ייבוא הסתיים',
        `נוספו ${inserted} טרנזקציות לתיק.${
          parseResult.invalidRows.length > 0
            ? `\n${parseResult.invalidRows.length} שורות נדחו.`
            : ''
        }`,
        [
          {
            text: 'אישור',
            onPress: () => {
              navigation.replace('PortfolioDetail', { portfolioId });
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('שגיאה', 'הייבוא נכשל. אנא נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  }, [parseResult, portfolioId, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: '#0A0E0A' },
        scroll: { flex: 1, backgroundColor: 'transparent' },
        scrollContent: { padding: 16, paddingBottom: 80 },
        section: {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 22,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          marginBottom: 8,
          textAlign: 'right',
        },
        sectionText: {
          fontSize: 13,
          color: tokens.colors.text.secondary,
          lineHeight: 19,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        codeBox: {
          backgroundColor: 'rgba(0, 0, 0, 0.30)',
          borderRadius: 16,
          padding: 12,
          marginTop: 10,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        codeText: {
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 11,
          color: tokens.colors.text.secondary,
        },
        pickBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          backgroundColor: tokens.colors.primary.main,
          borderRadius: 28,
          marginTop: 8,
        },
        pickBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
        previewSummary: {
          flexDirection: 'row-reverse',
          gap: 12,
          marginBottom: 12,
        },
        summaryCard: {
          flex: 1,
          padding: 12,
          borderRadius: 20,
          alignItems: 'center',
          borderWidth: 1,
        },
        summaryNumber: {
          fontSize: 22,
          fontWeight: '800',
        },
        summaryLabel: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 4,
        },
        previewRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 8,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.subtle,
        },
        previewSymbol: {
          width: 60,
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        previewType: {
          width: 70,
          fontSize: 11,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
        },
        previewAmount: {
          flex: 1,
          fontSize: 12,
          color: tokens.colors.text.primary,
          textAlign: 'left',
        },
        invalidRow: {
          padding: 8,
          backgroundColor: 'rgba(255, 68, 68, 0.06)',
          borderRadius: 16,
          marginVertical: 4,
          borderWidth: 1,
          borderColor: 'rgba(255, 68, 68, 0.20)',
        },
        invalidText: {
          fontSize: 12,
          color: tokens.colors.text.danger,
          textAlign: 'right',
        },
        importBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 16,
          backgroundColor: tokens.colors.primary.main,
          borderRadius: 28,
          marginTop: 16,
        },
        importBtnText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
        fileNameRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          backgroundColor: 'rgba(0, 200, 5, 0.08)',
          borderColor: 'rgba(0, 200, 5, 0.30)',
          borderWidth: 1,
          borderRadius: 18,
          marginTop: 12,
        },
        fileNameText: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.primary.main,
          fontWeight: '600',
          textAlign: 'right',
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.root}>
      <ChatSessionBackdrop />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PortfolioScreenHeader
          title="ייבוא טרנזקציות"
          onBack={() => navigation.goBack()}
        />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מה אפשר להעלות?</Text>
            <Text style={styles.sectionText}>
              קובץ CSV עם כותרות. הסוגים הנתמכים:{' '}
              <Text style={{ fontWeight: '700' }}>BUY, SELL, DEPOSIT, WITHDRAWAL, FEE, DIVIDEND</Text>.
              עמודות שלא מזוהות אוטומטית יישלחו כעמודות אופציונליות.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>
                {RECOMMENDED_CSV_HEADERS.join(',')}
                {'\n'}
                AAPL,BUY,2024-01-15,10,185.50,1.00,USD,קנייה ראשונה
                {'\n'}
                AAPL,SELL,2024-06-10,5,210.00,1.00,USD,
                {'\n'}
                ,DEPOSIT,2024-01-01,,,,USD,הפקדה ראשונית
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => {
                void HapticFeedback.impactLight();
                void handlePickFile();
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name="cloud-upload"
                size={20}
                color={tokens.colors.text.inverse}
              />
              <Text style={styles.pickBtnText}>בחר קובץ CSV</Text>
            </TouchableOpacity>

            {fileName ? (
              <View style={styles.fileNameRow}>
                <Ionicons
                  name="document"
                  size={18}
                  color={tokens.colors.primary.main}
                />
                <Text style={styles.fileNameText} numberOfLines={1}>
                  {fileName}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Preview */}
          {parseResult ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>תצוגה מקדימה</Text>
              <View style={styles.previewSummary}>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      borderColor: 'rgba(0, 200, 5, 0.30)',
                      backgroundColor: 'rgba(0, 200, 5, 0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryNumber,
                      { color: tokens.colors.primary.main },
                    ]}
                  >
                    {parseResult.validRows.length}
                  </Text>
                  <Text style={styles.summaryLabel}>תקינות</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      borderColor: 'rgba(255, 68, 68, 0.30)',
                      backgroundColor: 'rgba(255, 68, 68, 0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryNumber,
                      { color: tokens.colors.text.danger },
                    ]}
                  >
                    {parseResult.invalidRows.length}
                  </Text>
                  <Text style={styles.summaryLabel}>שגויות</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      borderColor: tokens.colors.border.subtle,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryNumber,
                      { color: tokens.colors.text.primary },
                    ]}
                  >
                    {parseResult.totalRows}
                  </Text>
                  <Text style={styles.summaryLabel}>סה"כ</Text>
                </View>
              </View>

              {parseResult.validRows.slice(0, 10).map((r) => {
                const t = r.transaction!;
                const amount =
                  t.type === 'buy' || t.type === 'sell'
                    ? `${t.quantity} × ${t.price}`
                    : `${(t as any).amount}`;
                return (
                  <View key={r.rowIndex} style={styles.previewRow}>
                    <Text style={styles.previewSymbol}>
                      {(t as any).symbol ?? '—'}
                    </Text>
                    <Text style={styles.previewType}>
                      {TRANSACTION_LABELS[t.type]}
                    </Text>
                    <Text style={styles.previewAmount} numberOfLines={1}>
                      {amount}
                    </Text>
                  </View>
                );
              })}

              {parseResult.validRows.length > 10 ? (
                <Text
                  style={[styles.sectionText, { textAlign: 'center', marginTop: 8 }]}
                >
                  ועוד {parseResult.validRows.length - 10} שורות תקינות נוספות…
                </Text>
              ) : null}

              {parseResult.invalidRows.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: tokens.colors.text.danger },
                    ]}
                  >
                    שורות שלא יובאו ({parseResult.invalidRows.length})
                  </Text>
                  {parseResult.invalidRows.slice(0, 5).map((r) => (
                    <View key={r.rowIndex} style={styles.invalidRow}>
                      <Text style={styles.invalidText}>
                        שורה {r.rowIndex}: {r.error}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.importBtn,
                  (parseResult.validRows.length === 0 || submitting) && {
                    opacity: 0.5,
                  },
                ]}
                onPress={() => {
                  void HapticFeedback.medium();
                  void handleImport();
                }}
                disabled={parseResult.validRows.length === 0 || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={tokens.colors.text.inverse} />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={22}
                    color={tokens.colors.text.inverse}
                  />
                )}
                <Text style={styles.importBtnText}>
                  {submitting
                    ? 'מייבא…'
                    : `ייבא ${parseResult.validRows.length} טרנזקציות`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
