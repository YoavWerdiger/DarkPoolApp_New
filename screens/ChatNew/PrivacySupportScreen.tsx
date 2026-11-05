import i18n from '../../lib/i18n';
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
import {
  settingsHebrewText,
  settingsRowType,
  settingsCaptionType,
} from '../../components/profile/settingsType';

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
      legacyAlert(i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s1'), i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s2'))
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://darkpool.site/privacy').catch(() =>
      legacyAlert(i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s1'), i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s3'))
    );
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://darkpool.site/terms').catch(() =>
      legacyAlert(i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s1'), i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s3'))
    );
  };

  const handleFAQ = () => {
    Linking.openURL('https://darkpool.site/faq').catch(() =>
      legacyAlert(i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s1'), i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s3'))
    );
  };

  const handleReportIssue = () => {
    legacyAlert(
      i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s4'),
      i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s5'),
      [
        { text: i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s6'), onPress: () => Linking.openURL('mailto:report@darkpool.co.il').catch(() => legacyAlert(i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s1'), i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s7'))) },
        { text: i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s8'), style: 'cancel' },
      ]
    );
  };

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title={i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s9')} onBack={handleBack} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Privacy Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s10')}</Text>
            <TouchableOpacity style={styles.optionRow} onPress={handlePrivacyPolicy}>
              <View style={styles.optionLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s11')}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleTermsOfService}>
              <View style={styles.optionLeft}>
                <Ionicons name="document-text-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s12')}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* Support Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s13')}</Text>
            <TouchableOpacity style={styles.optionRow} onPress={handleContactSupport}>
              <View style={styles.optionLeft}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s14')}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleReportIssue}>
              <View style={styles.optionLeft}>
                <Ionicons name="flag-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s15')}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleFAQ}>
              <View style={styles.optionLeft}>
                <Ionicons name="help-circle-outline" size={20} color={DesignTokens.colors.text.secondary} />
                <Text style={styles.optionText}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s16')}</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={DesignTokens.colors.text.tertiary} />
            </TouchableOpacity>
          </UICard>

          {/* About Section */}
          <UICard variant="blur" padding="lg" style={{ marginBottom: DesignTokens.spacing.lg }}>
            <Text style={styles.sectionTitle}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s17')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s18')}</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DarkPool</Text>
              <Text style={styles.infoValue}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s19')}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{i18n.t('auto.screens__ChatNew__PrivacySupportScreen.s20')}</Text>
              <Text style={[styles.infoValue, settingsCaptionType]}>
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
    ...settingsHebrewText,
    ...settingsRowType,
    color: DesignTokens.colors.text.secondary,
    marginBottom: DesignTokens.spacing.md,
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
    ...settingsHebrewText,
    ...settingsRowType,
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
    ...settingsHebrewText,
    ...settingsCaptionType,
    color: DesignTokens.colors.text.secondary,
  },
  infoValue: {
    ...settingsCaptionType,
    color: DesignTokens.colors.text.primary,
  },
});

