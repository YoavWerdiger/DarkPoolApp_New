import { legacyAlert } from '../../utils/appDialog';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  InteractionManager,
  Platform,
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useDesignTokens } from '../ui/DesignTokens';
import type { Trade } from '../../screens/Journal/TradesListTab';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { ScreenGradientBackground } from '../VideoBackground';
import { SUPABASE_URL } from '../../config/publicEnv';

interface ExportTradeImageProps {
  trade: Trade;
  visible: boolean;
  onClose: () => void;
}

const TRANSBACK_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;

function getReturnPercentage(trade: Trade): number {
  if (trade.return_percentage !== undefined && trade.return_percentage !== null) {
    return trade.return_percentage;
  }
  if (trade.entry_price > 0) {
    if (trade.direction === 'long') {
      return ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100;
    }
    return ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;
  }
  return 0;
}

export default function ExportTradeImage({ trade, visible, onClose }: ExportTradeImageProps) {
  const DesignTokens = useDesignTokens();
  const viewShotRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const cardW = Math.min(360, Dimensions.get('window').width - 48);
  const transH = 520;

  useEffect(() => {
    if (visible) {
      setLayoutReady(false);
    }
  }, [visible, trade?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  };

  const formatCurrencyPlain = (value: number) =>
    Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const snapshot = useMemo(() => {
    if (!trade) return null;
    const isProfit = trade.pnl >= 0;
    const ret = getReturnPercentage(trade);
    const dirColor =
      trade.direction === 'long' ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;
    const pnlColor = isProfit ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;
    const retColor = ret >= 0 ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;
    const logoUri = brandfetchTickerLogoUri(trade.symbol);
    return { isProfit, ret, dirColor, pnlColor, retColor, logoUri };
  }, [trade, DesignTokens]);

  const handleExport = useCallback(async () => {
    if (!viewShotRef.current || !layoutReady) {
      legacyAlert('שגיאה', 'נא להמתין רגע עד שהתצוגה מוכנה');
      return;
    }

    try {
      setIsExporting(true);
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });
      await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 450 : 150));

      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'שתף טרייד',
          UTI: 'public.png',
        });
      } else {
        legacyAlert('שגיאה', 'שיתוף לא זמין במכשיר זה');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      legacyAlert('שגיאה', 'לא ניתן ליצור תמונה: ' + msg);
    } finally {
      setIsExporting(false);
    }
  }, [layoutReady]);

  if (!trade || !visible || !snapshot) {
    return null;
  }

  const { isProfit, ret, dirColor, pnlColor, retColor, logoUri } = snapshot;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.9]}
      enablePanDownToClose={true}
      backdropOpacity={0.5}
      showHandle={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>יצוא טרייד לתמונה</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={DesignTokens.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            key={trade.id}
            ref={viewShotRef}
            collapsable={false}
            style={[styles.shotWrap, { width: cardW }]}
            onLayout={() => setLayoutReady(true)}
          >
            <View style={[styles.cardRoot, { width: cardW }]}>
              <ScreenGradientBackground style={StyleSheet.absoluteFillObject} />
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, styles.transbackWrap]}
              >
                <ImageBackground
                  source={{ uri: TRANSBACK_URI }}
                  style={{ width: cardW * 1.9, height: transH }}
                  imageStyle={{ resizeMode: 'cover', opacity: 0.95 }}
                />
              </View>
              <View style={styles.cardDim} />

              <View style={[styles.cardContent, { direction: 'rtl' }]}>
                <View style={styles.brandRow}>
                  <Text style={[styles.brandTitle, { color: DesignTokens.colors.primary.main }]}>
                    DarkPool
                  </Text>
                  <View style={[styles.brandLine, { backgroundColor: DesignTokens.colors.primary.main }]} />
                  <Text style={[styles.brandSub, { color: DesignTokens.colors.text.tertiary }]}>
                    יומן מסחר
                  </Text>
                </View>

                <View style={styles.symbolRow}>
                  {logoUri ? (
                    <View style={styles.logoRing}>
                      <Image
                        source={{ uri: logoUri }}
                        style={styles.logoImg}
                        contentFit="cover"
                        transition={120}
                      />
                    </View>
                  ) : (
                    <View style={[styles.logoRing, styles.logoFallback]}>
                      <Text style={[styles.logoFallbackText, { color: DesignTokens.colors.text.secondary }]}>
                        {trade.symbol.trim().slice(0, 4).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.symbolTextCol}>
                    <Text style={[styles.symbolBig, { color: DesignTokens.colors.text.primary }]}>
                      {trade.symbol}
                    </Text>
                    <View style={[styles.dirPill, { backgroundColor: `${dirColor}30` }]}>
                      <Text style={[styles.dirPillText, { color: dirColor }]}>
                        {trade.direction === 'long' ? 'LONG' : 'SHORT'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                <DetailLine
                  label="כניסה"
                  value={`$${formatCurrencyPlain(trade.entry_price)}`}
                  valueColor={DesignTokens.colors.primary.main}
                />
                <DetailLine
                  label="יציאה"
                  value={`$${formatCurrencyPlain(trade.exit_price)}`}
                  valueColor={DesignTokens.colors.primary.main}
                />
                <DetailLine
                  label="כמות"
                  value={String(trade.quantity)}
                  valueColor={DesignTokens.colors.text.primary}
                />
                <DetailLine
                  label="תאריך יציאה"
                  value={`${formatDate(trade.exit_date)} · ${formatTime(trade.exit_date)}`}
                  valueColor={DesignTokens.colors.text.primary}
                />

                <View style={[styles.pnlBlock, { borderTopColor: DesignTokens.colors.border.primary }]}>
                  <Text style={[styles.pnlLabel, { color: DesignTokens.colors.text.secondary }]}>
                    {isProfit ? 'רווח נטו' : 'הפסד נטו'}
                  </Text>
                  <Text style={[styles.pnlValue, { color: pnlColor }]}>
                    {isProfit ? '+' : '−'}${formatCurrencyPlain(trade.pnl)}
                  </Text>
                </View>

                <View style={styles.retBlock}>
                  <Text style={[styles.retLabel, { color: DesignTokens.colors.text.secondary }]}>תשואה</Text>
                  <Text style={[styles.retValue, { color: retColor }]}>
                    {ret >= 0 ? '+' : ''}
                    {ret.toFixed(2)}%
                  </Text>
                </View>

                <Text style={[styles.footerNote, { color: DesignTokens.colors.text.muted }]}>
                  DarkPool · שיתוף מהאפליקציה
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={isExporting || !layoutReady}
          >
            {isExporting ? (
              <>
                <ActivityIndicator size="small" color={DesignTokens.colors.text.inverse} />
                <Text style={styles.exportButtonText}>מייצא...</Text>
              </>
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={DesignTokens.colors.text.inverse} />
                <Text style={styles.exportButtonText}>ייצא ושיתוף</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

function DetailLine({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    direction: 'rtl',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'right',
    flexShrink: 0,
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
});

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tokens.colors.background.secondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: tokens.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.primary,
    },
    headerTitle: {
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    closeButton: {
      padding: tokens.spacing.xs,
    },
    previewContainer: {
      flex: 1,
    },
    previewContent: {
      padding: tokens.spacing.lg,
      alignItems: 'center',
      paddingBottom: tokens.spacing.xl,
    },
    shotWrap: {
      alignSelf: 'center',
      backgroundColor: '#0A0E0A',
    },
    cardRoot: {
      borderRadius: 22,
      overflow: 'hidden',
      minHeight: 440,
      backgroundColor: '#0A0E0A',
    },
    transbackWrap: {
      justifyContent: 'center',
      alignItems: 'center',
      opacity: 0.22,
    },
    cardDim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 8, 4, 0.35)',
    },
    cardContent: {
      padding: 22,
      zIndex: 2,
      position: 'relative',
    },
    brandRow: {
      alignItems: 'center',
      marginBottom: 18,
    },
    brandTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 1.2,
      textAlign: 'center',
    },
    brandLine: {
      width: 48,
      height: 3,
      borderRadius: 2,
      marginVertical: 8,
    },
    brandSub: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    symbolRow: {
      flexDirection: 'row',
      direction: 'rtl',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: 6,
    },
    logoRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImg: {
      width: 56,
      height: 56,
    },
    logoFallback: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    logoFallbackText: {
      fontSize: 13,
      fontWeight: '800',
    },
    symbolTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 8,
    },
    symbolBig: {
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'right',
    },
    dirPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
    },
    dirPillText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    divider: {
      height: 10,
    },
    pnlBlock: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      flexDirection: 'row',
      direction: 'rtl',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    pnlLabel: {
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'right',
      flexShrink: 0,
    },
    pnlValue: {
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      textAlign: 'left',
      writingDirection: 'ltr',
      flex: 1,
    },
    retBlock: {
      marginTop: 14,
      flexDirection: 'row',
      direction: 'rtl',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    retLabel: {
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'right',
      flexShrink: 0,
    },
    retValue: {
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'left',
      writingDirection: 'ltr',
      flex: 1,
    },
    footerNote: {
      marginTop: 18,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
    },
    footer: {
      padding: tokens.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.primary,
    },
    exportButton: {
      flexDirection: 'row',
      backgroundColor: tokens.colors.primary.main,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing.sm,
    },
    exportButtonDisabled: {
      opacity: 0.6,
    },
    exportButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.inverse,
    },
  });
