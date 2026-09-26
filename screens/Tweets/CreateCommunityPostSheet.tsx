import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import MediaPickerSheet from '../../components/chat/MediaPickerSheet';
import {
  resolvePickedMedia,
  scheduleMediaRecentsPrefetch,
} from '../../lib/mediaRecentsCache';
import UICard from '../../components/ui/UICard';
import BottomSheet, {
  useBottomSheetClose,
} from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { mediaService } from '../../services/mediaService';
import { createCommunityPost } from '../../services/tweetsService';
import type { CommunityMention, CommunityPost } from '../../types/tweets.types';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import EntityAttachPickerSheet from '../../components/share/EntityAttachPickerSheet';
import EntityEmbedCard from '../../components/share/EntityEmbedCard';
import MentionPickerSheet from '../../components/share/MentionPickerSheet';
import CommunityPostImage from './CommunityPostImage';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (post: CommunityPost) => void;
  /** Prefill ממסך שיתוף (ShareDestination) */
  initialAttachment?: ShareableAttachment | null;
};

const MAX_LEN = 2000;
const MAX_ATTACHMENTS = 5;
const MAX_MENTIONS = 10;
const SHEET_BORDER = 'rgba(255, 255, 255, 0.12)';

function mentionTagOf(displayName: string): string {
  return `@${displayName.replace(/\s+/g, '')}`;
}

/**
 * אינדקס של `@` פעיל לתיוג: בתחילת מחרוזת או אחרי רווח/שורה,
 * ועדיין בלי רווח/שורה אחריו.
 */
function getActiveAtIndex(value: string): number {
  const lastAt = value.lastIndexOf('@');
  if (lastAt === -1) return -1;
  if (lastAt > 0 && !/[\s\n]/.test(value.charAt(lastAt - 1))) return -1;
  const afterAt = value.slice(lastAt + 1);
  if (afterAt.includes(' ') || afterAt.includes('\n')) return -1;
  return lastAt;
}

function hasActiveAtQuery(value: string): boolean {
  return getActiveAtIndex(value) !== -1;
}

/** true רק כשהמשתמש הקליד זה עתה `@` כטריגר תיוג חדש */
function didTypeAtMentionTrigger(prev: string, next: string): boolean {
  if (next.length === prev.length + 1) {
    let i = 0;
    while (i < prev.length && prev.charAt(i) === next.charAt(i)) i += 1;
    if (next.charAt(i) !== '@') return false;
    if (next.slice(i + 1) !== prev.slice(i)) return false;
    return i === 0 || /[\s\n]/.test(next.charAt(i - 1));
  }
  return hasActiveAtQuery(next) && !hasActiveAtQuery(prev);
}

function replaceOrAppendMentionTag(prev: string, tag: string): string {
  const atIdx = getActiveAtIndex(prev);
  if (atIdx !== -1) {
    return `${prev.slice(0, atIdx)}${tag} `;
  }
  if (prev.includes(tag)) return prev;
  const spacer = prev && !/\s$/.test(prev) ? ' ' : '';
  return `${prev}${spacer}${tag} `;
}

export default function CreateCommunityPostSheet({
  visible,
  onClose,
  onCreated,
  initialAttachment = null,
}: Props) {
  const [panEnabled, setPanEnabled] = useState(true);
  const onBusyChange = useCallback((busy: boolean) => {
    setPanEnabled(!busy);
  }, []);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.72, 0.9]}
      enablePanDownToClose={panEnabled}
      edgeToEdge
      showHandle
      useGlassBackground
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <CreateCommunityPostSheetBody
        visible={visible}
        onClose={onClose}
        onCreated={onCreated}
        initialAttachment={initialAttachment}
        onBusyChange={onBusyChange}
      />
    </BottomSheet>
  );
}

