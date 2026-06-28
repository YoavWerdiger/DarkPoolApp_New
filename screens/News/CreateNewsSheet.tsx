// ============================================
// Create News Sheet
// ============================================
// טופס יצירת חדשה ידנית — admins בלבד.
// מכניס שורה ל-`app_news_clean`, והטריגר במסד הנתונים
// שולח Push לכל מי שמנוי על התראות חדשות.
// ============================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import BottomSheet, { useBottomSheetClose } from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { newsService } from '../../services/newsService';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface CreateNewsSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const DEFAULT_SOURCE = 'DarkPool';
const SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';
const SHEET_WATERMARK_SCALE = 0.65;

/** טקסט עברי בתוך עץ RTL */
const rtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};

export default function CreateNewsSheet({ visible, onClose, onCreated }: CreateNewsSheetProps) {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isBusy = isSubmitting || isUploadingImage;
  const canSubmit = title.trim().length >= 2 && content.trim().length >= 2 && !isBusy;

  const reset = useCallback(() => {
    setTitle('');
    setContent('');
    setSource(DEFAULT_SOURCE);
    setImageLocalUri(null);
    setIsUploadingImage(false);
    setIsSubmitting(false);
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    reset();
    if (animatedClose) animatedClose();
    else onClose();
  }, [isBusy, reset, animatedClose, onClose]);

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      const allowed = permission.granted || permission.accessPrivileges === 'limited';

      if (!allowed) {
        if (!permission.canAskAgain) {
          setErrorMessage('הרשאת הגישה לתמונות נדחתה. נפתח כעת את ההגדרות...');
          await Linking.openSettings().catch(() => {});
        } else {
          setErrorMessage('נדרשת הרשאה לגישה לתמונות. אשר ונסה שוב.');
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setImageLocalUri(result.assets[0].uri);
        setErrorMessage(null);
        void HapticFeedback.selection();
      }
    } catch (e) {
      console.error('[CreateNewsSheet] image picker failed', e);
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setErrorMessage(`שגיאה בבחירת תמונה: ${msg}`);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageLocalUri(null);
    void HapticFeedback.selection();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      setIsSubmitting(true);

      let uploadedImageUrl: string | null = null;
      if (imageLocalUri) {
        setIsUploadingImage(true);
        setStatusMessage('מעלה תמונה...');
        const upload = await mediaService.uploadMedia(imageLocalUri, 'image');
        setIsUploadingImage(false);
        if (!upload.success || !upload.url) {
          setIsSubmitting(false);
          setStatusMessage(null);
          setErrorMessage(`שגיאה בהעלאת התמונה: ${upload.error || 'נסה שוב'}`);
          return;
        }
        uploadedImageUrl = upload.url;
      }

      setStatusMessage('שומר ל-Supabase...');

      const authorName =
        (user as { full_name?: string; display_name?: string } | null)?.full_name ||
        (user as { full_name?: string; display_name?: string } | null)?.display_name ||
        '';

      await newsService.createNews({
        title: title.trim(),
        content: content.trim(),
        source: source.trim() || DEFAULT_SOURCE,
        image_url: uploadedImageUrl,
        author: authorName,
      });

      void HapticFeedback.impactLight();
      setStatusMessage('פורסם בהצלחה!');
      onCreated?.();
      setTimeout(() => {
        reset();
        onClose();
      }, 700);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא צפויה';
      console.error('[CreateNewsSheet] submit failed', e);
      setStatusMessage(null);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  }, [
    canSubmit,
    imageLocalUri,
    title,
    content,
    source,
    user,
    reset,
    onClose,
    onCreated,
  ]);

  const placeholderColor = DesignTokens.colors.text.tertiary;
  const primary = DesignTokens.colors.primary.main;
  const snapPoints = useMemo(() => [0.9], []);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={handleClose}
      snapPoints={snapPoints}
      enablePanDownToClose={!isBusy}
      backdropOpacity={0.5}
      edgeToEdge
      showHandle
      showBrandBackground
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header קבוע */}
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={handleClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="סגור"
            disabled={isBusy}
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, rtlText, { color: DesignTokens.colors.text.primary }]}>
              כתבה חדשה
            </Text>
            <Text style={[styles.headerSubtitle, rtlText, { color: DesignTokens.colors.text.secondary }]}>
              תפורסם לכל מנויי התראות החדשות
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.medium();
              void handleSubmit();
            }}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={[styles.headerPublishBtn, !canSubmit && styles.headerPublishBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="פרסם כתבה"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.headerPublishBtnText, !canSubmit && styles.headerPublishBtnTextDisabled]}>
                פרסם
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* גוף גלילה */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: (DesignTokens.colors.danger?.main || '#FF3B5C') + '1f',
                  borderColor: (DesignTokens.colors.danger?.main || '#FF3B5C') + '66',
                },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={DesignTokens.colors.danger?.main || '#FF3B5C'}
              />
              <Text selectable style={[styles.bannerText, { color: DesignTokens.colors.text.primary }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {statusMessage && !errorMessage ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: primary + '1f',
                  borderColor: primary + '66',
                },
              ]}
            >
              <ActivityIndicator size="small" color={primary} />
              <Text style={[styles.bannerText, { color: DesignTokens.colors.text.primary }]}>
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {imageLocalUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageLocalUri }} style={styles.imagePreview} resizeMode="cover" />
              {isUploadingImage ? (
                <View style={styles.imageUploadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.imageUploadingText}>מעלה תמונה...</Text>
                </View>
              ) : null}
              <View style={styles.imageToolbar}>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    void handlePickImage();
                  }}
                  activeOpacity={0.85}
                  style={styles.imageToolbarBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="image-outline" size={16} color="#fff" />
                  <Text style={styles.imageToolbarBtnText}>החלף</Text>
                </TouchableOpacity>
                <View style={styles.imageToolbarDivider} />
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.selection();
                    handleRemoveImage();
                  }}
                  activeOpacity={0.85}
                  style={styles.imageToolbarBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF8A9B" />
                  <Text style={[styles.imageToolbarBtnText, { color: '#FF8A9B' }]}>הסר</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                void handlePickImage();
              }}
              activeOpacity={0.85}
              style={styles.imageSlot}
            >
              <Ionicons name="image-outline" size={28} color={primary} />
              <Text style={[styles.imageSlotTitle, rtlText, { color: DesignTokens.colors.text.primary }]}>
                הוסף תמונת כותרת
              </Text>
              <Text style={[styles.imageSlotHint, { color: placeholderColor }]}>
                אופציונלי · מומלץ ביחס 16:9
              </Text>
            </TouchableOpacity>
          )}

          <FormField
            label="כותרת"
            required
            counter={`${title.length}/160`}
            labelColor={DesignTokens.colors.text.secondary}
          >
            <UICard variant="inputGlass" padding="none" style={styles.inputShell}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="מה קורה? כתבו כותרת חזקה..."
                placeholderTextColor={placeholderColor}
                style={[styles.inputInner, styles.titleInput, rtlText, { color: DesignTokens.colors.text.primary }]}
                maxLength={160}
                returnKeyType="next"
              />
            </UICard>
          </FormField>

          <FormField
            label="תוכן הכתבה"
            required
            counter={`${content.length}/4000`}
            labelColor={DesignTokens.colors.text.secondary}
          >
            <UICard variant="inputGlass" padding="none" style={styles.inputShellMultiline}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="תוכן מלא של הכתבה..."
                placeholderTextColor={placeholderColor}
                style={[styles.inputInner, styles.textAreaInner, rtlText, { color: DesignTokens.colors.text.primary }]}
                multiline
                maxLength={4000}
                textAlignVertical="top"
              />
            </UICard>
          </FormField>

          <FormField label="מקור" labelColor={DesignTokens.colors.text.secondary}>
            <UICard variant="inputGlass" padding="none" style={styles.inputShell}>
              <View style={styles.sourceInputRow}>
                <Ionicons name="newspaper-outline" size={17} color={DesignTokens.colors.text.tertiary} />
                <TextInput
                  value={source}
                  onChangeText={setSource}
                  placeholder={DEFAULT_SOURCE}
                  placeholderTextColor={placeholderColor}
                  style={[styles.inputInner, styles.sourceInputInner, rtlText, { color: DesignTokens.colors.text.primary }]}
                  maxLength={60}
                />
              </View>
            </UICard>
          </FormField>
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

