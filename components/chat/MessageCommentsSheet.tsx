import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { repliesSheetKeyboardShrink } from '../../screens/Tweets/repliesSheetKeyboard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { UserBadges, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import UICard from '../../components/ui/UICard';
import BottomSheet, {
  useBottomSheetClose,
} from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { openUserProfile } from '../../lib/openUserProfile';
import { InlineAppDialog } from '../../components/ui/InlineAppDialog';
import { formatPostTime } from '../../services/tweetsService';
import {
  MESSAGE_COMMENT_MAX_LEN,
  addMessageComment,
  deleteMessageComment,
  fetchMessageCommentById,
  fetchMessageComments,
  type MessageComment,
} from '../../services/chat/messageCommentsService';
import { subscribeToMessageComments } from '../../services/chat/chatRealtimeService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import UserAvatarButton from '../../components/profile/UserAvatarButton';
import UserNameButton from '../../components/profile/UserNameButton';

/** ההודעה שמגיבים עליה (הכרזה) */
export type CommentTarget = { id: string; groupId: string };

type Props = {
  visible: boolean;
  post: CommentTarget | null;
  onClose: () => void;
  /** מנהל הקבוצה — יכול למחוק כל תגובה (בנוסף למנהל האפליקציה) */
  isGroupAdmin?: boolean;
};

const MAX_LEN = MESSAGE_COMMENT_MAX_LEN;
/**
 * fitContent + snapPoints = גובה השיט = גובה ה-snap (מעוגן לתחתית).
 * בלי fitContent ה-container בגובה מסך מלא + translateY חותך את ה-composer.
 */
const SHEET_SNAP = 0.9;

/**
 * תגובות להודעה בקבוצת הכרזות (שרשור, כמו וואטסאפ) — אותו מבנה ומקלדת כמו תגובות לציוץ.
 */
export default function MessageCommentsSheet({
  visible,
  post,
  onClose,
  isGroupAdmin = false,
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
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <MessageCommentsSheetBody
        visible={visible}
        post={post}
        onClose={onClose}
        isGroupAdmin={isGroupAdmin}
        onBusyChange={onBusyChange}
      />
    </BottomSheet>
  );
}

