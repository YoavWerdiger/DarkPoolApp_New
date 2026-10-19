/**
 * פרופיל ציבורי של משתמש — מינימלי, לפי הטופו:
 * תמונה + שם + תגים, כרטיס «ותק» בולט (השור והדוב בצבע המתכת של הדרגה + התקדמות),
 * עוקבים / עוקב אחרי / ציוצים (לחיצה פותחת רשימה), כפתור מעקב, והציוצים האחרונים.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { UserBadges, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import { RankMarkIcon } from '../../components/ui/badges/RankMarkIcon';
import { RankSheet } from '../../components/ui/badges/RankSheet';
import { formatPaidTenure, rankColor, rankProgress } from '../../components/ui/badges/userRank';
import { useUserBadges } from '../../hooks/useUserBadges';
import {
  fetchPublicUserProfile,
  fetchUserFollowList,
  fetchUserFollowStats,
  followUser,
  isFollowingUser,
  unfollowUser,
  type FollowListUser,
  type PublicUserProfile,
} from '../../services/userFollowService';
import { fetchCommunityPostsByUser, formatPostTime } from '../../services/tweetsService';
import type { CommunityPost } from '../../types/tweets.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';

const AVATAR = 92;

function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `חבר קהילה מאז ${d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`;
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-US');
}

export default function PublicProfileScreen({ route, navigation }: any) {
  const userId: string = route?.params?.userId ?? '';
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const isSelf = !!user && user.id === userId;

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 });
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [rankOpen, setRankOpen] = useState(false);
  const [listKind, setListKind] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<FollowListUser[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const badges = useUserBadges(userId);
  const progress = badges?.paidDays != null ? rankProgress(badges.paidDays) : null;
  const metalColor = progress
    ? rankColor(progress.rank.metal, isDarkMode, {
        grayToken: tokens.colors.text.tertiary,
        brandGreen: tokens.colors.primary.main,
      })
    : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchPublicUserProfile(userId),
      fetchUserFollowStats(userId),
      isSelf ? Promise.resolve(false) : isFollowingUser(userId),
      fetchCommunityPostsByUser(userId, 20).catch(() => [] as CommunityPost[]),
    ]).then(([p, s, f, ps]) => {
      if (cancelled) return;
      setProfile(p);
      setStats(s);
      setFollowing(f);
      setPosts(ps);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isSelf]);

  const toggleFollow = useCallback(async () => {
    if (!user) {
      legacyAlert('התחברות', 'יש להתחבר כדי לעקוב אחרי משתמשים');
      return;
    }
    if (followBusy || isSelf) return;
    const next = !following;
    void HapticFeedback.selection();
    setFollowBusy(true);
    setFollowing(next);
    setStats((s) => ({ ...s, followerCount: Math.max(0, s.followerCount + (next ? 1 : -1)) }));
    try {
      if (next) await followUser(userId);
      else await unfollowUser(userId);
    } catch {
      setFollowing(!next);
      setStats((s) => ({ ...s, followerCount: Math.max(0, s.followerCount + (next ? -1 : 1)) }));
      legacyAlert('שגיאה', 'לא ניתן לעדכן מעקב כרגע');
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, following, isSelf, user, userId]);

  const openList = useCallback(
    (kind: 'followers' | 'following') => {
      void HapticFeedback.selection();
      setListKind(kind);
      setListUsers([]);
      setListLoading(true);
      void fetchUserFollowList(userId, kind).then((rows) => {
        setListUsers(rows);
        setListLoading(false);
      });
    },
    [userId]
  );

  const openOther = useCallback(
    (otherId: string) => {
      setListKind(null);
      if (otherId === userId) return;
      // אחרי סגירת השיט — כדי שלא יישאר מעל המסך הבא
      setTimeout(() => navigation.push('PublicProfile', { userId: otherId }), 220);
    },
    [navigation, userId]
  );

  const name = profile?.displayName ?? '';
  const memberSince = formatMemberSince(profile?.memberSince ?? null);

  return (
    <ScreenChrome rtl>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <DayNavBlurButton
          size={DAY_NAV_BUTTON_SIZE}
          onPress={() => navigation.goBack()}
          accessibilityLabel="חזרה"
        >
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
        </DayNavBlurButton>
      </View>

      {loading && !profile ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.text.secondary} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={[styles.muted, { textAlign: 'center' }]}>הפרופיל לא נמצא</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          {/* זהות */}
          <View style={styles.identity}>
            <View style={[styles.avatarRing, metalColor ? { borderColor: metalColor } : null]}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{name.charAt(0) || '?'}</Text>
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <UserBadges userId={userId} size={badgeSizeForLineHeight(APP_TYPE.screenTitle.lineHeight)} />
            </View>
            {memberSince ? <Text style={styles.muted}>{memberSince}</Text> : null}
          </View>

          {/* מספרים */}
          <View style={styles.statsRow}>
            <Stat label="עוקבים" value={stats.followerCount} onPress={() => openList('followers')} styles={styles} />
            <View style={styles.statDivider} />
            <Stat label="עוקב אחרי" value={stats.followingCount} onPress={() => openList('following')} styles={styles} />
            <View style={styles.statDivider} />
            <Stat label="ציוצים" value={posts.length} styles={styles} />
          </View>

          {/* פעולה */}
          {isSelf ? (
            <UIButton
              title="עריכת פרופיל"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => navigation.navigate('Profile')}
            />
          ) : (
            <UIButton
              title={following ? 'במעקב' : 'עקוב'}
              variant={following ? 'secondary' : 'primary'}
              size="md"
              fullWidth
              loading={followBusy}
              onPress={() => void toggleFollow()}
            />
          )}

          {/* ותק — הדגש של הפרופיל */}
          {progress && metalColor ? (
            <Pressable
              onPress={() => {
                void HapticFeedback.selection();
                setRankOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="דרגת ותק"
              style={({ pressed }) => [styles.rankWrap, pressed && { opacity: 0.9 }]}
            >
              <UICard variant="soft" padding="md" style={styles.rankCard}>
                <View style={styles.rankRow}>
                  <View style={[styles.rankMarkTile, { backgroundColor: `${metalColor}1F` }]}>
                    <RankMarkIcon metal={progress.rank.metal} size={36} />
                  </View>
                  <View style={styles.rankText}>
                    <Text style={styles.rankLabel}>ותק בקהילה</Text>
                    <Text style={[styles.rankTitle, { color: metalColor }]} numberOfLines={1}>
                      {formatPaidTenure(badges?.paidDays ?? 0)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
                </View>
                <View style={[styles.track, { backgroundColor: tokens.colors.border.divider }]}>
                  <View
                    style={[styles.fill, { width: `${Math.round(progress.progress * 100)}%`, backgroundColor: metalColor }]}
                  />
                </View>
                <Text style={styles.rankFoot}>
                  {progress.next && progress.daysToNext != null
                    ? `עוד ${progress.daysToNext} ימים לדרגה הבאה · ${progress.next.rangeLabel}`
                    : 'הדרגה הגבוהה ביותר'}
                </Text>
              </UICard>
            </Pressable>
          ) : null}

          {/* ציוצים */}
          <Text style={styles.sectionTitle}>ציוצים</Text>
          {posts.length === 0 ? (
            <Text style={styles.muted}>עדיין אין ציוצים</Text>
          ) : (
            <UICard variant="soft" padding="none" style={styles.postsCard}>
              {posts.map((p, i) => (
                <View
                  key={p.id}
                  style={[styles.postRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.border.divider }]}
                >
                  <Text style={styles.postBody} numberOfLines={4}>
                    {p.body}
                  </Text>
                  <View style={styles.postMeta}>
                    <Text style={styles.postMetaText}>{formatPostTime(p.createdAt)}</Text>
                    <View style={styles.postMetaStats}>
                      <Ionicons name="heart-outline" size={13} color={tokens.colors.text.tertiary} />
                      <Text style={styles.postMetaText}>{p.likeCount}</Text>
                      <Ionicons name="chatbubble-outline" size={13} color={tokens.colors.text.tertiary} style={{ marginStart: 10 }} />
                      <Text style={styles.postMetaText}>{p.replyCount}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </UICard>
          )}
        </ScrollView>
      )}

      {badges?.paidDays != null ? (
        <RankSheet visible={rankOpen} onClose={() => setRankOpen(false)} paidDays={badges.paidDays} />
      ) : null}

      <BottomSheet
        isOpen={listKind != null}
        onClose={() => setListKind(null)}
        snapPoints={[0.7]}
        showHandle
        enablePanDownToClose
        useModal
        edgeToEdge
        showBrandBackground={false}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{listKind === 'following' ? 'עוקב אחרי' : 'עוקבים'}</Text>
          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={tokens.colors.text.secondary} />
          ) : listUsers.length === 0 ? (
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>
              {listKind === 'following' ? 'עדיין לא עוקב אחרי אף אחד' : 'עדיין אין עוקבים'}
            </Text>
          ) : (
            <FlatList
              data={listUsers}
              keyExtractor={(u) => u.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => openOther(item.id)}
                  style={({ pressed }) => [
                    styles.listRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.border.divider },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.listAvatar} />
                  ) : (
                    <View style={[styles.listAvatar, styles.avatarFallback]}>
                      <Text style={styles.listInitial}>{item.displayName.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.listName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <UserBadges userId={item.id} size={badgeSizeForLineHeight(APP_TYPE.cardTitle.lineHeight)} interactive={false} />
                </Pressable>
              )}
            />
          )}
        </View>
      </BottomSheet>
    </ScreenChrome>
  );
}

