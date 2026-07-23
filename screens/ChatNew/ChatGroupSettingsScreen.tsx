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
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatGroupService } from '../../services/chat';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatRtlRoot, chatRtlRow, chatRtlText } from '../../components/chat/chatDesignTokens';

export default function ChatGroupSettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId } = route.params as { groupId: string };
  const { currentGroup, updateGroup, refreshCurrentGroupDetails } = useChat();

  const [isMuted, setIsMuted] = useState(currentGroup?.is_muted || false);
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
      void refreshCurrentGroupDetails();
    }, [refreshCurrentGroupDetails])
  );

  useEffect(() => {
    setIsMuted(currentGroup?.is_muted || false);
    setIsPublic(currentGroup?.settings?.is_public !== false);
    setIsAnnouncement(
      !!(currentGroup?.settings?.is_announcement || currentGroup?.settings?.onlyAdminsCanSend)
    );
  }, [currentGroup?.is_muted, currentGroup?.settings]);

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
    setIsMuted(value);
    if (!user?.id) return;
    const { success } = await chatGroupService.toggleGroupMute(groupId, user.id, value);
    if (!success) {
      setIsMuted(!value);
      legacyAlert('שגיאה', 'לא ניתן לשנות את הגדרות ההשתקה');
    }
  };

  const handleRename = () => {
    if (!isAdmin || !currentGroup) return;
    showPrompt('שנה שם קבוצה', currentGroup.name || '', async (newName) => {
      if (!newName?.trim()) return;
      const { success, error } = await updateGroup(groupId, { name: newName.trim() });
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן לעדכן את שם הקבוצה');
      }
    });
  };

  const handleEditDescription = () => {
    if (!isAdmin || !currentGroup) return;
    showPrompt(
      'ערוך תיאור',
      currentGroup.description || '',
      async (description) => {
        const { success, error } = await updateGroup(groupId, {
          description: description.trim(),
        });
        if (!success) {
          legacyAlert('שגיאה', error || 'לא ניתן לעדכן את התיאור');
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
        legacyAlert('שגיאה', 'נדרשת הרשאה לגישה לתמונות');
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
        legacyAlert('שגיאה', upload.error || 'העלאת תמונת הקבוצה נכשלה');
        return;
      }

      const { success, error } = await updateGroup(groupId, { avatar_url: upload.url });
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן לעדכן את תמונת הקבוצה');
      }
    } catch {
      legacyAlert('שגיאה', 'שגיאה בבחירת תמונה');
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
      legacyAlert('שגיאה', error || 'לא ניתן לעדכן את פרטיות הקבוצה');
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
      legacyAlert('שגיאה', error || 'לא ניתן לעדכן את הגדרות השליחה');
    }
  };

  const handlePrivacyAndSupport = () => {
    (navigation as any).navigate('PrivacySupport');
  };

  if (!groupId || !currentGroup) {
    return (
      <ChatScreenShell>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ChatSubScreenHeader title="הגדרות קבוצה" onBack={handleBack} />
          <View style={styles.errorStateBody}>
            <Text style={styles.errorText}>לא נמצאה קבוצה</Text>
          </View>
        </SafeAreaView>
      </ChatScreenShell>
    );
  }

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="הגדרות קבוצה" onBack={handleBack} />

        <View style={styles.rtlRoot}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.sectionBlock}>
              {renderSectionCaption('התראות')}
              <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
                <View style={styles.settingRow}>
                  {renderSettingIcon('notifications-outline')}
                  <Text style={styles.settingTextGrow}>השתק התראות</Text>
                  <Switch
                    value={isMuted}
                    onValueChange={handleToggleMute}
                    trackColor={{
                      false: DesignTokens.colors.background.tertiary,
                      true: DesignTokens.colors.primary.main,
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </UICard>
            </View>

            {isAdmin ? (
              <View style={styles.sectionBlock}>
                {renderSectionCaption('תמונה ופרטים')}
                <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
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
                      <Text style={styles.settingText}>שנה תמונת קבוצה</Text>
                      <Text style={styles.settingHint}>בחר תמונה מהגלריה</Text>
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
                    <Text style={styles.settingTextGrow}>שנה שם קבוצה</Text>
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
                    <Text style={styles.settingTextGrow}>ערוך תיאור</Text>
                    <Ionicons name={disclosureIcon} size={20} color={DesignTokens.colors.text.tertiary} />
                  </TouchableOpacity>
                </UICard>
              </View>
            ) : null}

            {isAdmin ? (
              <View style={styles.sectionBlock}>
                {renderSectionCaption('פרטיות')}
                <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
                  <View style={styles.settingRow}>
                    {renderSettingIcon(isPublic ? 'globe-outline' : 'lock-closed-outline')}
                    <View style={styles.settingTextWrap}>
                      <Text style={styles.settingText}>{isPublic ? 'קבוצה פתוחה' : 'קבוצה פרטית'}</Text>
                      <Text style={styles.settingHint}>
                        {isPublic ? 'כולם יכולים להצטרף' : 'הצטרפות רק בהזמנה'}
                      </Text>
                    </View>
                    <Switch
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
                      <Text style={styles.settingText}>קבוצת הכרזות</Text>
                      <Text style={styles.settingHint}>רק אדמינים שולחים הודעות</Text>
                    </View>
                    <Switch
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
              {renderSectionCaption('עזרה')}
              <UICard variant="glass" glassIntensity="light" padding="none" style={styles.sectionCard}>
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    void HapticFeedback.selection();
                    handlePrivacyAndSupport();
                  }}
                  activeOpacity={0.7}
                >
                  {renderSettingIcon('shield-outline')}
                  <Text style={styles.settingTextGrow}>פרטיות ותמיכה</Text>
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
                <Text style={styles.promptBtnCancel}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPromptVisible(false);
                  promptCallback?.(promptValue);
                }}
                style={[styles.promptBtn, styles.promptBtnConfirmBg]}
              >
                <Text style={styles.promptBtnConfirm}>אישור</Text>
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
      borderRadius: tokens.borderRadius.lg,
    },
    sectionCaptionWrap: {
      alignSelf: 'stretch',
      width: '100%',
    },
    sectionCaption: {
      ...chatRtlText,
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.bold as '700',
      lineHeight: tokens.typography.caption.lineHeight,
      color: tokens.colors.text.tertiary,
      marginBottom: tokens.spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: tokens.typography.letterSpacing.wide,
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
      ...StyleSheet.absoluteFillObject,
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
      fontSize: tokens.typography.body.size,
      fontWeight: tokens.typography.fontWeight.semibold as '600',
      lineHeight: tokens.typography.body.lineHeight,
      color: tokens.colors.text.primary,
    },
    settingTextGrow: {
      ...chatRtlText,
      flex: 1,
      fontSize: tokens.typography.body.size,
      fontWeight: tokens.typography.fontWeight.semibold as '600',
      lineHeight: tokens.typography.body.lineHeight,
      color: tokens.colors.text.primary,
    },
    settingHint: {
      ...chatRtlText,
      fontSize: tokens.typography.footnote.size,
      lineHeight: tokens.typography.footnote.lineHeight,
      color: tokens.colors.text.tertiary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: tokens.spacing.base,
    },
    errorText: {
      ...chatRtlText,
      fontSize: tokens.typography.body.size,
      lineHeight: tokens.typography.body.lineHeight,
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
      backgroundColor: tokens.colors.background.cardSolid,
      borderRadius: tokens.borderRadius.lg,
      padding: tokens.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      direction: 'rtl',
    },
    promptTitle: {
      ...chatRtlText,
      fontSize: tokens.typography.subtitle.size,
      fontWeight: tokens.typography.subtitle.weight as '600',
      lineHeight: tokens.typography.subtitle.lineHeight,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.base,
    },
    promptInput: {
      ...chatRtlText,
      backgroundColor: tokens.colors.background.input,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.body.size,
      lineHeight: tokens.typography.body.lineHeight,
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
      color: tokens.colors.text.secondary,
      fontSize: tokens.typography.callout.size,
      fontWeight: tokens.typography.fontWeight.medium as '500',
    },
    promptBtnConfirmBg: {
      backgroundColor: tokens.colors.primary.main,
    },
    promptBtnConfirm: {
      color: tokens.colors.text.inverse,
      fontSize: tokens.typography.callout.size,
      fontWeight: tokens.typography.fontWeight.semibold as any,
    },
  });