function MessageCommentsSheetBody({
  visible,
  post,
  onClose,
  isGroupAdmin = false,
  onBusyChange,
}: Props & { onBusyChange?: (busy: boolean) => void }) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [replies, setReplies] = useState<MessageComment[]>([]);
  // עדכון מונה התגובות בפיד — מחוץ ל-updater של setReplies (שרץ בזמן רינדור →
  // «Cannot update TweetsFeed while rendering PostRepliesSheetBody»)
  const repliesRef = useRef<MessageComment[]>([]);
  repliesRef.current = replies;
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

  // המונה על ההודעה מתעדכן מהשרת (טריגר + message_update) — כאן אין מה לדווח
  const notifyCount = useCallback((_id: string, _count: number) => {}, []);

  const loadSeqRef = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  const listRef = useRef<FlatList<MessageComment>>(null);

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
        const rows = await fetchMessageComments(postId);
        if (cancelled || seq !== loadSeqRef.current) return;
        setReplies(rows);
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
      const reply = await addMessageComment({
        messageId: current.id,
        groupId: current.groupId,
        body: body.trim(),
      });
      const prevReplies = repliesRef.current;
      if (!prevReplies.some((r) => r.id === reply.id)) {
        const next = [...prevReplies, reply];
        repliesRef.current = next;
        setReplies(next);
        notifyCount(current.id, next.length);
      }
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

  // זמן אמת: תגובה חדשה/נמחקה של אחרים בהודעה הפתוחה (מערוץ הקבוצה)
  useEffect(() => {
    return subscribeToMessageComments((e) => {
      const current = postRef.current;
      if (!current || e.messageId !== current.id) return;
      if (e.op === 'INSERT') {
        if (user && e.userId === user.id) return; // שלי — כבר נוספה מקומית
        if (repliesRef.current.some((r) => r.id === e.id)) return;
        void fetchMessageCommentById(e.id).then((c) => {
          if (!c || repliesRef.current.some((r) => r.id === c.id)) return;
          const next = [...repliesRef.current, c];
          repliesRef.current = next;
          setReplies(next);
        });
        return;
      }
      if (!repliesRef.current.some((r) => r.id === e.id)) return;
      const next = repliesRef.current.filter((r) => r.id !== e.id);
      repliesRef.current = next;
      setReplies(next);
    });
  }, [user]);

  // אישור מחיקה בתוך השיט: דיאלוג האפליקציה (Modal ברמת השורש) נפתח *מתחת* לשיט ולא נראה —
  // לכן לחיצה על מחיקה «לא עשתה כלום». InlineAppDialog מצויר בתוך השיט.
  const [pendingDelete, setPendingDelete] = useState<MessageComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const handleDelete = useCallback((reply: MessageComment) => {
    setDeleteError(null);
    setPendingDelete(reply);
  }, []);
  const confirmDelete = useCallback(async () => {
    const reply = pendingDelete;
    const current = postRef.current;
    if (!reply || !current) return;
    setDeleting(true);
    try {
      await deleteMessageComment(reply.id);
      const next = repliesRef.current.filter((r) => r.id !== reply.id);
      repliesRef.current = next;
      setReplies(next);
      notifyCount(current.id, next.length);
      void HapticFeedback.success();
      setPendingDelete(null);
    } catch {
      setDeleteError('לא ניתן למחוק את התגובה');
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, notifyCount]);

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
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.emptyText, { color: tokens.colors.text.secondary }]}>
              עדיין אין תגובות להודעה. היו הראשונים להגיב
            </Text>
          ) : null
        }
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
          // מחיקה: התגובה שלי, מנהל אפליקציה או מנהל הקבוצה (RLS בהתאם)
          const canDelete = isMine || isAdmin || isGroupAdmin;
          return (
            <View style={styles.replyRow}>
              <UserAvatarButton
                userId={item.author.id}
                name={item.author.displayName}
                uri={item.author.avatarUrl}
                size={36}
                onPress={() => {
                  handleClose();
                  setTimeout(() => openUserProfile(item.author.id), 260);
                }}
              />
              <View style={styles.replyMain}>
                <View style={styles.replyMeta}>
                  <UserNameButton
                    userId={item.author.id}
                    name={item.author.displayName}
                    // סוגרים את השיט קודם — אחרת הוא נשאר מעל הפרופיל
                    onPress={() => {
                      handleClose();
                      setTimeout(() => openUserProfile(item.author.id), 260);
                    }}
                    style={[
                      styles.replyName,
                      { color: tokens.colors.text.primary },
                    ]}
                    numberOfLines={1}
                  />
                  <UserBadges
                    userId={item.author.id}
                    size={badgeSizeForLineHeight(APP_TYPE.cardTitle.lineHeight)}
                  />
                  <View style={styles.replyMetaSpacer} />
                  {canDelete ? (
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={8}
                      accessibilityLabel="מחק תגובה"
                      style={{
                        width: 24,
                        height: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={tokens.colors.text.secondary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.replyTime,
                    { color: tokens.colors.text.secondary },
                  ]}
                >
                  {formatPostTime(item.createdAt)}
                </Text>
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
                    color: tokens.colors.text.primary,
                    ...APP_TYPE.caption,
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
                  ? tokens.colors.primary.lightCta
                  : tokens.colors.background.primary,
              },
            ]}
            accessibilityLabel="שלח תגובה"
          >
            {busy ? (
              <ActivityIndicator size="small" color={tokens.colors.text.inverse} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={canSubmit ? tokens.colors.text.inverse : tokens.colors.text.tertiary}
              />
            )}
          </TouchableOpacity>
        </View>
      </ChatComposerDock>
      <InlineAppDialog
        visible={!!pendingDelete}
        title="מחיקת תגובה"
        message={deleteError || 'למחוק את התגובה?'}
        icon="trash-outline"
        onBackdropPress={deleting ? undefined : () => setPendingDelete(null)}
        buttons={[
          { text: 'מחק', style: 'destructive', onPress: () => void confirmDelete(), loading: deleting },
          { text: 'ביטול', style: 'cancel', onPress: () => setPendingDelete(null) },
        ]}
      />
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
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
      flexShrink: 0,
    },
    headerIconButton: {
      alignSelf: 'center',
      backgroundColor: tokens.colors.background.primary,
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
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
      textAlign: 'center',
      writingDirection: 'rtl',
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
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.screenPaddingHorizontal,
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
      paddingVertical: 10,
    },
    emptyText: {
      ...APP_TYPE.body,
      textAlign: 'center',
      writingDirection: 'rtl',
      paddingVertical: APP_LAYOUT.sectionGap,
    },
    replyMain: {
      flex: 1,
      minWidth: 0,
    },
    replyMeta: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
    },
    replyMetaSpacer: {
      flex: 1,
    },
    replyName: {
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      flexShrink: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    replyTime: {
      ...APP_TYPE.caption,
      marginTop: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    replyBody: {
      ...APP_TYPE.cardBody,
      marginTop: 4,
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
      ...APP_TYPE.cardSubtitle,
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
      ...APP_TYPE.body,
      paddingHorizontal: APP_LAYOUT.cardPadding,
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