function CreateCommunityPostSheetBody({
  visible,
  onClose,
  onCreated,
  initialAttachment = null,
  onBusyChange,
}: Props & { onBusyChange?: (busy: boolean) => void }) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [body, setBody] = useState('');
  const bodyRef = useRef(body);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ShareableAttachment[]>([]);
  const [mentions, setMentions] = useState<CommunityMention[]>([]);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!visible) {
      setBody('');
      bodyRef.current = '';
      setImageUri(null);
      setAttachments([]);
      setMentions([]);
      setEntityPickerOpen(false);
      setMentionPickerOpen(false);
      setGalleryOpen(false);
      setBusy(false);
      setUploadingImage(false);
      setError(null);
      return;
    }
    if (initialAttachment) {
      setAttachments([initialAttachment]);
    }
    const recents = scheduleMediaRecentsPrefetch('photo');
    return () => recents.cancel();
  }, [visible, initialAttachment]);

  const canSubmit =
    body.trim().length >= 1 &&
    body.trim().length <= MAX_LEN &&
    !busy &&
    !!user;

  const requestClose = useCallback(() => {
    if (animatedClose) animatedClose();
    else onClose();
  }, [animatedClose, onClose]);

  const handleClose = useCallback(() => {
    if (busy) return;
    void HapticFeedback.selection();
    requestClose();
  }, [busy, requestClose]);

  const pickImage = useCallback(() => {
    setError(null);
    setGalleryOpen(true);
  }, []);

  const removeImage = useCallback(() => {
    setImageUri(null);
    void HapticFeedback.selection();
  }, []);

  const addAttachment = useCallback((att: ShareableAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.ref.type === att.ref.type && a.ref.id === att.ref.id)) {
        return prev;
      }
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [...prev, att];
    });
    setEntityPickerOpen(false);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    void HapticFeedback.selection();
  }, []);

  const handleBodyChange = useCallback(
    (next: string) => {
      const prev = bodyRef.current;
      bodyRef.current = next;
      setBody(next);
      if (
        mentions.length < MAX_MENTIONS &&
        !mentionPickerOpen &&
        didTypeAtMentionTrigger(prev, next)
      ) {
        setMentionPickerOpen(true);
      }
    },
    [mentionPickerOpen, mentions.length]
  );

  const addMention = useCallback((mention: CommunityMention) => {
    setMentions((prev) => {
      if (prev.some((m) => m.userId === mention.userId)) return prev;
      if (prev.length >= MAX_MENTIONS) return prev;
      return [...prev, mention];
    });
    setBody((prev) => {
      const next = replaceOrAppendMentionTag(prev, mentionTagOf(mention.displayName));
      bodyRef.current = next;
      return next;
    });
    setMentionPickerOpen(false);
  }, []);

  const removeMention = useCallback((userId: string) => {
    setMentions((prev) => prev.filter((m) => m.userId !== userId));
    void HapticFeedback.selection();
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    void HapticFeedback.impactLight();
    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        setUploadingImage(true);
        const upload = await mediaService.uploadMedia(imageUri, 'image');
        setUploadingImage(false);
        if (!upload.success || !upload.url) {
          throw new Error(upload.error || 'העלאת התמונה נכשלה');
        }
        imageUrl = upload.url;
      }
      const created = await createCommunityPost({
        body: body.trim(),
        imageUrl,
        attachments,
        mentions,
      });
      void HapticFeedback.success();
      onCreated?.(created);
      requestClose();
    } catch (e: any) {
      setUploadingImage(false);
      setError(e?.message || 'לא ניתן לפרסם');
      void HapticFeedback.error();
    } finally {
      setBusy(false);
    }
  }, [attachments, body, canSubmit, imageUri, mentions, onCreated, requestClose]);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <DayNavBlurButton
              onPress={handleClose}
              size={DAY_NAV_BUTTON_SIZE}
              glassIntensity="subtle"
              style={styles.headerIconButton}
              accessibilityLabel="סגור"
              disabled={busy}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={tokens.colors.text.primary}
              />
            </DayNavBlurButton>
          </View>

          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerTitle, { color: tokens.colors.text.primary }]}
              numberOfLines={1}
            >
              ציוץ חדש
            </Text>
          </View>

          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.medium();
                void submit();
              }}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={[styles.headerPublishBtn, !canSubmit && styles.headerPublishBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="פרסם"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.headerPublishBtnText,
                    !canSubmit && styles.headerPublishBtnTextDisabled,
                  ]}
                >
                  פרסם
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: (tokens.colors.danger?.main || '#FF3B5C') + '1f',
                  borderColor: (tokens.colors.danger?.main || '#FF3B5C') + '66',
                },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={tokens.colors.danger?.main || '#FF3B5C'}
              />
              <Text style={[styles.bannerText, { color: tokens.colors.text.primary }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <UICard
            variant="blur"
            padding="none"
            style={styles.composeCard}
            contentContainerStyle={styles.composeCardInner}
          >
            <TextInput
              value={body}
              onChangeText={handleBodyChange}
              placeholder="מה קורה בקהילה?"
              placeholderTextColor={tokens.colors.text.tertiary}
              multiline
              maxLength={MAX_LEN}
              style={[styles.composeInput, { color: tokens.colors.text.primary, writingDirection: 'rtl' }]}
              textAlign="right"
              textAlignVertical="top"
              autoFocus
              editable={!busy}
            />

            {mentions.length > 0 ? (
              <View style={styles.chipsRow}>
                {mentions.map((m) => (
                  <TouchableOpacity
                    key={m.userId}
                    onPress={() => removeMention(m.userId)}
                    style={[
                      styles.chip,
                      { backgroundColor: `${tokens.colors.primary.main}22` },
                    ]}
                    disabled={busy}
                  >
                    <Text
                      style={[styles.chipText, { color: tokens.colors.primary.main }]}
                      numberOfLines={1}
                    >
                      @{m.displayName.replace(/\s+/g, '')}
                    </Text>
                    <Ionicons
                      name="close-circle"
                      size={14}
                      color={tokens.colors.primary.main}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <Text style={[styles.counter, { color: tokens.colors.text.tertiary }]}>
                {body.trim().length}/{MAX_LEN}
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setMentionPickerOpen(true);
                  }}
                  disabled={busy || mentions.length >= MAX_MENTIONS}
                  style={[
                    styles.attachBtn,
                    mentions.length > 0 ? styles.attachBtnActive : null,
                  ]}
                  accessibilityLabel="תייג חבר"
                  hitSlop={8}
                >
                  <Ionicons
                    name="at"
                    size={22}
                    color={
                      mentions.length > 0
                        ? tokens.colors.primary.main
                        : tokens.colors.text.secondary
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setEntityPickerOpen(true);
                  }}
                  disabled={busy || attachments.length >= MAX_ATTACHMENTS}
                  style={[
                    styles.attachBtn,
                    attachments.length > 0 ? styles.attachBtnActive : null,
                  ]}
                  accessibilityLabel="צרף תוכן"
                  hitSlop={8}
                >
                  <Ionicons
                    name="link-outline"
                    size={22}
                    color={
                      attachments.length > 0
                        ? tokens.colors.primary.main
                        : tokens.colors.text.secondary
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    void pickImage();
                  }}
                  disabled={busy}
                  style={[
                    styles.attachBtn,
                    imageUri ? styles.attachBtnActive : null,
                  ]}
                  accessibilityLabel={imageUri ? 'החלף תמונה' : 'הוסף תמונה'}
                  hitSlop={8}
                >
                  <Ionicons
                    name={imageUri ? 'image' : 'image-outline'}
                    size={22}
                    color={
                      imageUri
                        ? tokens.colors.primary.main
                        : tokens.colors.text.secondary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </UICard>

          {attachments.length > 0 ? (
            <View style={{ gap: 10 }}>
              {attachments.map((att, index) => (
                <View key={`${att.ref.type}-${att.ref.id}-${index}`} style={{ gap: 6 }}>
                  <EntityEmbedCard attachment={att} onPress={() => undefined} />
                  <TouchableOpacity
                    onPress={() => removeAttachment(index)}
                    disabled={busy}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: tokens.colors.text.tertiary, fontSize: 13 }}>
                      הסר צירוף
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {attachments.length < MAX_ATTACHMENTS ? (
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.selection();
                    setEntityPickerOpen(true);
                  }}
                  disabled={busy}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Text style={{ color: tokens.colors.primary.main, fontSize: 13, fontWeight: '600' }}>
                    + הוסף צירוף נוסף
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {imageUri ? (
            <View style={styles.previewFrame}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  void pickImage();
                }}
                disabled={busy}
                accessibilityLabel="החלף תמונה"
              >
                <CommunityPostImage
                  uri={imageUri}
                  borderRadius={tokens.borderRadius['2xl']}
                  maxHeight={Math.round(Dimensions.get('window').height * 0.4)}
                />
              </TouchableOpacity>
              {uploadingImage ? (
                <View style={styles.previewOverlay} pointerEvents="none">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
              <TouchableOpacity
                onPress={removeImage}
                style={styles.removeBadge}
                disabled={busy}
                accessibilityLabel="הסר תמונה"
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <EntityAttachPickerSheet
        visible={entityPickerOpen}
        onClose={() => setEntityPickerOpen(false)}
        onSelect={addAttachment}
      />
      <MentionPickerSheet
        visible={mentionPickerOpen}
        onClose={() => setMentionPickerOpen(false)}
        onSelect={addMention}
        excludeUserIds={mentions.map((m) => m.userId)}
      />
      <MediaPickerSheet
        visible={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        kind="photo"
        allowsMultiple={false}
        onPickedMedia={(items) => {
          const first = items[0];
          if (!first) return;
          setImageUri(first.thumbnailUri || first.uri);
          setError(null);
          void HapticFeedback.selection();
          void resolvePickedMedia([first]).then((resolved) => {
            if (resolved[0]?.uri) setImageUri(resolved[0].uri);
          });
        }}
      />
    </>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  const r = tokens.borderRadius;
  const radius = r['2xl'];
  return StyleSheet.create({
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
    headerSide: {
      minWidth: DAY_NAV_BUTTON_SIZE + 32,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      writingDirection: 'rtl',
      textAlign: 'center',
      width: '100%',
    },
    headerPublishBtn: {
      minWidth: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
      paddingHorizontal: 16,
      borderRadius: r.button,
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 28,
      gap: 14,
      direction: 'rtl',
    },
    banner: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: r.xl,
      borderWidth: StyleSheet.hairlineWidth,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    composeCard: {
      borderRadius: radius,
      overflow: 'hidden',
    },
    composeCardInner: {
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
      gap: 10,
    },
    composeInput: {
      minHeight: 140,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
      padding: 0,
      writingDirection: 'rtl',
    },
    chipsRow: {
      direction: 'rtl',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: r.button,
      maxWidth: '100%',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    toolbar: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: SHEET_BORDER,
      paddingTop: 10,
    },
    counter: {
      fontSize: 12,
      fontWeight: '600',
      writingDirection: 'ltr',
    },
    attachBtn: {
      width: 40,
      height: 40,
      borderRadius: r.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.glass.card.bg,
    },
    attachBtnActive: {
      backgroundColor: tokens.colors.primary.dim,
    },
    previewFrame: {
      borderRadius: radius,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.tertiary,
      direction: 'rtl',
    },
    previewOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: r.full,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.25)',
    },
  });
}
