import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  AndroidSoftInputModes,
  KeyboardController,
  useGenericKeyboardHandler,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChatComposerDock } from '../../components/chat/ChatComposerDock';
import { restoreAndroidSoftInputIfUnlocked } from '../../components/chat/androidChatKeyboard';
import {
  CHAT_COMPOSER_KEYBOARD_GAP,
  chatComposerSafeBottomInset,
} from '../../components/chat/chatInputLayout';
import { repliesSheetKeyboardShrink } from './repliesSheetKeyboard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import BottomSheet, {
  useBottomSheetClose,
} from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import {
  createCommunityPostReply,
  deleteCommunityPostReply,
  fetchCommunityPostReplies,
  formatPostTime,
} from '../../services/tweetsService';
import type { CommunityPost, CommunityPostReply } from '../../types/tweets.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import UserAvatarButton from '../../components/profile/UserAvatarButton';
import UserNameButton from '../../components/profile/UserNameButton';
import FollowUserButton from '../../components/profile/FollowUserButton';
import EntityEmbedCard from '../../components/share/EntityEmbedCard';
import { openUserProfile } from '../../lib/openUserProfile';
import CommunityPostImage from './CommunityPostImage';

type Props = {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
  onReplyCountChange?: (postId: string, replyCount: number) => void;
};

const MAX_LEN = 1000;
/**
 * fitContent + snapPoints = גובה השיט = גובה ה-snap (מעוגן לתחתית).
 * בלי fitContent ה-container בגובה מסך מלא + translateY חותך את ה-composer.
 */
const SHEET_SNAP = 0.9;

export default function PostRepliesSheet({
  visible,
  post,
  onClose,
  onReplyCountChange,
}: Props) {
  const [panEnabled, setPanEnabled] = useState(true);
  const onBusyChange = useCallback((busy: boolean) => {
    setPanEnabled(!busy);
  }, []);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[SHEET_SNAP]}
      fitContent
      enablePanDownToClose={panEnabled}
      edgeToEdge
      showHandle
      useGlassBackground
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <PostRepliesSheetBody
        visible={visible}
        post={post}
        onClose={onClose}
        onReplyCountChange={onReplyCountChange}
        onBusyChange={onBusyChange}
      />
    </BottomSheet>
  );
}

