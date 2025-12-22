import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useDesignTokens } from '../ui/DesignTokens';
import { Trade } from '../../screens/Journal/TradesListTab';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ExportTradeImageProps {
  trade: Trade;
  visible: boolean;
  onClose: () => void;
}

export default function ExportTradeImage({ trade, visible, onClose }: ExportTradeImageProps) {
  const DesignTokens = useDesignTokens();
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
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

  const generateHTML = () => {
    const isProfit = trade.pnl >= 0;
    const returnPercentage = trade.return_percentage || 0;
    const directionColor = trade.direction === 'long' 
      ? DesignTokens.colors.primary.main 
      : DesignTokens.colors.text.danger;
    const pnlColor = isProfit 
      ? DesignTokens.colors.primary.main 
      : DesignTokens.colors.text.danger;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(180deg, #000000 0%, #000A04 20%, #001A0A 35%, #001A0A 65%, #000A04 80%, #000000 100%);
      color: #ffffff;
      padding: 40px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .trade-card {
      background: transparent;
      border-radius: 24px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
    }
    .branding-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .branding-logo {
      width: 60px;
      height: 60px;
      margin: 0 auto 12px;
      border-radius: 12px;
    }
    .branding-text {
      font-size: 28px;
      font-weight: bold;
      color: ${DesignTokens.colors.primary.main};
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .branding-line {
      width: 60px;
      height: 2px;
      background: ${DesignTokens.colors.primary.main};
      margin: 8px auto 0;
    }
    .symbol-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      direction: rtl;
    }
    .symbol-text {
      font-size: 36px;
      font-weight: bold;
      color: #ffffff;
    }
    .direction-badge {
      padding: 8px 16px;
      border-radius: 8px;
      background: ${directionColor}30;
    }
    .direction-text {
      font-size: 14px;
      font-weight: bold;
      color: ${directionColor};
      letter-spacing: 1px;
    }
    .details-container {
      margin-bottom: 40px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      direction: rtl;
    }
    .detail-label {
      font-size: 16px;
      color: #888;
      font-weight: 500;
    }
    .detail-value {
      font-size: 16px;
      color: #ffffff;
      font-weight: 600;
    }
    .pnl-container {
      margin-top: 40px;
      padding-top: 40px;
      border-top: 2px solid rgba(255, 255, 255, 0.2);
    }
    .pnl-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      direction: rtl;
    }
    .pnl-label {
      font-size: 18px;
      color: #888;
      font-weight: 500;
    }
    .pnl-value {
      font-size: 32px;
      font-weight: bold;
      color: ${pnlColor};
    }
    .return-value {
      font-size: 24px;
      font-weight: bold;
      color: ${pnlColor};
    }
    .footer-branding {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
    }
    .footer-text {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="trade-card">
    <div class="branding-header">
      <div class="branding-text">DarkPool</div>
      <div class="branding-line"></div>
    </div>
    
    <div class="symbol-container">
      <div class="symbol-text">${trade.symbol}</div>
      <div class="direction-badge">
        <span class="direction-text">${trade.direction === 'long' ? 'LONG' : 'SHORT'}</span>
      </div>
    </div>
    
    <div class="details-container">
      <div class="detail-row">
        <span class="detail-label">מחיר כניסה:</span>
        <span class="detail-value">$${trade.entry_price.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">מחיר יציאה:</span>
        <span class="detail-value">$${trade.exit_price.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">כמות:</span>
        <span class="detail-value">${trade.quantity}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך כניסה:</span>
        <span class="detail-value">${formatDate(trade.entry_date)} ${formatTime(trade.entry_date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך יציאה:</span>
        <span class="detail-value">${formatDate(trade.exit_date)} ${formatTime(trade.exit_date)}</span>
      </div>
    </div>
    
    <div class="pnl-container">
      <div class="pnl-row">
        <span class="pnl-label">P&L:</span>
        <span class="pnl-value">${isProfit ? '+' : ''}$${formatCurrency(trade.pnl)}</span>
      </div>
      <div class="pnl-row">
        <span class="pnl-label">תשואה:</span>
        <span class="return-value">${returnPercentage > 0 ? '+' : ''}${returnPercentage.toFixed(2)}%</span>
      </div>
    </div>
    
    <div class="footer-branding">
      <div class="footer-text">DarkPool App</div>
    </div>
  </div>
  
  <script>
    // Signal that the page is loaded
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
    }
  </script>
</body>
</html>
    `;
  };

  const handleExport = async () => {
    if (!viewShotRef.current || !isWebViewReady) {
      Alert.alert('שגיאה', 'נא להמתין עד שהדף יטען');
      return;
    }

    try {
      setIsExporting(true);

      // המתן קצת כדי שהדף יטען לגמרי
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Capturing WebView...');

      // צלם את ה-View שמכיל את ה-WebView
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      console.log('WebView captured:', uri);

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
    } catch (error: any) {
      console.error('Error exporting trade image:', error);
      Alert.alert('שגיאה', 'לא ניתן ליצור תמונה: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setIsWebViewReady(true);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
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
          <View ref={viewShotRef} collapsable={false} style={styles.tradeCard}>
            <WebView
              ref={webViewRef}
              source={{ html: generateHTML() }}
              style={styles.webView}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => setIsWebViewReady(true)}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            />
          </View>
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
    maxWidth: 500,
    borderRadius: tokens.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  webView: {
    backgroundColor: 'transparent',
    width: '100%',
    minHeight: 600,
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
