import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from 'lucide-react-native';
import { Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import {
  settingsCaptionType,
  settingsGroupLabelStyle,
  settingsHebrewText,
  settingsRowType,
} from '../../components/profile/settingsType';
import {
  fetchPublicUserProfile,
  fetchUserFollowStats,
  isFollowingUser,
  toggleFollowUser,
  type PublicUserProfile,
  type UserFollowStats,
} from '../../services/userFollowService';
import {
  fetchCommunityPostsByUser,
  formatPostTime,
} from '../../services/tweetsService';
import type { CommunityPost } from '../../types/tweets.types';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';

type RouteParams = {
  PublicUserProfile: { userId: string };
};

function formatMemberSince(iso: string | null): string {
  if (!iso) return 'חבר קהילה';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'חבר קהילה';
  return `חבר מאז ${date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`;
}

export default function PublicUserProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PublicUserProfile'>>();
  const userId = route.params?.userId ?? '';
  const { user } = useAuth();
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [stats, setStats] = useState<UserFollowStats>({
    followerCount: 0,
    followingCount: 0,
  });
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = !!user && user.id === userId;

  const loadAll = useCallback(async () => {
    if (!userId) {
      setError('משתמש לא נמצא');
      setLoading(false);
      return;
    }

    if (isSelf) {
      navigation.replace('ProfileMain');
      return;
    }

    try {
      setError(null);
      const [prof, followStats, followState, userPosts] = await Promise.all([
        fetchPublicUserProfile(userId),
        fetchUserFollowStats(userId),
        user ? isFollowingUser(userId) : Promise.resolve(false),
        fetchCommunityPostsByUser(userId, 20),
      ]);

      if (!prof) {
        setError('לא נמצא פרופיל למשתמש');
        setProfile(null);
        setPosts([]);
        return;
      }

      setProfile(prof);
      setStats(followStats);
      setFollowing(followState);
      setPosts(userPosts);
    } catch (e: any) {
      setError(e?.message || 'לא ניתן לטעון את הפרופיל');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSelf, navigation, user, userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadAll();
  }, [loadAll]);

  const handleFollowToggle = useCallback(async () => {
    if (!user) {
      legacyAlert('התחברות', 'יש להתחבר כדי לעקוב אחרי משתמשים');
      return;
    }
    if (followBusy || isSelf) return;

    setFollowBusy(true);
    void HapticFeedback.impactLight();
    const prevFollowing = following;
    const prevStats = stats;

    try {
      const nowFollowing = await toggleFollowUser(userId);
      setFollowing(nowFollowing);
      setStats((s) => ({
        ...s,
        followerCount: Math.max(
          0,
          s.followerCount + (nowFollowing ? 1 : -1)
        ),
      }));
      void HapticFeedback.success();
    } catch {
      setFollowing(prevFollowing);
      setStats(prevStats);
      legacyAlert('שגיאה', 'לא הצלחנו לעדכן את המעקב');
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, following, isSelf, stats, user, userId]);

  const headerBlock = profile ? (
    <UICard
      variant="soft"
      padding="none"
      style={styles.heroCard}
    >
      <View style={styles.heroRow}>
        <View style={styles.avatarWrap}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <User size={26} color={tokens.colors.text.primary} strokeWidth={2} />
          )}
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.displayName, { color: tokens.colors.text.primary }]}>
            {profile.displayName}
          </Text>
          <Text style={[styles.memberSince, { color: tokens.colors.text.tertiary }]}>
            {formatMemberSince(profile.memberSince)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: tokens.colors.text.primary }]}>
            {stats.followerCount}
          </Text>
          <Text style={[styles.statLabel, { color: tokens.colors.text.tertiary }]}>
            עוקבים
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: tokens.colors.border.divider }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: tokens.colors.text.primary }]}>
            {stats.followingCount}
          </Text>
          <Text style={[styles.statLabel, { color: tokens.colors.text.tertiary }]}>
            במעקב
          </Text>
        </View>
      </View>

      {!isSelf ? (
        <TouchableOpacity
          onPress={() => {
            void handleFollowToggle();
          }}
          disabled={followBusy}
          style={[
            styles.followBtn,
            {
              backgroundColor: following
                ? tokens.colors.background.navChrome
                : tokens.colors.primary.main,
            },
          ]}
          accessibilityLabel={following ? 'הפסק מעקב' : 'עקוב'}
        >
          {followBusy ? (
            <ActivityIndicator
              size="small"
              color={following ? tokens.colors.text.primary : '#fff'}
            />
          ) : (
            <Text
              style={[
                styles.followBtnText,
                {
                  color: following ? tokens.colors.text.primary : '#fff',
                },
              ]}
            >
              {following ? 'במעקב' : 'עקוב'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </UICard>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="פרופיל"
          onBack={() => navigation.goBack()}
        />

        {loading && !profile ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={tokens.colors.primary.main} />
          </View>
        ) : error && !profile ? (
          <View style={styles.center}>
            <Text style={{ color: tokens.colors.text.secondary, textAlign: 'center' }}>
              {error}
            </Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={tokens.colors.primary.main}
              />
            }
            ListHeaderComponent={
              <>
                {headerBlock}
                <Text style={[styles.sectionTitle, { color: tokens.colors.text.secondary }]}>
                  ציוצים אחרונים
                </Text>
              </>
            }
            ListEmptyComponent={
              <Text style={[styles.emptyPosts, { color: tokens.colors.text.tertiary }]}>
                אין ציוצים עדיין
              </Text>
            }
            renderItem={({ item }) => (
              <UICard variant="soft" padding="none" style={styles.postCard}>
                <Text
                  style={[styles.postBody, { color: tokens.colors.text.primary }]}
                  numberOfLines={6}
                >
                  {item.body}
                </Text>
                <Text style={[styles.postTime, { color: tokens.colors.text.tertiary }]}>
                  {formatPostTime(item.createdAt)}
                </Text>
              </UICard>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: tokens.spacing.xl,
    },
    heroCard: {
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: APP_LAYOUT.cardStackGap,
      padding: APP_LAYOUT.cardPadding,
      borderRadius: UI_CARD_RADIUS,
    },
    heroRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    avatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    heroText: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: tokens.spacing.xs,
    },
    displayName: {
      ...settingsHebrewText,
      ...settingsRowType,
      width: '100%',
    },
    memberSince: {
      ...settingsCaptionType,
      marginTop: APP_LAYOUT.titleSubtitleGap,
      width: '100%',
    },
    statsRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: tokens.spacing.lg,
      gap: tokens.spacing.lg,
    },
    statBox: {
      alignItems: 'center',
      minWidth: 72,
    },
    statValue: {
      ...APP_TYPE.cardMetricValueSecondary,
    },
    statLabel: {
      ...settingsCaptionType,
      marginTop: APP_LAYOUT.titleSubtitleGap,
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    followBtn: {
      marginTop: APP_LAYOUT.componentGap,
      minHeight: 44,
      borderRadius: tokens.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    followBtnText: {
      ...APP_TYPE.body,
      fontWeight: '700',
    },
    listContent: {
      paddingBottom: tokens.spacing['3xl'],
    },
    sectionTitle: {
      ...settingsGroupLabelStyle,
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    },
    postCard: {
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: APP_LAYOUT.cardStackGap,
      padding: APP_LAYOUT.cardPadding,
      borderRadius: UI_CARD_RADIUS,
    },
    postBody: {
      ...settingsHebrewText,
      ...APP_TYPE.cardBody,
    },
    postTime: {
      ...settingsCaptionType,
      marginTop: APP_LAYOUT.titleSubtitleGap,
    },
    emptyPosts: {
      textAlign: 'center',
      paddingVertical: tokens.spacing.xl,
      writingDirection: 'rtl',
    },
  });
}
