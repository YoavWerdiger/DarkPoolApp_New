// ============================================
// Privacy & Support Screen
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';

export default function PrivacySupportScreen() {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@darkpool.co.il').catch(() =>
      legacyAlert('שגיאה', 'לא ניתן לפתוח את דוא"ל התמיכה')
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://darkpool.site/privacy').catch(() =>
      legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור')
    );
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://darkpool.site/terms').catch(() =>
      legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור')
    );
  };

  const handleFAQ = () => {
    Linking.openURL('https://darkpool.site/faq').catch(() =>
      legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור')
    );
  };

  const handleReportIssue = () => {
    legacyAlert(
      'דיווח על בעיה',
      'איך תרצה לדווח?',
      [
        { text: 'דוא"ל', onPress: () => Linking.openURL('mailto:report@darkpool.co.il').catch(() => legacyAlert('שגיאה', 'לא ניתן לפתוח אפליקציית דוא"ל')) },
        { text: 'ביטול', style: 'cancel' },
      ]
    );
  };

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="פרטיות ותמיכה" onBack={handleBack} />

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
            <TouchableOpacity style={styles.optionRow} onPress={handleFAQ}>
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
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>אייקונים</Text>
              <Text style={[styles.infoValue, { fontSize: DesignTokens.typography.fontSize.xs }]}>
                <Text>Icons by </Text>
                <Text 
                  style={{ color: DesignTokens.colors.primary.main }}
                  onPress={() => Linking.openURL('https://lordicon.com/').catch(() => {})}
                >
                  Lordicon.com
                </Text>
              </Text>
            </View>
          </UICard>
        </ScrollView>
      </SafeAreaView>
    </ChatScreenShell>
  );
}

const createStyles = (DesignTokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
  },
  optionLeft: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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