function FormField({
  label,
  required,
  counter,
  labelColor,
  children,
}: {
  label: string;
  required?: boolean;
  counter?: string;
  labelColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={formFieldStyles.group}>
      <View style={formFieldStyles.labelRow}>
        <Text style={[formFieldStyles.label, rtlText, { color: labelColor }]}>
          {label}
          {required ? ' *' : ''}
        </Text>
        {counter ? (
          <Text style={[formFieldStyles.counter, rtlText, { color: labelColor }]}>{counter}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const formFieldStyles = StyleSheet.create({
  group: {
    gap: 8,
    direction: 'rtl',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
});

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
      direction: 'rtl',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
      gap: 10,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'flex-start',
    },
    headerPublishBtn: {
      minWidth: DAY_NAV_BUTTON_SIZE + 12,
      height: DAY_NAV_BUTTON_SIZE,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.primary.main,
    },
    headerPublishBtnDisabled: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    headerPublishBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#fff',
    },
    headerPublishBtnTextDisabled: {
      color: tokens.colors.text.tertiary,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 18,
      direction: 'rtl',
    },
    inputShell: {
      borderRadius: 16,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    inputShellMultiline: {
      borderRadius: 16,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    inputInner: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      fontSize: 15,
      paddingVertical: 10,
      width: '100%',
    },
    titleInput: {
      fontSize: 17,
      fontWeight: '600',
    },
    textAreaInner: {
      minHeight: 160,
      textAlignVertical: 'top',
      paddingVertical: 4,
    },
    sourceInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sourceInputInner: {
      flex: 1,
      paddingVertical: 10,
    },
    banner: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'right',
      lineHeight: 19,
    },
    imageSlot: {
      aspectRatio: 16 / 9,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.14)',
      borderStyle: 'dashed',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 20,
    },
    imageSlotTitle: {
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    imageSlotHint: {
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
    },
    imagePreviewWrap: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: SHEET_BORDER,
      backgroundColor: '#000',
    },
    imagePreview: {
      width: '100%',
      aspectRatio: 16 / 9,
    },
    imageToolbar: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    imageToolbarBtn: {
      flex: 1,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
    },
    imageToolbarBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    imageToolbarDivider: {
      width: StyleSheet.hairlineWidth,
      height: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    imageUploadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    imageUploadingText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
  });