function PostRepliesSheetBody({
  visible,
  post,
  onClose,
  onReplyCountChange,
  onBusyChange,
}: Props & { onBusyChange?: (busy: boolean) => void }) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [replies, setReplies] = useState<CommunityPostReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const postId = post?.id ?? null;
  const postRef = useRef(post);
  postRef.current = post;

  const onReplyCountChangeRef = useRef(onReplyCountChange);
  onReplyCountChangeRef.current = onReplyCountChange;

  const notifyCount = useCallback((id: string, count: number) => {
    onReplyCountChangeRef.current?.(id, count);
  }, []);

  const loadSeqRef = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  const listRef = useRef<FlatList<CommunityPostReply>>(null);

  const refetch = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!visible || !postId) {
      loadSeqRef.current += 1;
      setReplies([]);
      setBody('');
      setBusy(false);
      setError(null);
      setLoading(false);
      return;
    }

    const seq = ++loadSeqRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await fetchCommunityPostReplies(postId);
        if (cancelled || seq !== loadSeqRef.current) return;
        setReplies(rows);
        const known = postRef.current?.replyCount;
        if (known !== rows.length) {
          notifyCount(postId, rows.length);
        }
      } catch (e: any) {
        if (cancelled || seq !== loadSeqRef.current) return;
        setError(e?.message || 'לא ניתן לטעון תגובות');
        setReplies([]);
      } finally {
        if (!cancelled && seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, postId, notifyCount, reloadTick]);

  const canSubmit =
    !!postId &&
    !!user &&
    body.trim().length >= 1 &&
    body.trim().length <= MAX_LEN &&
    !busy;

  const handleClose = useCallback(() => {
    if (busy) return;
    void HapticFeedback.selection();
    if (animatedClose) animatedClose();
    else onClose();
  }, [busy, animatedClose, onClose]);

  const submit = useCallback(async () => {
    const current = postRef.current;
    if (!canSubmit || !current) return;
    setBusy(true);
    setError(null);
    void HapticFeedback.impactLight();
    try {
      const reply = await createCommunityPostReply({
        postId: current.id,
        body: body.trim(),
      });
      setReplies((prev) => {
        if (prev.some((r) => r.id === reply.id)) return prev;
        const next = [...prev, reply];
        notifyCount(current.id, next.length);
        return next;
      });
      setBody('');
      void HapticFeedback.success();
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e: any) {
      setError(e?.message || 'לא ניתן לפרסם תגובה');
      void HapticFeedback.error();
    } finally {
      setBusy(false);
    }
  }, [body, canSubmit, notifyCount]);

  const handleDelete = useCallback(
    (reply: CommunityPostReply) => {
      const current = postRef.current;
      if (!current) return;
      Alert.alert('מחיקת תגובה', 'למחוק את התגובה?', [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCommunityPostReply(reply.id);
                setReplies((prev) => {
                  const next = prev.filter((r) => r.id !== reply.id);
                  notifyCount(current.id, next.length);
                  return next;
                });
                void HapticFeedback.success();
              } catch {
                legacyAlert('שגיאה', 'לא ניתן למחוק את התגובה');
              }
            })();
          },
        },
      ]);
    },
    [notifyCount]
  );

  const composerPaddingBottom = useMemo(
    () => chatComposerSafeBottomInset(insets.bottom),
    [insets.bottom],
  );

  // Android: ADJUST_NOTHING בזמן שהשיט פתוח — כמו ChatComposerDock בצ'אט
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'android') {
      try {
        KeyboardController.setInputMode(
          AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING,
        );
      } catch {
        // non-critical
      }
    }
    return () => {
      restoreAndroidSoftInputIfUnlocked();
    };
  }, [visible]);

  // כווץ את עמוד התגובות — לא translateY. תרגום הרשימה (ChatKeyboardFollow)
  // דחף את הציוץ המקורי ואת הבועות מחוץ לשיט.
  const composerInsetSV = useSharedValue(composerPaddingBottom);
  useEffect(() => {
    composerInsetSV.value = composerPaddingBottom;
  }, [composerPaddingBottom, composerInsetSV]);

  const listShrinkH = useSharedValue(0);
  useGenericKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        listShrinkH.value = repliesSheetKeyboardShrink(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
      onEnd: (event) => {
        'worklet';
        listShrinkH.value = repliesSheetKeyboardShrink(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
    },
    [],
  );
  const listShrinkStyle = useAnimatedStyle(() => ({
    paddingBottom: listShrinkH.value,
  }));

  const repliesList =
    loading && replies.length === 0 ? (
      <View style={styles.listLoading}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    ) : (
      <FlatList
        ref={listRef}
        data={replies}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          loading && replies.length > 0 ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator
                size="small"
                color={tokens.colors.primary.main}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isMine = !!user && item.userId === user.id;
          return (
            <View style={styles.replyRow}>
              <UserAvatarButton
                userId={item.author.id}
                name={item.author.displayName}
                uri={item.author.avatarUrl}
                size={32}
              />
              <View style={styles.replyMain}>
                <View style={styles.replyMeta}>
                  <UserNameButton
                    userId={item.author.id}
                    name={item.author.displayName}
                    style={[
                      styles.replyName,
                      { color: tokens.colors.text.primary },
                    ]}
                    numberOfLines={1}
                  />
                  <Text
                    style={[
                      styles.replyTime,
                      { color: tokens.colors.text.tertiary },
                    ]}
                  >
                    {formatPostTime(item.createdAt)}
                  </Text>
                  {isMine ? (
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={10}
                      accessibilityLabel="מחק תגובה"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={tokens.colors.text.tertiary}
                      />
                    </TouchableOpacity>
                  ) : (
                    <FollowUserButton userId={item.author.id} />
                  )}
                </View>
                <Text
                  style={[
                    styles.replyBody,
                    { color: tokens.colors.text.primary },
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />
    );

  return (
      <View style={styles.sheetRoot}>
      <Animated.View style={[styles.container, listShrinkStyle]}>
        <View style={styles.header}>
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
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerTitle, { color: tokens.colors.text.primary }]}
              numberOfLines={1}
            >
              תגובות
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        {post ? (
          <View
            style={[
              styles.parentCard,
              {
                backgroundColor: tokens.colors.background.tertiary,
                borderColor: tokens.colors.border.divider,
              },
            ]}
          >
            <View style={styles.parentHeader}>
              <UserAvatarButton
                userId={post.author.id}
                name={post.author.displayName}
                uri={post.author.avatarUrl}
                size={40}
              />
              <View style={styles.parentMain}>
                <View style={styles.parentMeta}>
                  <UserNameButton
                    userId={post.author.id}
                    name={post.author.displayName}
                    style={[
                      styles.parentAuthor,
                      { color: tokens.colors.text.primary },
                    ]}
                    numberOfLines={1}
                  />
                  {user?.id !== post.author.id ? (
                    <FollowUserButton userId={post.author.id} />
                  ) : null}
                  <Text
                    style={[
                      styles.parentTime,
                      { color: tokens.colors.text.tertiary },
                    ]}
                  >
                    {formatPostTime(post.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
            <Text
              style={[styles.parentBody, { color: tokens.colors.text.primary }]}
              numberOfLines={4}
            >
              {post.body}
            </Text>
            {post.mentions?.length ? (
              <View style={styles.parentMentions}>
                {post.mentions.map((m) => (
                  <TouchableOpacity
                    key={m.userId}
                    onPress={() => {
                      openUserProfile(m.userId, { currentUserId: user?.id });
                    }}
                    style={[
                      styles.mentionChip,
                      { backgroundColor: `${tokens.colors.primary.main}22` },
                    ]}
                    accessibilityLabel={`פרופיל של ${m.displayName}`}
                  >
                    <Text
                      style={[
                        styles.mentionChipText,
                        { color: tokens.colors.primary.main },
                      ]}
                      numberOfLines={1}
                    >
                      @{m.displayName.replace(/\s+/g, '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {!!post.imageUrl ||
            (post.attachments?.length ?? 0) > 0 ||
            post.attachment ? (
              <View style={styles.parentMedia}>
                {post.imageUrl ? (
                  <CommunityPostImage
                    uri={post.imageUrl}
                    borderRadius={tokens.borderRadius['2xl']}
                    maxHeight={220}
                  />
                ) : null}
                {(post.attachments?.length
                  ? post.attachments
                  : post.attachment
                    ? [post.attachment]
                    : []
                ).map((att, i) => (
                  <EntityEmbedCard
                    key={`${att.ref.type}-${att.ref.id}-${i}`}
                    attachment={att}
                    compact
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {repliesList}
        </View>

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
            <Text style={[styles.bannerText, { color: tokens.colors.text.primary }]}>
              {error}
            </Text>
            {postId ? (
              <TouchableOpacity onPress={refetch} hitSlop={8}>
                <Text
                  style={{
                    color: tokens.colors.primary.main,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  נסה שוב
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      <ChatComposerDock bottomInset={composerPaddingBottom}>
        <View
          style={[
            styles.composer,
            {
              borderTopColor: tokens.colors.border.divider,
              backgroundColor: tokens.colors.background.cardSolid,
              paddingBottom: composerPaddingBottom,
            },
          ]}
        >
          <View style={styles.composerInputWrap}>
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              style={[styles.composerInputCard, { backgroundColor: tokens.colors.background.primary }]}
              contentContainerStyle={styles.composerInputCardInner}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={user ? 'כתבו תגובה…' : 'יש להתחבר כדי להגיב'}
                placeholderTextColor={tokens.colors.text.tertiary}
                multiline
                maxLength={MAX_LEN}
                editable={!!user && !busy}
                style={[styles.composerInput, { color: tokens.colors.text.primary, writingDirection: 'rtl' }]}
                textAlign="right"
                textAlignVertical="center"
              />
            </UICard>
          </View>
          <TouchableOpacity
            onPress={() => {
              void submit();
            }}
            disabled={!canSubmit}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSubmit
                  ? tokens.colors.primary.main
                  : tokens.colors.background.primary,
              },
            ]}
            accessibilityLabel="שלח תגובה"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={canSubmit ? '#fff' : tokens.colors.text.tertiary}
              />
            )}
          </TouchableOpacity>
        </View>
      </ChatComposerDock>
      </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  const r = tokens.borderRadius;
  return StyleSheet.create({
    sheetRoot: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    },
    container: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
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
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    parentCard: {
      gap: 10,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: r['2xl'],
      borderWidth: StyleSheet.hairlineWidth,
      flexShrink: 0,
      overflow: 'hidden',
    },
    parentHeader: {
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      gap: 12,
    },
    parentMain: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    parentMeta: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    parentAuthor: {
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    parentTime: {
      fontSize: 12,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    parentBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    parentMentions: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 6,
    },
    mentionChip: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: r.button,
    },
    mentionChipText: {
      fontSize: 12,
      fontWeight: '700',
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    parentMedia: {
      gap: 8,
      width: '100%',
    },
    listWrap: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: 20,
    },
    listLoading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
    inlineLoading: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    replyRow: {
      flexDirection: 'row-reverse',
      gap: 10,
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    replyMain: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    replyMeta: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
    },
    replyName: {
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    replyTime: {
      fontSize: 12,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    replyBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    banner: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 0,
      borderRadius: r.xl,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    // ChatComposerDock כופה LTR — ילד ראשון = שמאל (שדה), שני = ימין (שליחה)
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexGrow: 0,
      flexShrink: 0,
    },
    // flex:1 כאן (רוחב ליד כפתור השליחה) — לא על UICard, כדי שלא יימתח לגובה השיט
    composerInputWrap: {
      flex: 1,
      minWidth: 0,
      flexGrow: 1,
      flexShrink: 1,
      justifyContent: 'flex-end',
    },
    composerInputCard: {
      borderRadius: 30,
      overflow: 'hidden',
      minHeight: 44,
      flexGrow: 0,
      width: '100%',
    },
    composerInputCardInner: {
      justifyContent: 'center',
    },
    composerInput: {
      minHeight: 44,
      maxHeight: 110,
      fontSize: 15,
      lineHeight: 21,
      paddingHorizontal: 14,
      paddingVertical: 11,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: r.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
    },
  });
}