function Stat({
  label,
  value,
  onPress,
  styles,
}: {
  label: string;
  value: number;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.7 }]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    topBar: {
      direction: 'rtl',
      flexDirection: 'row',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 6,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    scroll: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      gap: 20,
    },
    identity: {
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    avatarRing: {
      width: AVATAR + 8,
      height: AVATAR + 8,
      borderRadius: (AVATAR + 8) / 2,
      borderWidth: 2,
      borderColor: tokens.colors.border.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    avatarFallback: {
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 34,
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },
    nameRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    name: {
      ...APP_TYPE.screenTitle,
      color: tokens.colors.text.primary,
      flexShrink: 1,
    },
    muted: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
    },
    statsRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
    },
    statValue: {
      ...APP_TYPE.cardMetricValue,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      marginTop: 2,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: tokens.colors.border.divider,
    },
    rankWrap: {
      alignSelf: 'stretch',
    },
    rankCard: {
      gap: 12,
    },
    rankRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rankMarkTile: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      flex: 1,
      minWidth: 0,
    },
    rankLabel: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    rankTitle: {
      ...APP_TYPE.cardTitle,
      fontSize: 18,
      textAlign: 'right',
      marginTop: 2,
    },
    track: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    rankFoot: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
    sectionTitle: {
      ...APP_TYPE.sectionTitle,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      marginTop: 8,
      marginBottom: -8,
    },
    postsCard: {
      overflow: 'hidden',
    },
    postRow: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 14,
      gap: 8,
    },
    postBody: {
      ...APP_TYPE.body,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    postMeta: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    postMetaStats: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    postMetaText: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.tertiary,
      fontVariant: ['tabular-nums'],
    },
    sheet: {
      flex: 1,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
    },
    sheetTitle: {
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      marginBottom: 12,
    },
    listRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    listAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    listInitial: {
      fontSize: 16,
      fontWeight: '600',
      color: tokens.colors.text.primary,
    },
    listName: {
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      flexShrink: 1,
    },
  });
}
