// ============================================
// Privacy & Support Screen
// ============================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';

export default function PrivacySupportScreen() {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();

  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContactSupport = () => {
    // TODO: Open support email or chat
    Alert.alert('תמיכה', 'יצירת קשר עם התמיכה: support@darkpool.co.il');
    Linking.openURL('mailto:support@darkpool.co.il').catch(() => {});
  };

  const handlePrivacyPolicy = () => {
    // TODO: Open privacy policy URL
    Linking.openURL('https://darkpool.co.il/privacy').catch(() => {
      Alert.alert('מדיניות פרטיות', 'הקישור יפתח כאן');
    });
  };

  const handleTermsOfService = () => {
    // TODO: Open terms URL
    Linking.openURL('https://darkpool.co.il/terms').catch(() => {
      Alert.alert('תנאי שירות', 'הקישור יפתח כאן');
    });
  };

  const handleReportIssue = () => {
    Alert.alert(
      'דיווח על בעיה',
      'איך תרצה לדווח?',
      [
        { text: 'דוא"ל', onPress: () => Linking.openURL('mailto:report@darkpool.co.il').catch(() => {}) },
        { text: 'ביטול', style: 'cancel' },
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <UICard
          variant="blur"
          padding="md"
          style={{
            marginHorizontal: 0,
            marginTop: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: DesignTokens.borderRadius['2xl'],
            borderBottomRightRadius: DesignTokens.borderRadius['2xl'],
          }}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>פרטיות ותמיכה</Text>
            <View style={{ width: 32 }} />
          </View>
        </UICard>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Privacy Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>פרטיות</Text>
            <TouchableOpacity style={styles.optionRow} onPress={handlePrivacyPolicy}>
              <View style={styles.optionLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>מדיניות פרטיות</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleTermsOfService}>
              <View style={styles.optionLeft}>
                <Ionicons name="document-text-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>תנאי שירות</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* Support Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>תמיכה</Text>
            <TouchableOpacity style={styles.optionRow} onPress={handleContactSupport}>
              <View style={styles.optionLeft}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>צור קשר עם התמיכה</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleReportIssue}>
              <View style={styles.optionLeft}>
                <Ionicons name="flag-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>דווח על בעיה</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Ionicons name="help-circle-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>שאלות נפוצות</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* About Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>אודות</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>גרסה</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DarkPool</Text>
              <Text style={styles.infoValue}>© 2024 כל הזכויות שמורות</Text>
            </View>
          </UICard>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (DesignTokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 50,
  },
  headerTitle: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
    color: DesignTokens.colors.text.primary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingTop: DesignTokens.spacing.lg,
    paddingBottom: DesignTokens.spacing['3xl'],
  },
  sectionTitle: {
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    color: DesignTokens.colors.text.secondary,
    marginBottom: DesignTokens.spacing.md,
    textAlign: 'right',
  },
  optionRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  optionLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  optionText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.text.primary,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: DesignTokens.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.sm,
  },
  infoLabel: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.secondary,
  },
  infoValue: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.primary,
  },
});

