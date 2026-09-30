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
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import BottomSheet, { useBottomSheetClose } from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { formFieldInputStyle, formFieldShellStyle } from '../../components/ui/formControl';
import { useAuth } from '../../context/AuthContext';
import { newsService } from '../../services/newsService';
import { mediaService } from '../../services/mediaService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { APP_TYPE, appFormFieldLabelStyle } from '../../components/ui/appType';

interface CreateNewsSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const DEFAULT_SOURCE = 'DarkPool';

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
    if (animatedClose) animatedClose();
    else onClose();
  }, [isBusy, animatedClose, onClose]);

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
        if (animatedClose) animatedClose();
        else onClose();
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
    animatedClose,
    onClose,
    onCreated,
  ]);

  const placeholderColor = DesignTokens.colors.text.tertiary;
  const primary = DesignTokens.colors.primary.main;
  const snapPoints = useMemo(() => [0.9], []);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      snapPoints={snapPoints}
      enablePanDownToClose={!isBusy}
      edgeToEdge
      showHandle
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
            style={styles.headerFace}
            accessibilityLabel="סגור"
            disabled={isBusy}
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>

          <Text style={[styles.headerTitle, { color: DesignTokens.colors.text.primary }]}>
            כתבה חדשה
          </Text>

          <DayNavBlurButton
            onPress={() => {
              void handleSubmit();
            }}
            size={DAY_NAV_BUTTON_SIZE}
            style={styles.headerFace}
            accessibilityLabel="פרסם"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={DesignTokens.colors.text.primary} />
            ) : (
              <Ionicons
                name="checkmark"
                size={22}
                color={canSubmit ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
              />
            )}
          </DayNavBlurButton>
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
                  backgroundColor: DesignTokens.colors.background.primary,
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
                  <Ionicons name="trash-outline" size={16} color={DesignTokens.colors.text.danger} />
                  <Text style={[styles.imageToolbarBtnText, { color: DesignTokens.colors.text.danger }]}>הסר</Text>
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
              <Ionicons name="image-outline" size={28} color={DesignTokens.colors.text.secondary} />
              <Text style={[styles.imageSlotTitle, { color: DesignTokens.colors.text.primary }]}>
                הוסף תמונת כותרת
              </Text>
              <Text style={[styles.imageSlotHint, { color: placeholderColor }]}>
                אופציונלי · מומלץ ביחס 16:9
              </Text>
            </TouchableOpacity>
          )}

          <NewsTextField
            label="כותרת"
            required
            counter={`${title.length}/160`}
            value={title}
            onChangeText={setTitle}
            placeholder="מה קורה? כתבו כותרת חזקה..."
            maxLength={160}
            returnKeyType="next"
          />

          <NewsTextField
            label="תוכן הכתבה"
            required
            counter={`${content.length}/4000`}
            value={content}
            onChangeText={setContent}
            placeholder="תוכן מלא של הכתבה..."
            multiline
            maxLength={4000}
          />

          <NewsTextField
            label="מקור"
            value={source}
            onChangeText={setSource}
            placeholder={DEFAULT_SOURCE}
            maxLength={60}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

function NewsTextField({
  label,
  required,
  counter,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  returnKeyType,
}: {
  label: string;
  required?: boolean;
  counter?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  returnKeyType?: 'next' | 'done';
}) {
  const tokens = useDesignTokens();
  const [focused, setFocused] = useState(false);
  const shellRadius = multiline ? tokens.borderRadius.xl : tokens.borderRadius.full;

  return (
    <View style={formFieldStyles.group}>
      <View style={formFieldStyles.labelRow}>
        <Text style={[appFormFieldLabelStyle, formFieldStyles.label]}>
          {label}
          {required ? ' *' : ''}
        </Text>
        {counter ? (
          <Text style={[formFieldStyles.counter, { color: tokens.colors.text.secondary }]}>{counter}</Text>
        ) : null}
      </View>
      <View
        style={[
          formFieldShellStyle({ tokens, focused, multiline }),
          {
            borderRadius: shellRadius,
            backgroundColor: focused
              ? tokens.colors.background.tertiary
              : tokens.colors.background.primary,
            paddingHorizontal: APP_LAYOUT.cardPadding,
            minHeight: multiline ? 160 : 52,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.text.tertiary}
          style={[
            formFieldInputStyle(),
            {
              color: tokens.colors.text.primary,
              width: '100%',
              minHeight: multiline ? 140 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? 4 : 0,
            },
          ]}
          multiline={multiline}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const formFieldStyles = StyleSheet.create({
  group: {
    direction: 'rtl',
  },
  labelRow: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  label: {
    flex: 1,
    marginBottom: 0,
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
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.divider,
    },
    headerFace: {
      backgroundColor: tokens.colors.background.primary,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      writingDirection: 'rtl',
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: APP_LAYOUT.cardPadding,
      paddingBottom: APP_LAYOUT.sectionGap,
      gap: APP_LAYOUT.componentGap,
      direction: 'rtl',
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
      ...APP_TYPE.body,
      textAlign: 'right',
      writingDirection: 'rtl',
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
      writingDirection: 'rtl',
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
