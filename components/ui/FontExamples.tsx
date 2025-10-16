import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DesignTokens } from './DesignTokens';

/**
 * דוגמאות לשימוש בפונט Assistant ExtraBold
 * 
 * שימוש:
 * import FontExamples from '../components/ui/FontExamples';
 * 
 * <FontExamples />
 */
export default function FontExamples() {
  return (
    <View style={styles.container}>
      {/* דוגמה 1: שימוש עם DesignTokens */}
      <Text style={styles.example1}>
        כותרת ראשית בפונט Assistant ExtraBold
      </Text>
      
      {/* דוגמה 2: שימוש עם Tailwind CSS */}
      <Text className="font-assistant text-xl font-extrabold text-white">
        כותרת משנית בפונט Assistant ExtraBold
      </Text>
      
      {/* דוגמה 3: שימוש ישיר */}
      <Text style={styles.example3}>
        טקסט רגיל בפונט Assistant ExtraBold
      </Text>
      
      {/* דוגמה 4: שילוב עם עברית ואנגלית */}
      <Text style={styles.example4}>
        Hebrew text with English words in Assistant ExtraBold
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#121212',
  },
  
  // דוגמה 1: עם DesignTokens
  example1: {
    fontFamily: DesignTokens.typography.fontFamily.assistant,
    fontWeight: DesignTokens.typography.fontWeight.extrabold,
    fontSize: DesignTokens.typography.fontSize['2xl'],
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'right',
  },
  
  // דוגמה 3: שימוש ישיר
  example3: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'right',
  },
  
  // דוגמה 4: שילוב שפות
  example4: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 16,
    fontWeight: '800',
    color: '#00E654',
    marginBottom: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

/**
 * פונקציות עזר לשימוש בפונט
 */
export const AssistantFontStyles = {
  // כותרת ראשית
  heading1: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right' as const,
  },
  
  // כותרת משנית
  heading2: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right' as const,
  },
  
  // טקסט מודגש
  emphasis: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 16,
    fontWeight: '800',
    color: '#00E654',
    textAlign: 'right' as const,
  },
  
  // כותרת קטנה
  smallHeading: {
    fontFamily: 'Assistant-ExtraBold',
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right' as const,
  },
};

/**
 * Hook לשימוש בפונט Assistant
 */
export const useAssistantFont = () => {
  return {
    fontFamily: 'Assistant-ExtraBold',
    fontWeight: '800',
  };
};



