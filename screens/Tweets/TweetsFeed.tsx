import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { legacyAlert } from '../../utils/appDialog';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { TweetCardSkeleton } from './TweetCardSkeleton';
import { useAuth } from '../../context/AuthContext';
import {
  deleteCommunityPost,
  fetchCommunityPosts,
  fetchFollowedUserIds,
  formatPostTime,
  likeCommunityPost,
  subscribeToCommunityPosts,
  unlikeCommunityPost,
  type CommunityFeedMode,
} from '../../services/tweetsService';
import type { CommunityPost } from '../../types/tweets.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import PostRepliesSheet from './PostRepliesSheet';
import EntityEmbedCard from '../../components/share/EntityEmbedCard';
import { openUserProfile } from '../../lib/openUserProfile';
import FollowUserButton from '../../components/profile/FollowUserButton';
import UserAvatarButton from '../../components/profile/UserAvatarButton';
import UserNameButton from '../../components/profile/UserNameButton';
import CommunityPostImage from './CommunityPostImage';

const PAGE_SIZE = 30;
const DIVIDER = 'rgba(255, 255, 255, 0.12)';

const FEED_TABS: { id: CommunityFeedMode; label: string }[] = [
  { id: 'for_you', label: 'בשבילך' },
  { id: 'following', label: 'עוקבים' },
];

function cacheKeyFor(mode: CommunityFeedMode) {
  return typeof appQueryKeys.tweetsList === 'function'
    ? appQueryKeys.tweetsList(mode)
    : (['community', 'posts', mode] as const);
}

export type TweetsFeedHandle = {
  prependPost: (post: CommunityPost) => void;
  refresh: () => void;
};

type TweetsFeedProps = {
  /** Ref רגיל (לא forwardRef) — Babel/Metro ידידותי */
  handleRef?: React.MutableRefObject<TweetsFeedHandle | null>;
};

