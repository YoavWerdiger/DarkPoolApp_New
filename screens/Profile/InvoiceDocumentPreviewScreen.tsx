import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ExternalLink, Share2 } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { cardcomDocumentTypeLabelHe } from '../../utils/cardcomDocumentLabels';

type PreviewParams = {
  url: string;
  documentType?: string | null;
  documentNumber?: number | null;
  title?: string;
};

function looksLikePdf(url: string): boolean {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.pdf') || /[?&](?:type|format)=pdf\b/i.test(url);
}

/** Android WebView often won't inline PDFs; Google Docs viewer is a pragmatic fallback. */
function webViewSourceUri(url: string): string {
  if (Platform.OS === 'android' && looksLikePdf(url)) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function InvoiceDocumentPreviewScreen({ navigation, route }: any) {
  const tokens = useDesignTokens();
  const params = (route?.params || {}) as PreviewParams;
  const url = typeof params.url === 'string' ? params.url.trim() : '';
  const typeLabel = cardcomDocumentTypeLabelHe(params.documentType);
  const title =
    (typeof params.title === 'string' && params.title.trim()) ||
    typeLabel ||
    'קבלה / חשבונית';

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sourceUri = useMemo(() => (url ? webViewSourceUri(url) : ''), [url]);

  const openExternal = async () => {
    void HapticFeedback.impactLight();
    if (!url) return;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  const shareDocument = async () => {
    void HapticFeedback.selection();
    if (!url) return;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url, message: title }
          : { message: `${title}\n${url}` },
      );
    } catch {
      // user dismissed share sheet
    }
  };

  if (!url.startsWith('http')) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title={title} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: tokens.colors.text.primary }]}>
            קישור המסמך אינו תקין
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={{ color: tokens.colors.primary.main, fontWeight: '700' }}>חזרה</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ChatSubScreenHeader
        title={title}
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
        rightSlot={
          <DayNavBlurButton
            onPress={() => void shareDocument()}
            size={DRAWER_MENU_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="שתף"
          >
            <Share2 size={18} color={tokens.colors.text.primary} strokeWidth={2.2} />
          </DayNavBlurButton>
        }
      />

      {params.documentNumber != null ? (
        <Text style={[styles.meta, { color: tokens.colors.text.tertiary }]}>
          מס׳ מסמך {params.documentNumber}
          {typeLabel ? ` · ${typeLabel}` : ''}
        </Text>
      ) : null}

      <View style={styles.webWrap}>
        {failed ? (
          <View style={styles.center}>
            <Text style={[styles.errorTitle, { color: tokens.colors.text.primary }]}>
              לא הצלחנו להציג את המסמך כאן
            </Text>
            <Text style={[styles.errorBody, { color: tokens.colors.text.secondary }]}>
              אפשר לפתוח אותו בדפדפן המערכת.
            </Text>
            <TouchableOpacity
              onPress={() => void openExternal()}
              activeOpacity={0.8}
              style={[
                styles.primaryBtn,
                { backgroundColor: tokens.colors.primary.main },
              ]}
            >
              <ExternalLink size={16} color={tokens.colors.text.inverse} strokeWidth={2.4} />
              <Text style={[styles.primaryBtnText, { color: tokens.colors.text.inverse }]}>
                פתח בדפדפן
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: sourceUri }}
            style={styles.webView}
            startInLoadingState
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onHttpError={() => {
              setLoading(false);
              setFailed(true);
            }}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={tokens.colors.primary.main} />
              </View>
            )}
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            originWhitelist={['*']}
          />
        )}
        {loading && !failed ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: chatPalette.glassBorder,
            backgroundColor: 'rgba(10,14,10,0.92)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => void openExternal()}
          activeOpacity={0.8}
          style={[
            styles.footerBtn,
            {
              borderColor: chatPalette.glassBorder,
              backgroundColor: `${tokens.colors.primary.main}14`,
            },
          ]}
        >
          <ExternalLink size={16} color={tokens.colors.primary.main} strokeWidth={2.4} />
          <Text style={{ color: tokens.colors.primary.main, fontWeight: '700', fontSize: 14 }}>
            פתח בדפדפן
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E0A',
  },
  meta: {
    textAlign: 'center',
    writingDirection: 'rtl',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  webWrap: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111611',
  },
  webView: {
    flex: 1,
    backgroundColor: '#111611',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,10,0.55)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  errorBody: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 18,
    marginBottom: 6,
  },
  primaryBtn: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
