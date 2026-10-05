// ============================================
// Chat Groups List Screen - Modern Design (Exact Copy)
// ============================================

import React, { useMemo, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  Animated,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useSubscription } from '../../hooks/useSubscription';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupChatIcon } from '../../assets/chatGroups/groupChatIcons';
import { useChat, useChatActions } from '../../context/ChatContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  dispatchOpenMainDrawer,
  consumePendingOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { MainDrawerRegistration } from '../../navigation/MainDrawerRegistration';
import { supabase } from '../../lib/supabase';
import { ChatGroup } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { Search } from 'lucide-react-native';
import JoinGroupBottomSheet from '../../components/chat/JoinGroupBottomSheet';
import CreateGroupSheet from '../../components/chat/CreateGroupSheet';
import { ChatBottomSheet, ChatSheetEmptyState, ChatSheetLoading } from '../../components/chat/ChatBottomSheet';
import { ChatSearchResult } from '../../types/chat.types';
import StoryViewer from '../../components/chat/StoryViewer';
import AddStoryFullScreen from '../../components/chat/AddStoryFullScreen';
import StoryAvatarRing from '../../components/chat/StoryAvatarRing';
import { getUsersWithStories, StoryWithUser } from '../../services/storiesService';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { schedulePrefetchChatMessages, warmChatGroupFromDisk, warmChatGroupOnPress } from '../../services/appPrefetch';
import { chatGroupOpenParams, type ChatOpenHint } from '../../lib/chatOpenPrime';
import { lockAndroidChatSoftInput } from '../../components/chat/androidChatKeyboard';
import { logger } from '../../utils/logger';
import { getChatMessagePreview } from '../../utils/chatMessagePreview';
import { isUsableChatDisplayName } from '../../lib/chatMessageIdentity';
import { isAnnouncementGroup } from '../../utils/isAnnouncementGroup';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { CHAT_LAYOUT, chatSectionTitleStyle } from '../../components/chat/chatLayout';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';

