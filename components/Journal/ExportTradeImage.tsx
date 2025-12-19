import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useDesignTokens } from '../ui/DesignTokens';
import { Trade } from '../../screens/Journal/TradesListTab';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ExportTradeImageProps {
  trade: Trade;
  visible: boolean;
  onClose: () => void;
}

export default function ExportTradeImage({ trade, visible, onClose }: ExportTradeImageProps) {
  const DesignTokens = useDesignTokens();
  const viewShotRef = useRef<ViewShot>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  };

  const formatCurrency = (value: number) => {
    return Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!trade || !visible) {
    return null;
  }

  const isProfit = trade.pnl >= 0;
  const returnPercentage = trade.return_percentage || 0;

  const handleExport = async () => {
    if (!viewShotRef.current) {
      Alert.alert('שגיאה', 'לא ניתן ליצור תמונה: ViewShot ref is null');
      return;
    }

    try {
      setIsExporting(true);

      // המתן קצת כדי שהתצוגה תתעדכן
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Capturing view...');
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        console.log('View captured:', uri);

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'שתף טרייד',
            UTI: 'public.png'
          });
        } else {
          Alert.alert('שגיאה', 'שיתוף לא זמין במכשיר זה');
        }
      } else {
        throw new Error('ViewShot capture method not available');
      }
    } catch (error: any) {
      console.error('Error exporting trade image:', error);
      Alert.alert('שגיאה', 'לא ניתן ליצור תמונה: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

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
          <Text style={styles.headerTitle}>יצוא טרייד לתמונה ממותגת</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={DesignTokens.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={styles.tradeCard}
          >
            <LinearGradient
              colors={['#000000', '#000A04', '#001A0A']}
              style={styles.gradient}
            >
              {/* Header with Logo/Branding */}
              <View style={styles.brandingHeader}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.brandingLogo}
                  resizeMode="contain"
                />
                <Text style={styles.brandingText}>DarkPool</Text>
                <View style={styles.brandingLine} />
              </View>

              {/* Trade Symbol and Direction */}
              <View style={styles.symbolContainer}>
                <Text style={styles.symbolText}>{trade.symbol}</Text>
                <View style={[
                  styles.directionBadge,
                  {
                    backgroundColor: trade.direction === 'long'
                      ? `${DesignTokens.colors.primary.main}30`
                      : `${DesignTokens.colors.text.danger}30`
                  }
                ]}>
                  <Text style={[
                    styles.directionText,
                    {
                      color: trade.direction === 'long'
                        ? DesignTokens.colors.primary.main
                        : DesignTokens.colors.text.danger
                    }
                  ]}>
                    {trade.direction === 'long' ? 'LONG' : 'SHORT'}
                  </Text>
                </View>
              </View>

              {/* Trade Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>מחיר כניסה:</Text>
                  <Text style={styles.detailValue}>${trade.entry_price.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>מחיר יציאה:</Text>
                  <Text style={styles.detailValue}>${trade.exit_price.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>כמות:</Text>
                  <Text style={styles.detailValue}>{trade.quantity}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>תאריך כניסה:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(trade.entry_date)} {formatTime(trade.entry_date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>תאריך יציאה:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(trade.exit_date)} {formatTime(trade.exit_date)}
                  </Text>
                </View>
              </View>

              {/* P&L Section */}
              <View style={styles.pnlContainer}>
                <View style={styles.pnlRow}>
                  <Text style={styles.pnlLabel}>P&L:</Text>
                  <Text style={[
                    styles.pnlValue,
                    isProfit ? styles.pnlValueProfit : styles.pnlValueLoss
                  ]}>
                    {isProfit ? '+' : ''}${formatCurrency(trade.pnl)}
                  </Text>
                </View>
                <View style={styles.pnlRow}>
                  <Text style={styles.pnlLabel}>תשואה:</Text>
                  <Text style={[
                    styles.returnValue,
                    isProfit ? styles.returnValueProfit : styles.returnValueLoss
                  ]}>
                    {returnPercentage > 0 ? '+' : ''}{returnPercentage.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {/* Footer Branding */}
              <View style={styles.footerBranding}>
                <Text style={styles.footerText}>DarkPool App</Text>
              </View>
            </LinearGradient>
          </ViewShot>
        </ScrollView>

        {/* Export Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <ActivityIndicator size="small" color={DesignTokens.colors.text.primary} />
                <Text style={styles.exportButtonText}>מייצא...</Text>
              </>
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={DesignTokens.colors.text.primary} />
                <Text style={styles.exportButtonText}>ייצא ושיתוף</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
  },
  header: {
    flexDirection: 'row-reverse',
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
    justifyContent: 'center',
  },
  tradeCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: tokens.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    padding: tokens.spacing.xl,
    minHeight: 500,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  brandingLogo: {
    width: 60,
    height: 60,
    marginBottom: tokens.spacing.sm,
    borderRadius: 12,
  },
  brandingText: {
    fontSize: 28,
    fontWeight: 'bold' as any,
    color: tokens.colors.primary.main,
    letterSpacing: 2,
  },
  brandingLine: {
    width: 60,
    height: 2,
    backgroundColor: tokens.colors.primary.main,
    marginTop: tokens.spacing.sm,
  },
  symbolContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  symbolText: {
    fontSize: 36,
    fontWeight: 'bold' as any,
    color: tokens.colors.text.primary,
  },
  directionBadge: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.md,
  },
  directionText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold as any,
    letterSpacing: 1,
  },
  detailsContainer: {
    marginBottom: tokens.spacing.xl,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  detailValue: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    fontWeight: tokens.typography.fontWeight.semibold as any,
  },
  pnlContainer: {
    marginTop: tokens.spacing.xl,
    paddingTop: tokens.spacing.xl,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  pnlRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  pnlLabel: {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.text.secondary,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  pnlValue: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold as any,
  },
  pnlValueProfit: {
    color: tokens.colors.primary.main,
  },
  pnlValueLoss: {
    color: tokens.colors.text.danger,
  },
  returnValue: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
  },
  returnValueProfit: {
    color: tokens.colors.primary.main,
  },
  returnValueLoss: {
    color: tokens.colors.text.danger,
  },
  footerBranding: {
    marginTop: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.tertiary,
    fontWeight: tokens.typography.fontWeight.medium as any,
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
    color: tokens.colors.text.primary,
  },
});
