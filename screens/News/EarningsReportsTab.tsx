import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart3 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';


export default function EarningsReportsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
    Alert.alert('שגיאה', 'לא ניתן לטעון את לוח דיווחי התוצאות. אנא בדוק את החיבור לאינטרנט.');
  };

  // HTML עם ה-iframe של Earnings Hub
  const earningsHubHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0A0A0A;
          overflow-x: hidden;
        }
        iframe {
          width: 100%;
          height: 600px;
          border: none;
          position: absolute;
          top: 0;
          left: 0;
        }
      </style>
    </head>
    <body>
      <iframe
        src="https://earningshub.com/embed/calendar?theme=dark&calendarView=list&filter=one_billion"
        title="Earnings Hub Calendar"
        allowfullscreen>
      </iframe>
    </body>
    </html>
  `;

  return (
    <View className="flex-1" style={{ backgroundColor: DesignTokens.colors.background.primary, marginBottom: 0 }}>
      {error ? (
        <View className="flex-1 justify-center items-center px-6">
          <BarChart3 size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
          <Text 
            className="text-lg font-medium mt-4 text-center"
            style={{ color: DesignTokens.colors.text.primary }}
          >
            שגיאה בטעינת דיווחי התוצאות
          </Text>
          <Text 
            className="text-sm mt-2 text-center"
            style={{ color: DesignTokens.colors.text.secondary }}
          >
            אנא בדוק את החיבור לאינטרנט
          </Text>
        </View>
      ) : (
        <>
          {loading && (
            <View className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center z-10">
              <View 
                className="px-6 py-4 rounded-2xl items-center"
                style={{ backgroundColor: DesignTokens.colors.background.secondary }}
              >
                <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
                <Text 
                  className="mt-3 text-sm"
                  style={{ color: DesignTokens.colors.text.secondary }}
                >
                  טוען דיווחי תוצאות...
                </Text>
              </View>
            </View>
          )}
          
          <WebView
            source={{ html: earningsHubHTML }}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            style={{ 
              flex: 1,
              backgroundColor: DesignTokens.colors.background.primary,
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="compatibility"
            bounces={false}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
            renderError={() => (
              <View 
                className="flex-1 justify-center items-center"
                style={{ backgroundColor: DesignTokens.colors.background.primary }}
              >
                <BarChart3 size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
                <Text 
                  className="text-lg font-medium mt-4 text-center"
                  style={{ color: DesignTokens.colors.text.primary }}
                >
                  שגיאה בטעינת דיווחי התוצאות
                </Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
