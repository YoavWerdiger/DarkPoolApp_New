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
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import BottomSheet, { useBottomSheetClose } from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { newsService } from '../../services/newsService';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  APP_TYPE,
  appPhysicalRightText,
  appSectionTitleStyle,
  appFormFieldLabelStyle,
} from '../../components/ui/appType';

interface CreateNewsSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const DEFAULT_SOURCE = 'DarkPool';
const SHEET_WATERMARK_SCALE = 0.65;

/** טקסט עברי בתוך עץ RTL — תיבת LTR + יישור ימין פיזי */
const rtlText = appPhysicalRightText;

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

      setStatusMessage('שומר...');

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
      edgeToEdge
      showHandle
      useGlassBackground
      showBrandBackground={false}
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

          <UIButton
            title="פרסם"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={!canSubmit}
            onPress={() => {
              void handleSubmit();
            }}
            haptic={false}
          />
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
                  backgroundColor: DesignTokens.colors.background.cardSolid,
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
    ...appFormFieldLabelStyle,
  },
  counter: {
    ...APP_TYPE.caption,
    marginLeft: APP_LAYOUT.stackGapSmall,
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
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.divider,
    },
    headerIconButton: {
      alignSelf: 'center',
      marginLeft: APP_LAYOUT.cardTitleToBodyGap,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'flex-start',
    },
    headerTitle: {
      ...appSectionTitleStyle,
      textAlign: 'right',
      letterSpacing: 0,
    },
    headerSubtitle: {
      ...APP_TYPE.cardSubtitle,
      marginTop: APP_LAYOUT.titleSubtitleGap,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
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
      ...APP_TYPE.body,
      paddingVertical: 10,
      width: '100%',
    },
    titleInput: {
      ...APP_TYPE.body,
    },
    textAreaInner: {
      minHeight: 160,
      textAlignVertical: 'top',
      paddingVertical: 4,
    },
    sourceInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sourceInputInner: {
      flex: 1,
      paddingVertical: 10,
      marginLeft: APP_LAYOUT.cardTitleToBodyGap,
    },
    banner: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 15,
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
    },
    bannerText: {
      flex: 1,
      ...APP_TYPE.cardSubtitle,
      textAlign: 'right',
      marginLeft: APP_LAYOUT.cardTitleToBodyGap,
    },
    imageSlot: {
      aspectRatio: 16 / 9,
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    },
    imageSlotTitle: {
      ...APP_TYPE.cardTitle,
      textAlign: 'center',
      marginTop: APP_LAYOUT.cardTitleToBodyGap,
    },
    imageSlotHint: {
      ...APP_TYPE.caption,
      textAlign: 'center',
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    },
    imagePreviewWrap: {
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
      borderWidth: 0,
      backgroundColor: tokens.colors.background.cardSolid,
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
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
    },
    imageToolbarBtn: {
      flex: 1,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
    },
    imageToolbarBtnText: {
      color: '#fff',
      ...APP_TYPE.cardSubtitle,
      marginLeft: APP_LAYOUT.stackGapSmall,
    },
    imageToolbarDivider: {
      width: 1,
      height: 20,
      backgroundColor: tokens.colors.border.divider,
    },
    imageUploadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageUploadingText: {
      color: '#fff',
      ...APP_TYPE.cardSubtitle,
      marginTop: APP_LAYOUT.stackGapSmall,
    },
  });
