import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LINKS } from '../../utils/appMeta';

type LegalKind = 'privacy' | 'terms';

export default function LegalWebViewScreen({ navigation, route }: any) {
  const tokens = useDesignTokens();
  const kind: LegalKind = route?.params?.kind === 'terms' ? 'terms' : 'privacy';
  const url = kind === 'terms' ? APP_LINKS.terms : APP_LINKS.privacy;
  const title = kind === 'terms' ? 'תנאי שימוש' : 'מדיניות פרטיות';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E0A' }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={title} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: '#0A0E0A' }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0E0A',
  },
});
