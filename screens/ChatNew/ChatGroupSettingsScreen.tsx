import { UI_DIR } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
// ============================================
// Chat Group Settings — privacy, photo, mute, edit info
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { scheduleAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '../../context/ChatContext';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatRtlRoot, chatRtlRow, chatRtlText } from '../../components/chat/chatDesignTokens';
import {
  settingsRowType,
  settingsBodyType,
  settingsMetaType,
} from '../../components/profile/settingsType';
import { useGroupNotificationMute } from '../../hooks/useGroupNotificationMute';

export default function ChatGroupSettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const DesignTokens = useDesignTokens();
  const { theme } = useTheme();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, updateGroup, refreshCurrentGroupDetails } = useChat();

  const { muted: isMuted, toggleMuted } = useGroupNotificationMute(
    groupId,
    !!currentGroup?.is_muted,
  );
  const [isPublic, setIsPublic] = useState(currentGroup?.settings?.is_public !== false);
  const [isAnnouncement, setIsAnnouncement] = useState(
    !!(currentGroup?.settings?.is_announcement || currentGroup?.settings?.onlyAdminsCanSend)
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptMultiline, setPromptMultiline] = useState(false);
  const [promptCallback, setPromptCallback] = useState<((value: string) => void) | null>(null);

  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const isAdmin = currentGroup?.is_admin || false;
  const disclosureIcon = 'chevron-back' as const;

  useFocusEffect(
    useCallback(() => {
      return scheduleAfterNavigationTransition(navigation, () => {
        void refreshCurrentGroupDetails();
      });
    }, [navigation, refreshCurrentGroupDetails])
  );

  useEffect(() => {
    setIsPublic(currentGroup?.settings?.is_public !== false);
    setIsAnnouncement(
      !!(currentGroup?.settings?.is_announcement || currentGroup?.settings?.onlyAdminsCanSend)
    );
  }, [currentGroup?.settings]);

  const showPrompt = (
    title: string,
    defaultValue: string,
    callback: (value: string) => void,
    multiline = false
  ) => {
    setPromptTitle(title);
    setPromptValue(defaultValue);
    setPromptMultiline(multiline);
    setPromptCallback(() => callback);
    setPromptVisible(true);
  };

  const renderSectionCaption = (label: string) => (
    <View style={styles.sectionCaptionWrap}>
      <Text style={styles.sectionCaption}>{label}</Text>
    </View>
  );

  const renderSettingIcon = (name: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.settingIconWrap}>
      <Ionicons name={name} size={20} color={DesignTokens.colors.primary.main} />
    </View>
  );

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const handleToggleMute = async (value: boolean) => {
    const { success } = await toggleMuted(value);
    if (!success) {
      legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s2'));
      return;
    }
    await refreshCurrentGroupDetails();
  };

  const handleRename = () => {
    if (!isAdmin || !currentGroup) return;
    showPrompt(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s3'), currentGroup.name || '', async (newName) => {
      if (!newName?.trim()) return;
      const { success, error } = await updateGroup(groupId, { name: newName.trim() });
      if (!success) {
        legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s4'));
      }
    });
  };

  const handleEditDescription = () => {
    if (!isAdmin || !currentGroup) return;
    showPrompt(
      i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s5'),
      currentGroup.description || '',
      async (description) => {
        const { success, error } = await updateGroup(groupId, {
          description: description.trim(),
        });
        if (!success) {
          legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s6'));
        }
      },
      true
    );
  };

  const handleChangePhoto = async () => {
    if (!isAdmin) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s7'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingAvatar(true);
      const upload = await mediaService.uploadMedia(result.assets[0].uri, 'image');
      if (!upload.success || !upload.url) {
        legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), upload.error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s8'));
        return;
      }

      const { success, error } = await updateGroup(groupId, { avatar_url: upload.url });
      if (!success) {
        legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s9'));
      }
    } catch {
      legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s10'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleTogglePublic = async (value: boolean) => {
    if (!isAdmin) return;
    setIsPublic(value);
    const { success, error } = await updateGroup(groupId, {
      settings: { is_public: value },
    });
    if (!success) {
      setIsPublic(!value);
      legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s11'));
    }
  };

  const handleToggleAnnouncement = async (value: boolean) => {
    if (!isAdmin) return;
    setIsAnnouncement(value);
    const { success, error } = await updateGroup(groupId, {
      settings: {
        is_announcement: value,
        onlyAdminsCanSend: value,
      },
    });
    if (!success) {
      setIsAnnouncement(!value);
      legacyAlert(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s1'), error || i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s12'));
    }
  };

  const handlePrivacyAndSupport = () => {
    (navigation as any).navigate('PrivacySupport');
  };

  if (!groupId || !currentGroup) {
    return (
      <ChatScreenShell>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ChatSubScreenHeader title={i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s13')} onBack={handleBack} />
          <View style={styles.errorStateBody}>
            <Text style={styles.errorText}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s14')}</Text>
          </View>
        </SafeAreaView>
      </ChatScreenShell>
    );
  }

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title={i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s13')} onBack={handleBack} />

        <View style={styles.rtlRoot}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.sectionBlock}>
              {renderSectionCaption(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s15'))}
              <UICard variant="soft" padding="none" style={styles.sectionCard}>
                <View style={styles.settingRow}>
                  {renderSettingIcon('notifications-outline')}
                  <Text style={styles.settingTextGrow}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s15')}</Text>
                  {/* דלוק = מקבלים התראות (אחיד עם פרטי הקבוצה ומסך ההתראות) */}
                  <AppSwitch
                    value={!isMuted}
                    onValueChange={(on) => { void handleToggleMute(!on); }}
                    trackColor={{
                      false: theme.switchTrackOff,
                      true: DesignTokens.colors.primary.main,
                    }}
                    thumbColor={!isMuted ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                    ios_backgroundColor={theme.switchTrackOff}
                    style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
                  />
                </View>
              </UICard>
            </View>

            {isAdmin ? (
              <View style={styles.sectionBlock}>
                {renderSectionCaption(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s16'))}
                <UICard variant="soft" padding="none" style={styles.sectionCard}>
                  <TouchableOpacity
                    style={styles.photoRow}
                    onPress={() => {
                      void HapticFeedback.selection();
                      void handleChangePhoto();
                    }}
                    activeOpacity={0.7}
                    disabled={uploadingAvatar}
                  >
                    <View style={styles.avatarPreviewWrap}>
                      {currentGroup.avatar_url ? (
                        <Image source={{ uri: currentGroup.avatar_url }} style={styles.avatarPreview} />
                      ) : (
                        <View style={styles.avatarPreviewPlaceholder}>
                          <Ionicons name="people" size={28} color={DesignTokens.colors.text.secondary} />
                        </View>
                      )}
                      {uploadingAvatar ? (
                        <View style={styles.avatarBusy}>
                          <ActivityIndicator color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.photoTextWrap}>
                      <Text style={styles.settingText}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s17')}</Text>
                      <Text style={styles.settingHint}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s18')}</Text>
                    </View>
                    <Ionicons name={disclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => {
                      void HapticFeedback.selection();
                      handleRename();
                    }}
                    activeOpacity={0.7}
                  >
                    {renderSettingIcon('create-outline')}
                    <Text style={styles.settingTextGrow}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s3')}</Text>
                    <Ionicons name={disclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => {
                      void HapticFeedback.selection();
                      handleEditDescription();
                    }}
                    activeOpacity={0.7}
                  >
                    {renderSettingIcon('document-text-outline')}
                    <Text style={styles.settingTextGrow}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s5')}</Text>
                    <Ionicons name={disclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                </UICard>
              </View>
            ) : null}

            {isAdmin ? (
              <View style={styles.sectionBlock}>
                {renderSectionCaption(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s19'))}
                <UICard variant="soft" padding="none" style={styles.sectionCard}>
                  <View style={styles.settingRow}>
                    {renderSettingIcon(isPublic ? 'globe-outline' : 'lock-closed-outline')}
                    <View style={styles.settingTextWrap}>
                      <Text style={styles.settingText}>{isPublic ? i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s20') : i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s21')}</Text>
                      <Text style={styles.settingHint}>
                        {isPublic ? i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s22') : i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s23')}
                      </Text>
                    </View>
                    <AppSwitch
                      value={isPublic}
                      onValueChange={(v) => {
                        void HapticFeedback.selection();
                        void handleTogglePublic(v);
                      }}
                      trackColor={{
                        false: DesignTokens.colors.background.tertiary,
                        true: DesignTokens.colors.primary.main,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.settingRow}>
                    {renderSettingIcon('megaphone-outline')}
                    <View style={styles.settingTextWrap}>
                      <Text style={styles.settingText}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s24')}</Text>
                      <Text style={styles.settingHint}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s25')}</Text>
                    </View>
                    <AppSwitch
                      value={isAnnouncement}
                      onValueChange={(v) => {
                        void HapticFeedback.selection();
                        void handleToggleAnnouncement(v);
                      }}
                      trackColor={{
                        false: DesignTokens.colors.background.tertiary,
                        true: DesignTokens.colors.primary.main,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </UICard>
              </View>
            ) : null}

            <View style={styles.sectionBlock}>
              {renderSectionCaption(i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s26'))}
              <UICard variant="soft" padding="none" style={styles.sectionCard}>
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    void HapticFeedback.selection();
                    handlePrivacyAndSupport();
                  }}
                  activeOpacity={0.7}
                >
                  {renderSettingIcon('shield-outline')}
                  <Text style={styles.settingTextGrow}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s27')}</Text>
                  <Ionicons name={disclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                </TouchableOpacity>
              </UICard>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => setPromptVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.promptOverlay}>
          <View style={styles.promptContainer}>
            <Text style={styles.promptTitle}>{promptTitle}</Text>
            <TextInput
              style={[styles.promptInput, promptMultiline && styles.promptInputMultiline]}
              value={promptValue}
              onChangeText={setPromptValue}
              autoFocus
              multiline={promptMultiline}
              placeholderTextColor="rgba(148,163,184,0.6)"
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setPromptVisible(false)} style={styles.promptBtn}>
                <Text style={styles.promptBtnCancel}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s28')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPromptVisible(false);
                  promptCallback?.(promptValue);
                }}
                style={[styles.promptBtn, styles.promptBtnConfirmBg]}
              >
                <Text style={styles.promptBtnConfirm}>{i18n.t('auto.screens__ChatNew__ChatGroupSettingsScreen.s29')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ChatScreenShell>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    rtlRoot: chatRtlRoot,
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: tokens.spacing.base,
      paddingTop: tokens.spacing.md,
      paddingBottom: tokens.spacing['3xl'],
    },
    errorStateBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.base,
    },
    sectionBlock: {
      marginBottom: tokens.spacing.lg,
    },
    sectionCard: {
      borderRadius: tokens.borderRadius.xl,
      backgroundColor: tokens.colors.background.cardSolid,
    },
    sectionCaptionWrap: {
      alignSelf: 'stretch',
      width: '100%',
    },
    sectionCaption: {
      ...chatRtlText,
      ...settingsRowType,
      color: tokens.colors.text.tertiary,
      marginBottom: tokens.spacing.sm,
    },
    settingRow: {
      ...chatRtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.base,
      gap: tokens.spacing.md,
    },
    photoRow: {
      ...chatRtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.base,
      gap: tokens.spacing.md,
    },
    avatarPreviewWrap: {
      position: 'relative',
      width: 56,
      height: 56,
    },
    avatarPreview: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
    },
    avatarPreviewPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: tokens.colors.background.tertiary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
    },
    avatarBusy: {
      ...StyleSheet.absoluteFill,
      borderRadius: 28,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoTextWrap: {
      flex: 1,
      alignItems: 'flex-start',
      gap: 2,
    },
    settingTextWrap: {
      flex: 1,
      alignItems: 'flex-start',
      gap: 2,
    },
    settingIconWrap: {
      width: 36,
      height: 36,
      borderRadius: tokens.borderRadius.sm,
      backgroundColor: `${tokens.colors.primary.main}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingText: {
      ...chatRtlText,
      ...settingsRowType,
      color: tokens.colors.text.primary,
    },
    settingTextGrow: {
      ...chatRtlText,
      ...settingsRowType,
      flex: 1,
      color: tokens.colors.text.primary,
    },
    settingHint: {
      ...chatRtlText,
      ...settingsMetaType,
      color: tokens.colors.text.tertiary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: tokens.spacing.base,
    },
    errorText: {
      ...chatRtlText,
      ...settingsBodyType,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    promptOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: tokens.colors.background.overlay,
    },
    promptContainer: {
      width: '85%',
      backgroundColor: tokens.colors.glass.card.bg,
      borderRadius: tokens.borderRadius.lg,
      padding: tokens.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      direction: UI_DIR,
    },
    promptTitle: {
      ...chatRtlText,
      ...settingsRowType,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.base,
    },
    promptInput: {
      ...chatRtlText,
      ...settingsBodyType,
      backgroundColor: tokens.colors.background.input,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      color: tokens.colors.text.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
    },
    promptInputMultiline: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    promptButtons: {
      ...chatRtlRow,
      justifyContent: 'flex-start',
      gap: tokens.spacing.md,
      marginTop: tokens.spacing.lg,
    },
    promptBtn: {
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: tokens.spacing.sm + 2,
      borderRadius: tokens.borderRadius.md,
    },
    promptBtnCancel: {
      ...chatRtlText,
      ...settingsBodyType,
      color: tokens.colors.text.secondary,
    },
    promptBtnConfirmBg: {
      backgroundColor: '#FFFFFF',
    },
    promptBtnConfirm: {
      ...settingsRowType,
      color: tokens.colors.text.inverse,
    },
  });