function PostCard({
  post,
  isMine,
  onLike,
  onReply,
  onShare,
  onDelete,
  currentUserId,
  following,
  onFollowingChange,
}: {
  post: CommunityPost;
  isMine: boolean;
  onLike: () => void;
  onReply: () => void;
  onShare: () => void;
  onDelete: () => void;
  currentUserId?: string | null;
  following: boolean;
  onFollowingChange: (userId: string, following: boolean) => void;
}) {
  const tokens = useDesignTokens();
  const pad = tokens.layout?.screenPadding ?? 20;
  const contentPad = tokens.spacing.md;
  const attachments = post.attachments?.length
    ? post.attachments
    : post.attachment
      ? [post.attachment]
      : [];
  const hasMedia = !!post.imageUrl || attachments.length > 0;

  return (
    <View style={{ marginHorizontal: pad, marginBottom: 12 }}>
      <UICard
        variant="blur"
        padding="none"
        disableBlur
        style={{
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        }}
      >
        <Pressable
          onPress={onReply}
          accessibilityRole="button"
          accessibilityLabel="פתח תגובות"
          style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
        >
          <View style={{ padding: contentPad, gap: 10 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <UserAvatarButton
              userId={post.author.id}
              name={post.author.displayName}
              uri={post.author.avatarUrl}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <UserNameButton
                  userId={post.author.id}
                  name={post.author.displayName}
                  style={{
                    color: tokens.colors.text.primary,
                    fontWeight: '700',
                    fontSize: 15,
                    writingDirection: 'rtl',
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                />
                <FollowUserButton
                  userId={post.author.id}
                  following={following}
                  onFollowingChange={onFollowingChange}
                />
              </View>
              <Text
                style={{
                  color: tokens.colors.text.tertiary,
                  fontSize: 12,
                  marginTop: 2,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                }}
              >
                {formatPostTime(post.createdAt)}
              </Text>
            </View>
            {isMine ? (
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={10}
                accessibilityLabel="מחק ציוץ"
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={tokens.colors.text.tertiary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text
            style={{
              color: tokens.colors.text.primary,
              fontSize: 15,
              lineHeight: 22,
              writingDirection: 'rtl',
              textAlign: 'right',
            }}
          >
            {post.body}
          </Text>

          {post.mentions?.length ? (
            <View
              style={{
                direction: 'rtl',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {post.mentions.map((m) => (
                <TouchableOpacity
                  key={m.userId}
                  onPress={() => {
                    openUserProfile(m.userId, { currentUserId });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: tokens.borderRadius.button,
                    backgroundColor: `${tokens.colors.primary.main}22`,
                  }}
                  accessibilityLabel={`פרופיל של ${m.displayName}`}
                >
                  <Text
                    style={{
                      color: tokens.colors.primary.main,
                      fontSize: 12,
                      fontWeight: '700',
                      writingDirection: 'rtl',
                      textAlign: 'right',
                    }}
                    numberOfLines={1}
                  >
                    @{m.displayName.replace(/\s+/g, '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {hasMedia ? (
            <View style={{ gap: tokens.spacing.sm }}>
              {post.imageUrl ? (
                <CommunityPostImage
                  uri={post.imageUrl}
                  borderRadius={tokens.borderRadius['2xl']}
                />
              ) : null}
              {attachments.map((att, i) => (
                <EntityEmbedCard
                  key={`${att.ref.type}-${att.ref.id}-${i}`}
                  attachment={att}
                  compact
                />
              ))}
            </View>
          ) : null}
          </View>
        </Pressable>

        <View style={{ height: 1, backgroundColor: DIVIDER }} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: tokens.spacing.lg,
            paddingVertical: tokens.spacing.md,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={onLike}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              height: 36,
              borderRadius: tokens.borderRadius.button,
              backgroundColor: post.likedByMe
                ? 'rgba(255, 59, 92, 0.15)'
                : 'rgba(255,255,255,0.06)',
            }}
            accessibilityLabel={post.likedByMe ? 'הסר לייק' : 'לייק'}
          >
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={18}
              color={post.likedByMe ? '#FF3B5C' : tokens.colors.text.secondary}
            />
            {post.likeCount > 0 ? (
              <Text
                style={{
                  color: tokens.colors.text.secondary,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {post.likeCount}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onReply}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              height: 36,
              borderRadius: tokens.borderRadius.button,
              backgroundColor: tokens.colors.glass.card.bg,
            }}
            accessibilityLabel="תגובות"
          >
            <Ionicons
              name="chatbubble-outline"
              size={17}
              color={tokens.colors.text.secondary}
            />
            {post.replyCount > 0 ? (
              <Text
                style={{
                  color: tokens.colors.text.secondary,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {post.replyCount}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShare}
            style={{
              width: 36,
              height: 36,
              borderRadius: tokens.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.colors.glass.card.bg,
            }}
            accessibilityLabel="שתף"
          >
            <Ionicons
              name="share-outline"
              size={18}
              color={tokens.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </UICard>
    </View>
  );
}

function FeedTabToggle({
  value,
  onChange,
}: {
  value: CommunityFeedMode;
  onChange: (tab: CommunityFeedMode) => void;
}) {
  const tokens = useDesignTokens();
  const pad = tokens.layout?.screenPadding ?? 20;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row-reverse',
        paddingHorizontal: pad,
        paddingBottom: tokens.spacing.md,
        backgroundColor: 'transparent',
      }}
    >
      {FEED_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              if (!active) void HapticFeedback.selection();
              onChange(tab.id);
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={`פיד ציוצים: ${tab.label}`}
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingTop: tokens.spacing.sm,
              backgroundColor: 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: tokens.typography.body.size,
                fontWeight: active
                  ? (tokens.typography.fontWeight.bold as '700')
                  : (tokens.typography.fontWeight.medium as '500'),
                color: active
                  ? tokens.colors.text.primary
                  : tokens.colors.text.secondary,
                backgroundColor: 'transparent',
              }}
            >
              {tab.label}
            </Text>
            <View
              style={{
                marginTop: 8,
                height: 2,
                alignSelf: 'stretch',
                marginHorizontal: 12,
                backgroundColor: active ? tokens.colors.text.primary : 'transparent',
              }}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TweetsFeed({ handleRef }: TweetsFeedProps) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [feedMode, setFeedMode] = useState<CommunityFeedMode>('for_you');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyPost, setReplyPost] = useState<CommunityPost | null>(null);
  const loadingMoreLock = useRef(false);
  const postsLenRef = useRef(0);
  const feedModeRef = useRef(feedMode);
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());
  const followedIdsRef = useRef<Set<string>>(new Set());
  postsLenRef.current = posts.length;
  feedModeRef.current = feedMode;

  const cacheKey = useMemo(() => cacheKeyFor(feedMode), [feedMode]);

  const refreshFollowedIds = useCallback(async () => {
    const ids = await fetchFollowedUserIds();
    const next = new Set(ids);
    followedIdsRef.current = next;
    setFollowedIds(next);
    return ids;
  }, []);

  const handleFollowingChange = useCallback(
    (userId: string, nextFollowing: boolean) => {
      setFollowedIds((prev) => {
        const copy = new Set(prev);
        if (nextFollowing) copy.add(userId);
        else copy.delete(userId);
        followedIdsRef.current = copy;
        return copy;
      });
    },
    []
  );

  const prependPost = useCallback(
    (post: CommunityPost) => {
      if (feedModeRef.current === 'following') {
        if (!followedIdsRef.current.has(post.userId)) return;
      }
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        const next = [post, ...prev];
        queryClient.setQueryData(cacheKeyFor(feedModeRef.current), next.slice(0, PAGE_SIZE));
        return next;
      });
    },
    []
  );

  const loadPage = useCallback(
    async (opts: { reset: boolean; mode: CommunityFeedMode }) => {
      if (opts.reset) {
        setError(null);
      } else {
        if (loadingMoreLock.current) return;
        loadingMoreLock.current = true;
        setLoadingMore(true);
      }

      try {
        if (opts.mode === 'following') {
          await refreshFollowedIds();
        }

        const page = await fetchCommunityPosts({
          limit: PAGE_SIZE,
          offset: opts.reset ? 0 : postsLenRef.current,
          mode: opts.mode,
        });

        const key = cacheKeyFor(opts.mode);

        setPosts((prev) => {
          const next = opts.reset ? page.posts : [...prev, ...page.posts];
          const seen = new Set<string>();
          const unique = next.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
          unique.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          if (opts.reset) {
            queryClient.setQueryData(key, unique.slice(0, PAGE_SIZE));
          }
          return unique;
        });
        setHasMore(page.hasMore);
      } catch (e: any) {
        setError(e?.message || 'לא ניתן לטעון ציוצים');
        if (opts.reset) setPosts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreLock.current = false;
      }
    },
    [refreshFollowedIds]
  );

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      prependPost,
      refresh: () => {
        setRefreshing(true);
        void loadPage({ reset: true, mode: feedModeRef.current });
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, loadPage, prependPost]);

  useEffect(() => {
    const cached = queryClient.getQueryData<CommunityPost[]>(cacheKey);
    if (cached?.length) {
      setPosts(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setPosts([]);
    }
    setHasMore(true);
    setError(null);
    void loadPage({ reset: true, mode: feedMode });
  }, [feedMode, loadPage, cacheKey]);

  useEffect(() => {
    if (!user) {
      followedIdsRef.current = new Set();
      setFollowedIds(new Set());
      return;
    }
    void refreshFollowedIds();
  }, [feedMode, refreshFollowedIds, user]);

  useEffect(() => {
    const unsub = subscribeToCommunityPosts((post) => {
      prependPost(post);
    });
    return unsub;
  }, [prependPost]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPage({ reset: true, mode: feedModeRef.current });
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore && !refreshing) {
      void loadPage({ reset: false, mode: feedModeRef.current });
    }
  }, [hasMore, loadPage, loading, loadingMore, refreshing]);

  const handleFeedModeChange = useCallback((mode: CommunityFeedMode) => {
    if (mode === feedModeRef.current) return;
    setFeedMode(mode);
  }, []);

  const handleLike = useCallback(async (post: CommunityPost) => {
    const liked = post.likedByMe;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !liked,
              likeCount: Math.max(0, p.likeCount + (liked ? -1 : 1)),
            }
          : p
      )
    );
    try {
      if (liked) {
        void HapticFeedback.selection();
        await unlikeCommunityPost(post.id);
      } else {
        void HapticFeedback.impactLight();
        await likeCommunityPost(post.id);
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByMe: liked,
                likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)),
              }
            : p
        )
      );
      legacyAlert('שגיאה', 'לא ניתן לעדכן לייק');
    }
  }, []);

  const handleShare = useCallback(async (post: CommunityPost) => {
    void HapticFeedback.selection();
    try {
      await Share.share({
        message: `${post.author.displayName}:\n${post.body}`,
      });
    } catch {
      /* cancelled */
    }
  }, []);

  const handleOpenReplies = useCallback((post: CommunityPost) => {
    void HapticFeedback.selection();
    setReplyPost(post);
  }, []);

  const handleReplyCountChange = useCallback(
    (postId: string, replyCount: number) => {
      setPosts((prev) => {
        const cur = prev.find((p) => p.id === postId);
        if (!cur || cur.replyCount === replyCount) return prev;
        return prev.map((p) => (p.id === postId ? { ...p, replyCount } : p));
      });
    },
    []
  );

  const handleDelete = useCallback((post: CommunityPost) => {
    Alert.alert('מחיקת ציוץ', 'למחוק את הציוץ לצמיתות?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteCommunityPost(post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
              void HapticFeedback.success();
            } catch {
              legacyAlert('שגיאה', 'לא ניתן למחוק את הציוץ');
            }
          })();
        },
      },
    ]);
  }, []);

  if (loading && posts.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <FeedTabToggle value={feedMode} onChange={handleFeedModeChange} />
        <View>
          {Array.from({ length: 5 }).map((_, i) => (
            <TweetCardSkeleton key={i} delay={i * 70} />
          ))}
        </View>
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <FeedTabToggle value={feedMode} onChange={handleFeedModeChange} />
        <View style={styles.center}>
        <Ionicons
          name="cloud-offline-outline"
          size={40}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.errorTitle}>לא ניתן לטעון ציוצים</Text>
        <Text style={styles.hint}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            void loadPage({ reset: true, mode: feedModeRef.current });
          }}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>נסה שוב</Text>
        </TouchableOpacity>
        </View>
      </View>
    );
  }

  const emptyMessage =
    feedMode === 'following'
      ? !user
        ? 'התחברו כדי לראות ציוצים ממי שאתם עוקבים אחריו'
        : 'אין עדיין ציוצים ממי שאתם עוקבים אחריו'
      : 'היו הראשונים — לחצו על + ופרסמו ציוץ לקהילה';

  return (
    <>
      <View style={{ flex: 1 }}>
        <FeedTabToggle value={feedMode} onChange={handleFeedModeChange} />
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              isMine={!!user && item.userId === user.id}
              currentUserId={user?.id}
              following={followedIds.has(item.userId)}
              onFollowingChange={handleFollowingChange}
              onLike={() => void handleLike(item)}
              onReply={() => handleOpenReplies(item)}
              onShare={() => void handleShare(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={40}
                color={tokens.colors.text.tertiary}
              />
              <Text style={styles.errorTitle}>
                {feedMode === 'following' ? 'אין ציוצים במעקב' : 'עדיין אין ציוצים'}
              </Text>
              <Text style={styles.hint}>{emptyMessage}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <TweetCardSkeleton delay={0} />
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.colors.primary.main}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={
            posts.length === 0 ? { flexGrow: 1 } : { paddingBottom: 8 }
          }
          style={{ flex: 1 }}
        />
      </View>
      <PostRepliesSheet
        visible={!!replyPost}
        post={replyPost}
        onClose={() => setReplyPost(null)}
        onReplyCountChange={handleReplyCountChange}
      />
    </>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
      paddingVertical: 40,
    },
    hint: {
      color: tokens.colors.text.tertiary,
      fontSize: 14,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 20,
    },
    errorTitle: {
      color: tokens.colors.text.primary,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    retryBtn: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: tokens.borderRadius.button,
      backgroundColor: tokens.colors.primary.dim,
    },
    retryText: {
      color: tokens.colors.primary.main,
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