// Skeleton row for groups list
const SkeletonGroupRow = React.memo(({ delay }: { delay: number }) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, []);
  return (
    <Animated.View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingVertical: 15, opacity }}>
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 12 }} />
      <View style={{ flex: 1, gap: 8, alignItems: 'flex-end' }}>
        <View style={{ height: 13, width: '60%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 6 }} />
        <View style={{ height: 11, width: '80%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
      </View>
      <View style={{ width: 36, height: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
    </Animated.View>
  );
});

// RTL is configured once inside the component via useEffect (not at module level)

// Tab types
type TabType = 'all' | 'unread' | 'mentions';

interface GroupWithMembership extends Omit<ChatGroup, 'my_role'> {
  is_member: boolean;
  my_membership_id?: string;
  my_role?: ChatGroup['my_role'];
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
    message_type?: string;
  } | null;
}

function contextGroupsToListRows(groups: ChatGroup[]): GroupWithMembership[] {
  return groups.map((cg) => {
    const hasPreview =
      cg.last_message_preview != null && String(cg.last_message_preview).length > 0;
    const hasActivity = Boolean(cg.last_message_at);
    return {
      ...cg,
      is_member: true,
      my_role: cg.my_role,
      last_message:
        hasPreview || hasActivity
          ? {
              content: hasPreview ? String(cg.last_message_preview) : '',
              sender_name: cg.last_message_sender_name || '',
              created_at: cg.last_message_at || '',
              message_type: cg.last_message_type,
            }
          : undefined,
    };
  });
}

function avatarUri(source: ImageSourcePropType | null): string | null {
  if (source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
}

const GROUP_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  'הכרזות': 'megaphone',
  'דיונים - כללי': 'chatbubbles',
  'דיונים - כללי 🗣️': 'chatbubbles',
  'שאלות תשובות': 'help-circle',
  'שאלות תשובות ⁉️🗣️': 'help-circle',
  'שאלות ותשובות בשוק': 'help-circle',
  'דיוני - פניסטוקס': 'trending-up',
  'דיוני - פניסטוקס 🚨🗣️': 'trending-up',
  'סווינגים והשקעות': 'swap-horizontal',
  'סווינגים והשקעות 🌟🔇': 'swap-horizontal',
  'סווינגים וסטאפים': 'swap-horizontal',
  'ניתוחים ורעיונות שלכם': 'analytics',
  'ניתוחים ורעיונות שלכם 🗣️': 'analytics',
  'נטו ניתוחים!': 'analytics',
  'רווחים והצלחות': 'trophy',
  'רווחים והצלחות 💰': 'trophy',
  'שאלות בלייבים': 'videocam',
  'שאלות בלייבים 🎥🗣️': 'videocam',
  'מסחר יומי': 'flash',
  'מסחר יומי 🌟🔇': 'flash',
  'עסקאות מסחר יומי': 'flash',
  'בורסה ישראלית': 'flag',
  'בורסה ישראלית 🇮🇱🗣️': 'flag',
  'פניסטוקס (סיכון גבוה)': 'warning',
  'פניסטוקס (סיכון גבוה)🌟🔇': 'warning',
  'מסחר פניסטוקס - סיכון גבוה': 'warning',
};

// פורמט זמן יחסי
const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `${diffMins}ד׳`;
  if (diffHours < 24) return `${diffHours}ש׳`;
  if (diffDays < 7) return `${diffDays}י׳`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};

export default function ChatGroupsListScreen() {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { groups: contextGroups } = useChat();
  const { primeGroupForOpen } = useChatActions();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  /**
   * כש־Profile לחץ על תפריט, הדגל pendingOpenMainDrawer מוצב + ניווט חוזר ל־Main.
   * כאן (מסך ברירת המחדל של ה־drawer) צורכים את הדגל ופותחים את המגירה מהנאב שלנו.
   */
  useFocusEffect(
    useCallback(() => {
      if (!consumePendingOpenMainDrawer()) return;
      const timer = setTimeout(() => {
        try {
          dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
        } catch {
          /* noop */
        }
      }, 60);
      return () => clearTimeout(timer);
    }, [navigation])
  );

  const [allGroups, setAllGroups] = useState<GroupWithMembership[]>(() => {
    if (!user?.id) return [];
    const cached = queryClient.getQueryData<ChatGroup[]>(appQueryKeys.chatGroups(user.id));
    return cached?.length ? contextGroupsToListRows(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const imageErrorsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<TextInput>(null);
  const isLoadingRef = useRef(false);
  const [imageErrorCount, setImageErrorCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [messageResults, setMessageResults] = useState<ChatSearchResult[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [joinGroupSheet, setJoinGroupSheet] = useState<{ visible: boolean; group: GroupWithMembership | null }>({ visible: false, group: null });
  const [isJoining, setIsJoining] = useState(false);
  const [addStorySheetVisible, setAddStorySheetVisible] = useState(false);
  // זריעה אופטימית מה-cache (בזיכרון) — שורת ה-Stories מופיעה מיד בכניסה חוזרת
  const [usersWithStories, setUsersWithStories] = useState<StoryWithUser[]>(
    () => queryClient.getQueryData<StoryWithUser[]>(appQueryKeys.storiesUsers) ?? []
  );
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyViewerInitialIndex, setStoryViewerInitialIndex] = useState(0);
  const storiesScrollRef = useRef<ScrollView>(null);
  const [createGroupSheetVisible, setCreateGroupSheetVisible] = useState(false);

  // בדיקת admin — האם המשתמש admin בלפחות קבוצה אחת
  const { isAdmin: isAppAdmin } = useIsAdmin();
  const { isPremium: isPremiumUser } = useSubscription();
  // אדמין אפליקציה או אדמין באחת הקבוצות — יכול ליצור קבוצה
  const isGlobalAdmin = useMemo(
    () => isAppAdmin || allGroups.some(g => g.my_role === 'admin'),
    [allGroups, isAppAdmin]
  );

  const loadGroups = async () => {
    if (!user) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    const hasLocalRows =
      allGroups.length > 0 ||
      Boolean(user?.id && queryClient.getQueryData(appQueryKeys.chatGroups(user.id)));
    if (!hasLocalRows) setIsLoading(true);
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('chat_groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (groupsError) {
        isLoadingRef.current = false;
        setIsLoading(false);
        legacyAlert('שגיאה', 'לא ניתן לטעון את הקבוצות. נסה שוב.');
        return;
      }

      // סנן קבוצות דמה שנוצרו במיגרציה
      const realGroups = groups?.filter(group => {
        const name = group.name || '';
        // סנן קבוצות מיגרציה
        if (name.includes('מיגרציה') || name.includes('מיגרציה - לא בשימוש')) {
          return false;
        }
        // סנן קבוצות ללא שם או עם שם ריק
        if (!name.trim()) {
          return false;
        }
        return true;
      }) || [];

      const { data: memberships } = await supabase
        .from('chat_group_members')
        .select('id, group_id, unread_count, mentioned_count, role')
        .eq('user_id', user.id);

      const myGroupIds = new Set(memberships?.map(m => m.group_id) || []);
      const membershipMap = new Map(memberships?.map(m => [m.group_id, m.id]) || []);
      const unreadCountMap = new Map(memberships?.map(m => [m.group_id, m.unread_count || 0]) || []);
      const mentionedCountMap = new Map(memberships?.map(m => [m.group_id, m.mentioned_count || 0]) || []);
      const roleMap = new Map(memberships?.map(m => [m.group_id, m.role]) || []);

      // Batch-load last messages for all groups in a single query using DISTINCT ON
      const groupIds = realGroups.map(g => g.id);
      const { data: lastMessages } = await supabase
        .rpc('get_last_messages_for_groups', { group_ids: groupIds })
        .select('*');

      // Fallback: if RPC doesn't exist yet, load with a single query per approach
      let lastMessageMap = new Map<string, any>();
      if (lastMessages && lastMessages.length > 0) {
        for (const msg of lastMessages) {
          lastMessageMap.set(msg.group_id, msg);
        }
      } else {
        // Fallback: single batch query for all groups – limit to 1 per group via a subquery approach.
        // We load the most recent 1 message per group by fetching groupIds.length records max.
        const { data: batchMessages } = await supabase
          .from('chat_messages')
          .select(`
            group_id,
            content,
            message_type,
            created_at,
            sender_id,
            users!chat_messages_sender_id_fkey(id, display_name, full_name)
          `)
          .in('group_id', groupIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(groupIds.length * 5); // at most 5 recent msgs per group to find latest

        if (batchMessages) {
          for (const msg of batchMessages) {
            if (!lastMessageMap.has(msg.group_id)) {
              lastMessageMap.set(msg.group_id, msg);
            }
          }
        }
      }

      const getMessagePreview = (msg: any): string =>
        getChatMessagePreview(msg.message_type, msg.content);

      // RPC מחזיר sender_id בלי join ל-users — שולפים שמות ב-batch (SECURITY DEFINER)
      const senderIds = [
        ...new Set(
          [...lastMessageMap.values()]
            .map((m: { sender_id?: string }) => m.sender_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      const senderNameById: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: nameRows } = await supabase.rpc('get_user_display_names', {
          user_ids: senderIds,
        });
        for (const row of (nameRows || []) as Array<{ id: string; display_name: string }>) {
          if (row?.id && isUsableChatDisplayName(row.display_name)) {
            senderNameById[row.id] = row.display_name;
          }
        }
      }

      const resolveSenderName = (lastMessage: any): string => {
        const users = lastMessage?.users ?? lastMessage?.sender;
        if (users) {
          const userData = Array.isArray(users) ? users[0] : users;
          const fromJoin = userData?.display_name || userData?.full_name;
          if (fromJoin) return fromJoin;
        }
        if (lastMessage?.sender_id && senderNameById[lastMessage.sender_id]) {
          return senderNameById[lastMessage.sender_id];
        }
        return '';
      };

      const groupsWithLastMessage = realGroups.map((g) => {
        const lastMessage = lastMessageMap.get(g.id);

        return {
          ...g,
          is_member: myGroupIds.has(g.id),
          my_membership_id: membershipMap.get(g.id),
          my_role: roleMap.get(g.id),
          unread_count: unreadCountMap.get(g.id) || 0,
          mentioned_count: mentionedCountMap.get(g.id) || 0,
          last_message: lastMessage
            ? {
                content: getMessagePreview(lastMessage),
                sender_name: resolveSenderName(lastMessage),
                created_at: lastMessage.created_at,
                message_type: lastMessage.message_type,
              }
            : null,
        };
      });

      setAllGroups(groupsWithLastMessage);
      if (user?.id) {
        queryClient.setQueryData(appQueryKeys.chatGroups(user.id), groupsWithLastMessage);
        // חימום הודעות (עדיפות ל-unread) — כניסה מיידית כמו WhatsApp
        const unreadIds = groupsWithLastMessage
          .filter((g) => (g.unread_count || 0) > 0)
          .map((g) => g.id);
        if (unreadIds.length > 0) {
          schedulePrefetchChatMessages(user.id, { groupIds: unreadIds });
        } else {
          schedulePrefetchChatMessages(user.id);
        }
      }
    } catch (error) {
      logger.error('ChatGroupsListScreen', 'loadGroups failed', error);
      legacyAlert('שגיאה', 'לא ניתן לטעון את הקבוצות');
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const loadStories = useCallback(async () => {
    try {
      const data = await getUsersWithStories(user?.id);
      setUsersWithStories(data);
      queryClient.setQueryData(appQueryKeys.storiesUsers, data);
    } catch (error) {
      logger.error('ChatGroupsListScreen', 'Failed to load stories', error);
      setUsersWithStories([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    // רק טעינת הרשימה המקומית — ChatContext כבר טוען groups ב-mount לפי user.id
    // (syncContextGroups כפול היה מייצר שני fetch-ים מקבילים ומכביד על הכניסה).
    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount/reload רק כשמשתנה זהות המשתמש
  }, [user?.id]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  // חימום אגרסיבי כשהרשימה גלויה — קבוצות עם unread + האחרונות
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      schedulePrefetchChatMessages(user.id, { limit: 12 });
    }, [user?.id]),
  );

  // M8: removed useFocusEffect – realtime updates from contextGroups replace manual re-fetch on focus

  // M8: contextGroups is the single source of truth for live data; merge all fields on change
  useLayoutEffect(() => {
    if (allGroups.length > 0) return;
    const source =
      contextGroups?.length
        ? contextGroups
        : user?.id
          ? queryClient.getQueryData<ChatGroup[]>(appQueryKeys.chatGroups(user.id))
          : undefined;
    if (source?.length) {
      setAllGroups(contextGroupsToListRows(source));
    }
  }, [allGroups.length, contextGroups, user?.id]);

  useEffect(() => {
    if (!contextGroups || contextGroups.length === 0) return;

    setAllGroups(prev => {
      if (prev.length === 0) {
        return contextGroupsToListRows(contextGroups);
      }
      let changed = false;
      const next = prev.map(group => {
        const cg = contextGroups.find(c => c.id === group.id);
        if (!cg) return group;

        const nextSenderName = isUsableChatDisplayName(cg.last_message_sender_name)
          ? String(cg.last_message_sender_name)
          : group.last_message_at !== cg.last_message_at
            ? ''
            : group.last_message?.sender_name || '';
        const nextType = cg.last_message_type ?? group.last_message?.message_type;
        const hasChange =
          group.unread_count !== (cg.unread_count || 0) ||
          group.mentioned_count !== (cg.mentioned_count || 0) ||
          group.last_message_at !== cg.last_message_at ||
          group.last_message_preview !== cg.last_message_preview ||
          group.last_message?.sender_name !== nextSenderName ||
          group.last_message?.message_type !== nextType ||
          (group as any).is_muted !== (cg as any).is_muted;

        if (!hasChange) return group;
        changed = true;
        const hasPreview =
          cg.last_message_preview != null && String(cg.last_message_preview).length > 0;
        const hasActivity = Boolean(cg.last_message_at);
        return {
          ...group,
          unread_count: cg.unread_count || 0,
          mentioned_count: cg.mentioned_count || 0,
          last_message_at: cg.last_message_at,
          last_message_preview: cg.last_message_preview,
          last_message_sender_name: cg.last_message_sender_name ?? group.last_message_sender_name,
          is_muted: (cg as any).is_muted,
          last_message:
            hasPreview || hasActivity
              ? {
                  content: hasPreview
                    ? String(cg.last_message_preview)
                    : group.last_message?.content || '',
                  sender_name: nextSenderName,
                  created_at: cg.last_message_at ?? group.last_message?.created_at ?? '',
                  message_type: nextType,
                }
              : group.last_message,
        };
      });
      return changed ? next : prev; // avoid re-render if nothing changed
    });
  }, [contextGroups]);

  // פונקציה להחזרת אייקון לפי סוג ההודעה (מזהה הקלטה גם מתוכן JSON ללא message_type)
  const getMessageTypeIcon = (messageType?: string, content?: string): string | null => {
    switch (messageType) {
      case 'image': return 'image-outline';
      case 'video': return 'videocam-outline';
      case 'audio': return 'mic-outline';
      case 'document': return 'document-text-outline';
    }
    const trimmed = (content ?? '').trim();
    if (
      trimmed.startsWith('{') &&
      (trimmed.includes('waveformData') || trimmed.includes('"waveform"'))
    ) {
      return 'mic-outline';
    }
    return null;
  };

  // Filter groups - פיצול ל-2 sections: הקבוצות שלי + קבוצות זמינות להצטרפות
  const { myFilteredGroups, joinableFilteredGroups, myAnnouncementCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = (g: GroupWithMembership) => {
      if (!q) return true;
      return (
        (g.name || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    };

    // is_public מוגדר ב-settings JSONB. ברירת מחדל: קבוצה גלויה = ניתנת להצטרפות.
    // רק אם מפורש `is_public === false` נסתיר אותה מהסקשן של joinable.
    const isJoinablePublic = (g: GroupWithMembership) => {
      const s = (g as any).settings as { is_public?: boolean; allowed_tiers?: string[] } | undefined;
      if (s?.is_public === false) return false;
      // מסלולים מורשים (חינמי/פרימיום) — אדמין רואה הכול
      const tiers = Array.isArray(s?.allowed_tiers) ? s!.allowed_tiers : null;
      if (tiers && tiers.length > 0 && !isGlobalAdmin) {
        return tiers.includes(isPremiumUser ? 'premium' : 'free');
      }
      return true;
    };

    const my = allGroups.filter(g => g.is_member && matchesQuery(g));
    const joinable = allGroups.filter(
      g => !g.is_member && isJoinablePublic(g) && matchesQuery(g)
    );

    let myFiltered = my;
    switch (activeTab) {
      case 'unread':
        myFiltered = my.filter(g => (g.unread_count || 0) > 0);
        break;
      case 'mentions':
        myFiltered = my.filter(g => (g.mentioned_count || 0) > 0);
        break;
      case 'all':
      default:
        break;
    }

    // מיון "הקבוצות שלי": הכרזות למעלה, ואחר כך לפי last_message_at (חדש קודם)
    const sortByLastMessage = (groups: GroupWithMembership[]) =>
      [...groups].sort((a, b) => {
        const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return timeB - timeA;
      });

    const announcements = sortByLastMessage(
      myFiltered.filter(g => isAnnouncementGroup(g.name, g.id))
    );
    const regular = sortByLastMessage(
      myFiltered.filter(g => !isAnnouncementGroup(g.name, g.id))
    );
    const mySorted = [...announcements, ...regular];

    // Joinable מוצגות רק בטאב 'all' — 'unread'/'mentions' לא רלוונטיות
    const joinableSorted =
      activeTab === 'all'
        ? [...joinable].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'he')
          )
        : [];

    return {
      myFilteredGroups: mySorted,
      joinableFilteredGroups: joinableSorted,
      myAnnouncementCount: announcements.length,
    };
  }, [allGroups, searchQuery, activeTab, isGlobalAdmin, isPremiumUser]);

  // רשימה מאוחדת לצורכי חיפוש-שיט וספירות empty-state
  const filteredGroups = useMemo(
    () => [...myFilteredGroups, ...joinableFilteredGroups],
    [myFilteredGroups, joinableFilteredGroups]
  );

  // מבנה נתונים לרשימה עצמה (עם section headers)
  type ListRow =
    | { type: 'section-header'; id: string; title: string; count: number }
    | {
        type: 'my-group';
        id: string;
        group: GroupWithMembership;
        isLastAnnouncement: boolean;
        isLastInSection: boolean;
      }
    | {
        type: 'joinable-group';
        id: string;
        group: GroupWithMembership;
        isLastInSection: boolean;
      };

  const listData = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];

    if (myFilteredGroups.length > 0) {
      rows.push({
        type: 'section-header',
        id: 'hdr-my',
        title: 'הקבוצות שלי',
        count: myFilteredGroups.length,
      });
      myFilteredGroups.forEach((g, i) => {
        rows.push({
          type: 'my-group',
          id: `my-${g.id}`,
          group: g,
          isLastAnnouncement:
            myAnnouncementCount > 0 && i === myAnnouncementCount - 1,
          isLastInSection: i === myFilteredGroups.length - 1,
        });
      });
    }

    if (joinableFilteredGroups.length > 0) {
      rows.push({
        type: 'section-header',
        id: 'hdr-joinable',
        title: 'קבוצות זמינות להצטרפות',
        count: joinableFilteredGroups.length,
      });
      joinableFilteredGroups.forEach((g, i) => {
        rows.push({
          type: 'joinable-group',
          id: `join-${g.id}`,
          group: g,
          isLastInSection: i === joinableFilteredGroups.length - 1,
        });
      });
    }

    return rows;
  }, [myFilteredGroups, joinableFilteredGroups, myAnnouncementCount]);

  const unreadCount = useMemo(() => 
    allGroups.filter(g => g.is_member && (g.unread_count || 0) > 0).length, 
    [allGroups]
  );

  const mentionsCount = useMemo(() =>
    allGroups.filter(g => g.is_member && (g.mentioned_count || 0) > 0).length,
    [allGroups]
  );

  const handleJoinGroup = async (group: GroupWithMembership) => {
    if (!user) return;

    setIsJoining(true);
    try {
      const { error } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'member',
        });

      if (error) {
        void HapticFeedback.error();
        legacyAlert('שגיאה', 'לא הצלחנו להצטרף');
        setIsJoining(false);
        return;
      }

      void HapticFeedback.success();
      // סגור את ה-BottomSheet ונווט לקבוצה
      setJoinGroupSheet({ visible: false, group: null });
      setIsJoining(false);
      setAllGroups((prev) =>
        prev.map((g) =>
          g.id === group.id ? { ...g, is_member: true, my_role: 'member' } : g,
        ),
      );
      void HapticFeedback.impactLight();
      prepareChatOpen(group);
      (navigation as any).navigate('ChatGroup', chatGroupOpenParams(group));
      void loadGroups();
    } catch (error: any) {
      setIsJoining(false);
      legacyAlert('שגיאה', error?.message || 'שגיאה לא צפויה');
    }
  };

  const prepareChatOpen = useCallback((group: Pick<GroupWithMembership, 'id' | 'name' | 'avatar_url' | 'unread_count' | 'last_read_message_id' | 'my_role'>) => {
    lockAndroidChatSoftInput();
    const hint: ChatOpenHint = {
      name: chatGroupDisplayName(group.name),
      avatar_url: group.avatar_url,
      unread_count: group.unread_count,
      last_read_message_id: group.last_read_message_id,
      my_role: group.my_role,
    };
    primeGroupForOpen(group.id, hint);
    if (user?.id) warmChatGroupOnPress(user.id, group.id);
  }, [primeGroupForOpen, user?.id]);

  const handleGroupPress = useCallback((group: GroupWithMembership) => {
    setSearchSheetVisible(false);
    if (!group.is_member) {
      void HapticFeedback.selection();
      setJoinGroupSheet({ visible: true, group });
      return;
    }
    // אל תסגור מקלדת לפני navigate — באנדרואיד Keyboard.dismiss + adjustResize
    // דוחים את first paint של ה-thread ב-300–400ms. ADJUST_NOTHING כבר ננעל ב-onPressIn.
    void HapticFeedback.impactLight();
    prepareChatOpen(group);
    (navigation as any).navigate('ChatGroup', chatGroupOpenParams(group));
  }, [prepareChatOpen, navigation]);

  const openJoinSheet = useCallback((group: GroupWithMembership) => {
    void HapticFeedback.selection();
    setJoinGroupSheet({ visible: true, group });
  }, []);

  const closeSearchSheet = useCallback(() => {
    setSearchSheetVisible(false);
    setSearchQuery('');
    setMessageResults([]);
  }, []);

  const handleMessageResultPress = useCallback((result: ChatSearchResult) => {
    setSearchSheetVisible(false);
    void HapticFeedback.impactLight();
    const group = result.group;
    if (group?.id) prepareChatOpen(group);
    (navigation as any).navigate('ChatGroup', chatGroupOpenParams(group ?? { id: '' }, {
      scrollToMessageId: result.message?.id,
    }));
  }, [prepareChatOpen, navigation]);

  useEffect(() => {
    if (!searchSheetVisible) return;
    const t = setTimeout(() => {
      try {
        searchInputRef.current?.focus();
      } catch {
        /* non-critical */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchSheetVisible]);

  // חיפוש תוכן הודעות (חוצה קבוצות) — debounced, רק כשהשיט פתוח
  useEffect(() => {
    if (!searchSheetVisible) return;
    const term = searchQuery.trim();
    if (!user?.id || term.length < 2) {
      setMessageResults([]);
      setSearchingMessages(false);
      return;
    }

    let cancelled = false;
    setSearchingMessages(true);
    const t = setTimeout(async () => {
      try {
        const memberGroups = allGroups.filter((g) => g.is_member);
        const groupIds = memberGroups.map((g) => g.id);
        if (groupIds.length === 0) {
          if (!cancelled) setMessageResults([]);
          return;
        }
        const groupMap = new Map(memberGroups.map((g) => [g.id, g]));
        const escaped = term.replace(/[%_\\]/g, '\\$&');

        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            id, content, message_type, created_at, group_id,
            sender:users!chat_messages_sender_id_fkey (id, display_name, profile_picture)
          `)
          .in('group_id', groupIds)
          .eq('is_deleted', false)
          .ilike('content', `%${escaped}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (error || !data) {
          if (error) logger.warn('ChatGroupsList', 'message search failed', error);
          setMessageResults([]);
          return;
        }

        const results: ChatSearchResult[] = (data as any[]).map((msg) => {
          const g = groupMap.get(msg.group_id) as GroupWithMembership | undefined;
          const content: string = msg.content || '';
          const idx = content.toLowerCase().indexOf(term.toLowerCase());
          const start = Math.max(0, idx - 40);
          const end = Math.min(content.length, idx + term.length + 60);
          const highlight = idx >= 0 ? `${start > 0 ? '…' : ''}${content.substring(start, end)}` : content;
          return {
            message: msg,
            group: { id: g?.id ?? msg.group_id, name: g?.name ?? '', avatar_url: g?.avatar_url ?? null } as any,
            highlights: [highlight],
          } as ChatSearchResult;
        });

        setMessageResults(results);
      } catch (e) {
        if (!cancelled) {
          logger.warn('ChatGroupsList', 'message search error', e);
          setMessageResults([]);
        }
      } finally {
        if (!cancelled) setSearchingMessages(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, searchSheetVisible, user?.id, allGroups]);

  type SearchRow =
    | { type: 'header'; id: string; title: string }
    | { type: 'group'; id: string; group: GroupWithMembership }
    | { type: 'message'; id: string; result: ChatSearchResult }
    | { type: 'loading'; id: string }
    | { type: 'empty'; id: string };

  const searchSheetRows = useMemo<SearchRow[]>(() => {
    const rows: SearchRow[] = [];
    if (filteredGroups.length > 0) {
      rows.push({ type: 'header', id: 'h-groups', title: 'צ׳אטים' });
      for (const g of filteredGroups) rows.push({ type: 'group', id: `g-${g.id}`, group: g });
    }
    const term = searchQuery.trim();
    if (term.length >= 2) {
      rows.push({ type: 'header', id: 'h-msgs', title: 'הודעות' });
      if (searchingMessages) {
        rows.push({ type: 'loading', id: 'msgs-loading' });
      } else if (messageResults.length > 0) {
        messageResults.forEach((r, i) =>
          rows.push({ type: 'message', id: `m-${r.message?.id ?? i}-${i}`, result: r })
        );
      } else {
        rows.push({ type: 'empty', id: 'msgs-empty' });
      }
    }
    return rows;
  }, [filteredGroups, searchQuery, searchingMessages, messageResults]);

  const renderSearchRow = useCallback(({ item }: { item: SearchRow }) => {
    if (item.type === 'header') {
      return <Text style={styles.searchSectionHeader}>{item.title}</Text>;
    }
    if (item.type === 'loading') {
      return <View style={{ paddingVertical: 20 }}><ChatSheetLoading label="מחפש הודעות..." /></View>;
    }
    if (item.type === 'empty') {
      return (
        <Text style={styles.searchNoResults}>לא נמצאו הודעות תואמות</Text>
      );
    }
    if (item.type === 'group') {
      const group = item.group;
      const imageSource =
        groupChatIcon(group.name, isDarkMode) ||
        (group.avatar_url ? { uri: group.avatar_url } : null);
      const imageUri = avatarUri(imageSource);
      const hasImageError = imageUri ? imageErrorsRef.current.has(imageUri) : false;
      const preview = group.is_member && group.last_message
        ? getChatMessagePreview(group.last_message.message_type, group.last_message.content)
        : group.is_member
          ? 'אין הודעות עדיין'
          : `${group.members_count || 0} חברים`;
      return (
        <TouchableOpacity
          style={styles.searchRowItem}
          activeOpacity={0.6}
          delayPressIn={0}
          onPress={() => handleGroupPress(group)}
          onPressIn={() => {
            if (group.is_member) prepareChatOpen(group);
          }}
        >
          {imageSource && !hasImageError ? (
            <Image source={imageSource} style={styles.searchRowAvatar} resizeMode="cover" />
          ) : (
            <View style={[styles.searchRowAvatar, styles.searchRowAvatarPlaceholder]}>
              <Ionicons name={GROUP_ICONS[group.name] || 'chatbubbles'} size={22} color={tokens.colors.text.secondary} />
            </View>
          )}
          <View style={styles.searchRowBody}>
            <Text
              style={[
                styles.searchRowTitle,
              ]}
              numberOfLines={1}
            >
              {chatGroupDisplayName(group.name)}
            </Text>
            <Text style={styles.searchRowSubtitle} numberOfLines={1}>{preview}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    // message
    const msg = item.result.message as any;
    const group = item.result.group as any;
    const senderName = msg?.sender?.display_name || 'משתמש';
    const groupName = group?.name || '';
    const groupImage =
      (groupName ? groupChatIcon(groupName, isDarkMode) : null) ||
      (group?.avatar_url ? { uri: group.avatar_url } : null);
    const preview = item.result.highlights?.[0]
      || (msg?.message_type && msg.message_type !== 'text'
        ? getChatMessagePreview(msg.message_type, msg?.content)
        : msg?.content || '');
    const timeLabel = msg?.created_at ? formatRelativeTime(msg.created_at) : '';
    return (
      <TouchableOpacity
        style={styles.searchRowItem}
        activeOpacity={0.6}
        delayPressIn={0}
        onPress={() => handleMessageResultPress(item.result)}
        onPressIn={() => {
          const g = item.result.group;
          if (g?.id) prepareChatOpen(g);
        }}
      >
        {groupImage ? (
          <Image source={groupImage} style={styles.searchRowAvatar} resizeMode="cover" />
        ) : (
          <View style={[styles.searchRowAvatar, styles.searchRowAvatarPlaceholder]}>
            <Ionicons name="chatbubbles" size={22} color={tokens.colors.text.secondary} />
          </View>
        )}
        <View style={styles.searchRowBody}>
          <View style={styles.searchRowMsgHead}>
            <Text style={styles.searchRowTitle} numberOfLines={1}>{chatGroupDisplayName(groupName)}</Text>
            {timeLabel ? <Text style={styles.searchRowTime}>{timeLabel}</Text> : null}
          </View>
            <Text style={styles.searchRowSubtitle} numberOfLines={2}>
            <Text style={styles.searchSenderName}>{senderName}: </Text>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleGroupPress, handleMessageResultPress, prepareChatOpen, tokens, styles, isDarkMode]);

  const renderMyGroup = useCallback(
    (item: GroupWithMembership, isLastAnnouncement: boolean, isLastInSection: boolean) => {
      const iconName = GROUP_ICONS[item.name] || 'chatbubbles';
      const hasUnread = (item.unread_count || 0) > 0;
      const hasMentions = (item.mentioned_count || 0) > 0;
      const imageSource =
        groupChatIcon(item.name, isDarkMode) ||
        (item.avatar_url ? { uri: item.avatar_url } : null);
      const imageUri = avatarUri(imageSource);
      const hasImageError = imageUri ? imageErrorsRef.current.has(imageUri) : false;

      const previewBody =
        (item.last_message_preview
          ? getChatMessagePreview(item.last_message?.message_type, item.last_message_preview)
          : '') ||
        (item.last_message
          ? getChatMessagePreview(item.last_message.message_type, item.last_message.content)
          : '');
      const senderLabel =
        item.last_message_sender_name || item.last_message?.sender_name || '';
      const lastMsgPreview = item.last_message
        ? isUsableChatDisplayName(senderLabel)
          ? `${senderLabel}: ${previewBody}`
          : previewBody || 'אין הודעות עדיין'
        : 'אין הודעות עדיין';

      const timeLabel = item.last_message_at
        ? formatRelativeTime(item.last_message_at)
        : item.last_message
          ? formatRelativeTime(item.last_message.created_at)
          : '';

      return (
        <View key={`group-wrapper-${item.id}`}>
          <TouchableOpacity
            style={styles.chatRow}
            onPress={() => handleGroupPress(item)}
            onPressIn={() => {
              if (item.is_member) prepareChatOpen(item);
            }}
            delayPressIn={0}
            activeOpacity={0.6}
          >
            <View style={styles.avatarWrap}>
              {imageSource && !hasImageError ? (
                <Image
                  source={imageSource}
                  style={styles.avatar}
                  resizeMode="cover"
                  onError={() => {
                    if (imageUri && !imageErrorsRef.current.has(imageUri)) {
                      imageErrorsRef.current.add(imageUri);
                      setImageErrorCount(c => c + 1);
                    }
                  }}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name={iconName} size={22} color={tokens.colors.text.secondary} />
                </View>
              )}
            </View>

            <View style={styles.chatBody}>
              <View style={styles.chatRow1}>
                <Text
                  style={styles.chatName}
                  numberOfLines={1}
                >
                  {chatGroupDisplayName(item.name)}
                </Text>
                {!!timeLabel && (
                  <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
                    {timeLabel}
                  </Text>
                )}
              </View>
              <View style={styles.chatRow2}>
                <Text
                  style={[styles.chatPreview, hasUnread && styles.chatPreviewUnread]}
                  numberOfLines={1}
                >
                  {item.last_message && getMessageTypeIcon(item.last_message.message_type, item.last_message.content) ? (
                    <>
                      <Ionicons
                        name={getMessageTypeIcon(item.last_message.message_type, item.last_message.content) as any}
                        size={13}
                        color={hasUnread ? tokens.colors.text.primary : tokens.colors.text.secondary}
                      />{' '}
                    </>
                  ) : null}
                  {lastMsgPreview}
                </Text>
                {hasUnread ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.unread_count! > 99 ? '99+' : item.unread_count}
                    </Text>
                  </View>
                ) : hasMentions ? (
                  <View style={styles.mentionBadge}>
                    <Text style={styles.mentionBadgeText}>@</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {isLastAnnouncement ? (
            <View style={styles.sectionDivider} />
          ) : !isLastInSection ? (
            <View style={styles.rowSeparator} />
          ) : null}
        </View>
      );
    },
    [styles, tokens, handleGroupPress, prepareChatOpen, imageErrorCount, isDarkMode]
  );

  const renderJoinableGroup = useCallback(
    (item: GroupWithMembership, isLastInSection: boolean) => {
      const iconName = GROUP_ICONS[item.name] || 'chatbubbles';
      const imageSource =
        groupChatIcon(item.name, isDarkMode) ||
        (item.avatar_url ? { uri: item.avatar_url } : null);
      const imageUri = avatarUri(imageSource);
      const hasImageError = imageUri ? imageErrorsRef.current.has(imageUri) : false;

      return (
        <View key={`joinable-wrapper-${item.id}`}>
          <TouchableOpacity
            style={[styles.chatRow, styles.joinableRow]}
            onPress={() => handleGroupPress(item)}
            activeOpacity={0.6}
            accessibilityLabel={`פרטי קבוצה ${chatGroupDisplayName(item.name)}`}
          >
            <View style={styles.avatarWrap}>
              {imageSource && !hasImageError ? (
                <Image
                  source={imageSource}
                  style={[styles.avatar, styles.joinableAvatar]}
                  resizeMode="cover"
                  onError={() => {
                    if (imageUri && !imageErrorsRef.current.has(imageUri)) {
                      imageErrorsRef.current.add(imageUri);
                      setImageErrorCount(c => c + 1);
                    }
                  }}
                />
              ) : (
                <View style={[styles.avatarFallback, styles.joinableAvatar]}>
                  <Ionicons name={iconName} size={22} color={tokens.colors.text.secondary} />
                </View>
              )}
            </View>

            <View style={styles.chatBody}>
              <View style={styles.chatRow1}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {chatGroupDisplayName(item.name)}
                </Text>
              </View>
              <Text style={styles.joinableSubtitle} numberOfLines={1}>
                הקש להצטרפות
              </Text>
            </View>

            <TouchableOpacity
              style={styles.joinablePill}
              onPress={() => openJoinSheet(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`הצטרף לקבוצה ${chatGroupDisplayName(item.name)}`}
            >
              <Text style={styles.joinablePillText}>הצטרפות</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {!isLastInSection ? <View style={styles.rowSeparator} /> : null}
        </View>
      );
    },
    [styles, tokens, handleGroupPress, openJoinSheet, imageErrorCount, isDarkMode]
  );

  const renderSectionHeader = useCallback(
    (title: string, count: number) => (
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderText}>
          {title}
          <Text style={styles.sectionHeaderDot}>{' · '}</Text>
          {count}
        </Text>
      </View>
    ),
    [styles]
  );

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.type === 'section-header') {
        return renderSectionHeader(item.title, item.count);
      }
      if (item.type === 'my-group') {
        return renderMyGroup(item.group, item.isLastAnnouncement, item.isLastInSection);
      }
      return renderJoinableGroup(item.group, item.isLastInSection);
    },
    [renderMyGroup, renderJoinableGroup, renderSectionHeader]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item?: ListRow }> }) => {
      const uid = userIdRef.current;
      if (!uid) return;
      for (const token of viewableItems) {
        const row = token.item;
        if (row?.type === 'my-group' && row.group?.id) {
          warmChatGroupFromDisk(uid, row.group.id);
        }
      }
    },
  ).current;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <View style={{ width: '100%' }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonGroupRow key={i} delay={0} />
          ))}
        </View>
      ) : searchQuery ? (
        <>
          <Ionicons name="search-outline" size={64} color={tokens.colors.text.tertiary} />
          <Text style={styles.emptyTitle}>לא נמצאו תוצאות</Text>
          <Text style={styles.emptyText}>נסה לחפש משהו אחר</Text>
        </>
      ) : activeTab === 'unread' ? (
        <>
          <Ionicons name="checkmark-done-circle-outline" size={64} color={tokens.colors.text.success} />
          <Text style={styles.emptyTitle}>הכל נקרא! 🎉</Text>
          <Text style={styles.emptyText}>אין הודעות חדשות</Text>
        </>
      ) : activeTab === 'mentions' ? (
        <>
          <Ionicons name="at-outline" size={64} color={tokens.colors.text.tertiary} />
          <Text style={styles.emptyTitle}>אין אזכורים</Text>
          <Text style={styles.emptyText}>כשמישהו יזכיר אותך בצ'אט, תראה כאן</Text>
        </>
      ) : (
        <>
          <Ionicons name="chatbubbles-outline" size={64} color={tokens.colors.text.tertiary} />
          <Text style={styles.emptyTitle}>אין קבוצות</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ChatSessionBackdrop />
      <MainDrawerRegistration />
      <RNSafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <MainDrawerScreenHeader
            title="קהילה"
            onMenuPress={openMainDrawer}
            titleAccessory={
              isGlobalAdmin ? (
                // + ליצירת קבוצה — בשורת הכותרת, מתחת לכפתור החיפוש
                <DayNavBlurButton
                  onPress={() => {
                    void HapticFeedback.selection();
                    setCreateGroupSheetVisible(true);
                  }}
                  glassIntensity="subtle"
                  size={DRAWER_MENU_BUTTON_SIZE}
                  accessibilityLabel="יצירת קבוצה חדשה"
                >
                  <Ionicons name="add" size={24} color={tokens.colors.text.primary} />
                </DayNavBlurButton>
              ) : undefined
            }
            rightAccessory={
              <View style={styles.headerEndActions}>
                <DayNavBlurButton
                  onPress={() => {
                    void HapticFeedback.selection();
                    setSearchSheetVisible(true);
                  }}
                  glassIntensity="subtle"
                  size={DRAWER_MENU_BUTTON_SIZE}
                  accessibilityLabel="חיפוש"
                >
                  <Search
                    size={20}
                    strokeWidth={2}
                    color={tokens.colors.text.primary}
                  />
                </DayNavBlurButton>
              </View>
            }
          />

          {/* שורת סטטוסים */}
          <View style={styles.statusRow}>
            <Pressable
              style={({ pressed }) => [
                styles.statusCircle,
                pressed && { opacity: 0.72, transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => {
                void HapticFeedback.selection();
                setAddStorySheetVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="הוסף סטטוס"
            >
              <View style={styles.statusAddOuter}>
                <View style={styles.statusCircleInner}>
                  <Ionicons name="add" size={24} color={tokens.colors.text.primary} />
                </View>
                <View style={styles.statusAddBadge}>
                  <Ionicons name="add" size={11} color={tokens.colors.text.inverse} />
                </View>
              </View>
              <Text style={[styles.statusLabel, { color: tokens.colors.text.primary }]}>הוסף</Text>
            </Pressable>
            <View style={styles.statusStoryGap} />
            <ScrollView
              ref={storiesScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.statusRowScroll}
              onContentSizeChange={() => {
                storiesScrollRef.current?.scrollToEnd({ animated: false });
              }}
            >
            {usersWithStories.map((s, idx) => {
              const avatar = s.user?.profile_picture;
              const displayName = s.user?.display_name || s.user?.full_name || 'משתמש';
              const isUnread = s.has_viewed === false;
              const isOwn = s.user_id === user?.id;
              const count = Math.max(1, s.story_count || 1);
              return (
                <View key={s.user_id} style={styles.statusStorySlot}>
                {idx > 0 ? <View style={styles.statusStoryGap} /> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.statusStoryItem,
                    pressed && { opacity: 0.72, transform: [{ scale: 0.94 }] },
                  ]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setStoryViewerInitialIndex(idx);
                    setStoryViewerVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isOwn ? 'הסטטוס שלי' : displayName}
                >
                  <StoryAvatarRing
                    size={68}
                    storyCount={count}
                    hasViewed={!isUnread}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.statusCircleImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.storyAvatarPlaceholder}>
                        <Ionicons
                          name="person"
                          size={22}
                          color={
                            isUnread
                              ? tokens.colors.text.secondary
                              : tokens.colors.text.tertiary
                          }
                        />
                      </View>
                    )}
                  </StoryAvatarRing>
                  <Text style={[styles.statusLabel, isOwn && { color: tokens.colors.text.primary }]} numberOfLines={1}>
                    {isOwn ? 'שלי' : displayName}
                  </Text>
                </Pressable>
                </View>
              );
            })}
            </ScrollView>
          </View>

          <View style={styles.storiesDivider} />

          {/* Chat list card – raised surface with rounded top corners */}
          <View style={styles.listCard}>
          {/* Filters – Instagram style (search moved to header button → bottom sheet) */}
          <View style={styles.searchSection}>
            <View style={[styles.filterRow, { marginTop: 0 }]}>
              {(['all', 'unread', 'mentions'] as TabType[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterPill, activeTab === tab && styles.filterPillActive]}
                  onPress={() => {
                    if (activeTab !== tab) void HapticFeedback.selection();
                    setActiveTab(tab);
                  }}
                >
                  <Text style={[styles.filterPillText, activeTab === tab && styles.filterPillTextActive]}>
                    {tab === 'all' ? 'הכל' : tab === 'unread' ? 'לא נקראו' : '@אזכורים'}
                  </Text>
                  {tab === 'unread' && unreadCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                  {tab === 'mentions' && mentionsCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{mentionsCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Offline banner hidden globally per product decision */}

          {/* Chat List */}
          <View style={{ flex: 1, minHeight: 0 }}>
            <FlatList
              data={listData}
              renderItem={renderRow}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={null}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={async () => {
                    try {
                      await loadGroups();
                    } finally {
                      void HapticFeedback.impactLight();
                    }
                  }}
                  tintColor={tokens.colors.primary.main}
                />
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                listData.length === 0
                  ? styles.emptyListContainer
                  : { paddingTop: 4, paddingBottom: 20 }
              }
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews={true}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
            />
          </View>
          </View>
        </View>
      </RNSafeAreaView>

      {/* Join Group Bottom Sheet */}
      <JoinGroupBottomSheet
        visible={joinGroupSheet.visible}
        onClose={() => setJoinGroupSheet({ visible: false, group: null })}
        onJoin={() => joinGroupSheet.group && handleJoinGroup(joinGroupSheet.group)}
        group={joinGroupSheet.group}
        isJoining={isJoining}
      />

      {/* Create Group Sheet — admins only */}
      <CreateGroupSheet
        visible={createGroupSheetVisible}
        onClose={() => setCreateGroupSheetVisible(false)}
        onCreated={() => {
          // בלי Alert (רטט ההצלחה כבר ניתן) — הקבוצה מופיעה ברשימה
          void loadGroups();
        }}
      />

      {/* Search Sheet — חיפוש בצ'אטים ובתוכן ההודעות */}
      <ChatBottomSheet
        visible={searchSheetVisible}
        onClose={closeSearchSheet}
        snapPoints={[0.92]}
        showBrandWatermark={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={styles.searchPill}>
            <Search size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchPillInput}
              placeholder="חיפוש בצ׳אטים ובהודעות"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={searchSheetRows}
            renderItem={renderSearchRow}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <ChatSheetEmptyState
                icon="search-outline"
                title="חפש בצ׳אטים"
                subtitle="הקלד שם של קבוצה או טקסט מתוך הודעה"
              />
            }
          />
        </View>
      </ChatBottomSheet>

      {/* Add Story – מסך מלא בסגנון Instagram/WhatsApp */}
      {addStorySheetVisible && (
        <AddStoryFullScreen
          visible={addStorySheetVisible}
          onClose={() => setAddStorySheetVisible(false)}
          onAdded={() => loadStories()}
        />
      )}

      {/* Story Viewer */}
      {storyViewerVisible && (
        <StoryViewer
          visible={storyViewerVisible}
          onClose={() => { setStoryViewerVisible(false); loadStories(); }}
          storiesByUser={usersWithStories}
          initialUserIndex={storyViewerInitialIndex}
          onStoriesChanged={loadStories}
        />
      )}
    </View>
  );
}

// ============================================
// Styles – Instagram DM inspired design
// ============================================

const HP = APP_LAYOUT.screenPaddingHorizontal;

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: 'transparent' },

  headerEndActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* ── Raised list card ── */
  listCard: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: UI_CARD_RADIUS,
    borderTopRightRadius: UI_CARD_RADIUS,
    marginTop: 6,
    overflow: 'hidden',
  },

  /* ── Stories row ── */
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    paddingHorizontal: HP,
    paddingTop: 8,
    paddingBottom: 9,
  },
  statusRowScroll: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  statusCircle: { alignItems: 'center' },
  statusStorySlot: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 0 },
  statusStoryGap: { width: 7, flexShrink: 0 },
  statusStoryItem: { alignItems: 'center', flexShrink: 0 },
  statusCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusAddOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    borderColor: tokens.colors.border.divider,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusAddBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
  },
  storyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.border.divider,
  },
  statusLabel: {
    ...APP_TYPE.caption2,
    color: tokens.colors.text.secondary,
    maxWidth: 68,
    textAlign: 'center',
    marginTop: 2,
  },
  statusCircleImage: { width: '100%', height: '100%' },
  storiesDivider: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
    marginTop: 2,
    marginBottom: 4,
  },

  /* ── Search + Filters ── */
  searchSection: {
    paddingHorizontal: HP,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.border.primary,
    borderRadius: tokens.borderRadius.search,
    paddingHorizontal: 16,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...APP_TYPE.body,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  /* ── Search Sheet ── */
  searchPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.background.cardSolid,
    borderWidth: 0,
    borderRadius: tokens.borderRadius.search,
    paddingHorizontal: 18,
    height: 46,
    marginBottom: 14,
  },
  searchPillInput: {
    flex: 1,
    ...APP_TYPE.body,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  searchSectionHeader: {
    ...APP_TYPE.groupLabel,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 6,
    marginBottom: APP_LAYOUT.groupLabelToContent,
  },
  searchNoResults: {
    ...APP_TYPE.cardBody,
    color: tokens.colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: APP_LAYOUT.cardPadding,
    writingDirection: 'rtl',
  },
  searchRowItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 15,
  },
  searchRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.tertiary,
    marginLeft: 12,
  },
  searchRowAvatarPlaceholder: {
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRowBody: {
    flex: 1,
    minWidth: 0,
  },
  searchRowTitle: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchRowSubtitle: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  searchSenderName: {
    ...APP_TYPE.cardSubtitle,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    color: tokens.colors.text.primary,
  },
  searchRowMsgHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchRowTime: {
    ...APP_TYPE.caption2,
    color: tokens.colors.text.tertiary,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  filterPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 200, 5, 0.12)',
  },
  filterPillText: {
    ...APP_TYPE.caption,
    color: tokens.colors.text.secondary,
  },
  filterPillTextActive: {
    color: tokens.colors.primary.main,
  },
  filterBadge: {
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    ...APP_TYPE.caption2,
    color: tokens.colors.text.inverse,
  },

  /* ── Chat row ── */
  chatRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: HP,
  },
  avatarWrap: {
    position: 'relative',
    marginLeft: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.tertiary,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBody: { flex: 1, minWidth: 0 },
  chatRow1: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  chatName: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chatTime: {
    ...APP_TYPE.caption,
    color: tokens.colors.text.tertiary,
    marginRight: 10,
  },
  chatTimeUnread: { color: tokens.colors.text.primary },
  chatRow2: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreview: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chatPreviewUnread: {
    color: tokens.colors.text.primary,
  },
  badge: {
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    marginRight: 10,
  },
  badgeText: { ...APP_TYPE.caption, color: tokens.colors.text.inverse },
  mentionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.text.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mentionBadgeText: {
    ...APP_TYPE.caption,
    color: tokens.colors.text.primary,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
    marginTop: 6,
    marginBottom: 2,
  },

  /* ── Section headers — כותרת סקשן (sectionTitle), מתחת לכותרת המסך ── */
  sectionHeaderRow: {
    paddingHorizontal: HP,
    paddingTop: 16,
    paddingBottom: CHAT_LAYOUT.sectionHeaderToContent,
  },
  sectionHeaderText: {
    ...chatSectionTitleStyle,
    color: tokens.colors.text.primary,
  },
  sectionHeaderDot: {
    color: tokens.colors.text.primary,
  },

  /* ── Joinable group row ── */
  joinableRow: {},
  createGroupRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingVertical: 15,
  },
  createGroupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.cardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  joinableAvatar: {},
  joinableSubtitle: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  joinablePill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 200, 5, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 28,
    marginRight: 4,
    alignSelf: 'center',
  },
  joinablePillText: {
    ...APP_TYPE.caption,
    color: tokens.colors.primary.main,
  },

  /* ── Empty state ── */
  emptyListContainer: { flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    marginTop: APP_LAYOUT.cardPadding,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyText: {
    ...APP_TYPE.cardBody,
    color: tokens.colors.text.secondary,
    marginTop: APP_LAYOUT.stackGapSmall,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  /* ── Offline banner ── */
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
    paddingVertical: 6,
    marginHorizontal: HP,
    marginVertical: 4,
    borderRadius: 10,
  },
  offlineBannerText: {
    ...APP_TYPE.footnote,
    color: tokens.colors.text.primary,
  },
});
