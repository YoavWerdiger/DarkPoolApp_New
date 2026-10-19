/**
 * פרופיל ציבורי של משתמש — מינימלי, לפי הטופו:
 * תמונה + שם + תגים, כרטיס «ותק» בולט (השור והדוב בצבע המתכת של הדרגה + התקדמות),
 * עוקבים / עוקב אחרי (לחיצה פותחת רשימה), כפתור מעקב, והציוצים האחרונים.
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
import { APP_TYPE, appPhysicalRightText, appSectionTitleStyle } from '../../components/ui/appType';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { UserBadges, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import { RankMarkIcon } from '../../components/ui/badges/RankMarkIcon';
import { RankSheet } from '../../components/ui/badges/RankSheet';
import {
  USER_RANK_LADDER,
  formatPaidTenure,
  rankColor,
  rankProgress,
  type RankMetal,
} from '../../components/ui/badges/userRank';
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

/** שמות הדרגות — לפי צבע המתכת (העליונה בירוק המותג) */
const RANK_NAMES: Record<RankMetal, string> = {
  gray: 'פתיחה',
  silver: 'כסף',
  gold: 'זהב',
  platinum: 'פלטינה',
  sapphire: 'ספיר',
  diamond: 'יהלום',
  brand: 'DarkPool',
};

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
    <View style={styles.root}>
      {/* אותו רקע כמו דפי הפרופיל (צ'אט); תת-עץ RTL — טקסט לימין דרך appPhysicalRightText */}
      <ChatSessionBackdrop />
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <DayNavBlurButton
          size={DAY_NAV_BUTTON_SIZE}
          onPress={() => {
            // רטט כמו בשאר כפתורי החזרה באפליקציה
            void HapticFeedback.selection();
            navigation.goBack();
          }}
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
            {memberSince ? <Text style={[styles.muted, { textAlign: 'center' }]}>{memberSince}</Text> : null}
          </View>

          {/* מספרים */}
          <View style={styles.statsRow}>
            <Stat label="עוקבים" value={stats.followerCount} onPress={() => openList('followers')} styles={styles} />
            <View style={styles.statDivider} />
            <Stat label="עוקב אחרי" value={stats.followingCount} onPress={() => openList('following')} styles={styles} />

          </View>

          {/* פעולה */}
          {isSelf ? (
            <UIButton
              title="עריכת פרופיל"
              variant="secondary"
              size="md"
              fullWidth
              style={styles.pillButton}
              onPress={() => navigation.navigate('Profile')}
            />
          ) : (
            <UIButton
              title={following ? 'במעקב' : 'עקוב'}
              variant={following ? 'secondary' : 'primary'}
              size="md"
              fullWidth
              style={styles.pillButton}
              loading={followBusy}
              onPress={() => void toggleFollow()}
            />
          )}

          {/* ותק — הדגש של הפרופיל: סמל הדרגה עם הילה, שם הדרגה, ומסלול 7 הדרגות */}
          {progress && metalColor ? (
            <Pressable
              onPress={() => {
                void HapticFeedback.selection();
                setRankOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`דרגת ותק: ${RANK_NAMES[progress.rank.metal]}`}
              style={({ pressed }) => [styles.rankWrap, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
            >
              <UICard variant="soft" padding="none" style={styles.rankCard}>
                <View style={styles.rankInner}>
                  <View style={styles.rankRow}>
                    {/* אריח ניטרלי — הצבע של הדרגה מופיע רק בשם ובמסלול */}
                    <View style={[styles.rankMarkTile, { backgroundColor: tokens.colors.background.tertiary }]}>
                      <RankMarkIcon metal={progress.rank.metal} size={34} />
                    </View>
                    <View style={styles.rankText}>
                      <Text style={styles.rankLabel}>ותק בקהילה</Text>
                      <Text style={[styles.rankTitle, { color: metalColor }]} numberOfLines={1}>
                        {`דרגת ${RANK_NAMES[progress.rank.metal]}`}
                      </Text>
                      <Text style={styles.rankTenure} numberOfLines={1}>
                        {formatPaidTenure(badges?.paidDays ?? 0)}
                      </Text>
                    </View>
                  </View>

                  {/* מסלול הדרגות — כל נקודה דרגה; עד הנוכחית מלא בצבע הדרגה */}
                  <View style={styles.ladder}>
                    {USER_RANK_LADDER.map((r, idx) => {
                      const done = r.level < progress.rank.level;
                      const current = r.level === progress.rank.level;
                      const segFill =
                        r.level < progress.rank.level
                          ? 1
                          : r.level === progress.rank.level
                            ? progress.progress
                            : 0;
                      return (
                        <React.Fragment key={r.level}>
                          <View
                            style={[
                              current ? styles.ladderDotCurrent : styles.ladderDot,
                              {
                                backgroundColor: done || current ? metalColor : tokens.colors.border.divider,
                                borderColor: current ? `${metalColor}55` : 'transparent',
                              },
                            ]}
                          />
                          {idx < USER_RANK_LADDER.length - 1 ? (
                            <View style={[styles.ladderSeg, { backgroundColor: tokens.colors.border.divider }]}>
                              <View style={[styles.ladderSegFill, { width: `${Math.round(segFill * 100)}%`, backgroundColor: metalColor }]} />
                            </View>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </View>

                  <View style={styles.rankFootRow}>
                    <Text style={styles.rankFoot} numberOfLines={1}>
                      {progress.next && progress.daysToNext != null
                        ? `עוד ${progress.daysToNext} ימים לדרגת ${RANK_NAMES[progress.next.metal]}`
                        : 'הדרגה הגבוהה בקהילה'}
                    </Text>
                    <Ionicons name="chevron-back" size={16} color={tokens.colors.text.tertiary} />
                  </View>
                </View>
              </UICard>
            </Pressable>
          ) : null}

          {/* ציוצים */}
          <Text style={styles.sectionTitle}>ציוצים</Text>
          {posts.length === 0 ? (
            <Text style={[styles.muted, appPhysicalRightText]}>עדיין אין ציוצים</Text>
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
    </View>
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
    // תת-עץ RTL (כמו Dark Pool): שורות מימין לשמאל; טקסט לימין דרך appPhysicalRightText
    root: {
      flex: 1,
      backgroundColor: 'transparent',
      direction: 'rtl',
    },
    topBar: {
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    name: {
      textAlign: 'center',
      ...APP_TYPE.screenTitle,
      color: tokens.colors.text.primary,
      flexShrink: 1,
    },
    muted: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // מרווח בין «עוקבים» ל«עוקב אחרי» — שני עמודים צמודים למרכז ולא נמתחים לקצוות
      gap: 28,
    },
    // כמו כפתור «עקוב/במעקב» בשאר הפרופילים — עגול מלא
    pillButton: {
      borderRadius: 999,
    },
    stat: {
      minWidth: 88,
      alignItems: 'center',
      paddingVertical: 4,
    },
    statValue: {
      textAlign: 'center',
      ...APP_TYPE.cardMetricValue,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      textAlign: 'center',
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
      overflow: 'hidden',
    },
    rankInner: {
      padding: APP_LAYOUT.cardPadding,
      gap: 16,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    rankMarkTile: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    rankLabel: {
      ...appPhysicalRightText,
      ...APP_TYPE.caption,
      color: tokens.colors.text.secondary,
    },
    rankTitle: {
      ...appPhysicalRightText,
      ...APP_TYPE.cardTitle,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '800',
    },
    rankTenure: {
      ...appPhysicalRightText,
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.primary,
    },
    ladder: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ladderDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    ladderDotCurrent: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 3,
    },
    ladderSeg: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      marginHorizontal: 3,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    ladderSegFill: {
      height: '100%',
      borderRadius: 2,
    },
    rankFootRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rankFoot: {
      ...appPhysicalRightText,
      ...APP_TYPE.caption,
      flex: 1,
      color: tokens.colors.text.secondary,
    },
    sectionTitle: {
      ...appSectionTitleStyle,
      color: tokens.colors.text.primary,
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
      ...appPhysicalRightText,
      ...APP_TYPE.body,
      color: tokens.colors.text.primary,
    },
    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    postMetaStats: {
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
      ...appPhysicalRightText,
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      flexShrink: 1,
    },
  });
}
