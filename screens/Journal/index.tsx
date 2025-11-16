import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Wifi } from 'lucide-react-native';
import { DesignTokens } from '../../components/ui/DesignTokens';

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLoadStart = () => {
    // נקה timeout קודם אם קיים
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setLoading(true);
    setError(false);
    
    // גיבוי - הסתר את הטוען אחרי 10 שניות גם אם הדף לא נטען
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 10000);
  };

  const handleLoad = () => {
    // נקה את ה-timeout כשהדף נטען
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setLoading(false);
  };

  const handleError = () => {
    // נקה את ה-timeout במקרה של שגיאה
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setLoading(false);
    setError(true);
    Alert.alert('שגיאה', 'לא ניתן לטעון את האתר. אנא בדוק את החיבור לאינטרנט.');
  };

  const handleRefresh = () => {
    setError(false);
    setLoading(true);
  };

  // נקה את ה-timeout כשהקומפוננטה נהרסת
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: DesignTokens.colors.background.primary }}>
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      {/* Header קטן עם SafeArea */}
      <SafeAreaView 
        style={{ 
          backgroundColor: DesignTokens.colors.background.primary,
          paddingTop: -50,
        }}
      >
      </SafeAreaView>

      {/* WebView Container */}
      <View className="flex-1" style={{ backgroundColor: DesignTokens.colors.background.primary }}>
        {error ? (
          <View className="flex-1 justify-center items-center px-6">
            <Wifi size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
            <Text 
              className="text-lg font-medium mt-4 text-center"
              style={{ color: DesignTokens.colors.text.primary }}
            >
              שגיאה בטעינת האתר
            </Text>
            <Text 
              className="text-sm mt-2 text-center"
              style={{ color: DesignTokens.colors.text.secondary }}
            >
              אנא בדוק את החיבור לאינטרנט ונסה שוב
            </Text>
            <Pressable
              onPress={handleRefresh}
              className="mt-6 px-6 py-3 rounded-full"
              style={{ backgroundColor: DesignTokens.colors.primary.main }}
            >
              <Text 
                className="font-medium"
                style={{ color: DesignTokens.colors.text.primary }}
              >
                נסה שוב
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {loading && (
              <View className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center z-10">
                <View 
                  className="px-6 py-4 rounded-2xl items-center"
                  style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
                >
                  <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
                  <Text 
                    className="mt-3 text-sm"
                    style={{ color: DesignTokens.colors.text.secondary }}
                  >
                    טוען את האתר...
                  </Text>
                </View>
              </View>
            )}
            
            <View style={{ 
              flex: 1, 
              backgroundColor: DesignTokens.colors.background.primary,
              overflow: 'hidden'
            }}>
              <WebView
                source={{ uri: 'https://mtrx-trading.com/' }}
                onLoadStart={handleLoadStart}
                onLoad={handleLoad}
                onError={handleError}
                style={{ 
                  flex: 1,
                  backgroundColor: DesignTokens.colors.background.primary,
                }}
                // Core settings - supported on both platforms
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode="compatibility"
                // Android-specific props
                scalesPageToFit={true}
                nestedScrollEnabled={true}
                overScrollMode="never"
                // iOS-specific props (will be ignored on Android)
                bounces={false}
                scrollEnabled={true}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                automaticallyAdjustContentInsets={false}
                // User agent
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
                // Injected JavaScript for styling
                injectedJavaScript={`
                  document.body.style.backgroundColor = '#0A0A0A';
                  document.documentElement.style.backgroundColor = '#0A0A0A';
                  document.body.style.overflow = 'hidden';
                  document.documentElement.style.overflow = 'hidden';
                  true;
                `}
                // Error rendering
                renderError={() => (
                  <View 
                    className="flex-1 justify-center items-center"
                    style={{ backgroundColor: DesignTokens.colors.background.primary }}
                  >
                    <Wifi size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
                    <Text 
                      className="text-lg font-medium mt-4 text-center"
                      style={{ color: DesignTokens.colors.text.primary }}
                    >
                      שגיאה בטעינת האתר
                    </Text>
                  </View>
                )}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}