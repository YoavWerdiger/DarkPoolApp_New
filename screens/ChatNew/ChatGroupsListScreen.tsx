// ============================================
// Chat Groups List Screen - Modern Design (Exact Copy)
// ============================================

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
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
  ImageBackground,
  TextInput,
  Keyboard,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
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
import { LinearGradient } from 'expo-linear-gradient';
import JoinGroupBottomSheet from '../../components/chat/JoinGroupBottomSheet';
import CreateGroupSheet from '../../components/chat/CreateGroupSheet';
import StoryViewer from '../../components/chat/StoryViewer';
import AddStoryFullScreen from '../../components/chat/AddStoryFullScreen';
import { getUsersWithStories, StoryWithUser } from '../../services/storiesService';
import { logger } from '../../utils/logger';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { SUPABASE_URL } from '../../config/publicEnv';

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
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, opacity }}>
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 12 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 13, width: '60%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 6 }} />
        <View style={{ height: 11, width: '80%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
      </View>
      <View style={{ width: 36, height: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
    </Animated.View>
  );
});

const { width: CHAT_SCREEN_W, height: CHAT_SCREEN_H } = Dimensions.get('window');

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

// מיפוי תמונות לקבוצות
const GROUP_IMAGES: { [key: string]: string } = {
  'הכרזות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/111.png`,
  '🔔 הכרזות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/111.png`,
  'דיונים - כללי': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/777.PNG`,
  '💬 דיונים - כללי': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/777.PNG`,
  'נטו ניתוחים!': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/666.PNG`,
  '📊 נטו ניתוחים!': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/666.PNG`,
  'דיוני - פניסטוקס': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/999.PNG`,
  '💰 דיוני - פניסטוקס': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/999.PNG`,
  'שאלות ותשובות בשוק': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/888.PNG`,
  '❓ שאלות ותשובות בשוק': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/888.PNG`,
  'עסקאות מסחר יומי': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/111%20(1).PNG`,
  '📈 עסקאות מסחר יומי': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/111%20(1).PNG`,
  'רווחים והצלחות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/333.PNG`,
  '🎯 רווחים והצלחות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/333.PNG`,
  'חדשות מתפרצות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/777.png`,
  '⚡ חדשות מתפרצות': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/777.png`,
  'סווינגים וסטאפים': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/555.PNG`,
  '🔄 סווינגים וסטאפים': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/555.PNG`,
  'מסחר פניסטוקס - סיכון גבוה': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/222.PNG`,
  '⚠️ מסחר פניסטוקס - סיכון גבוה': `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/groups/222.PNG`,
};

const getImageByGroupName = (groupName: string): string | null => {
  if (GROUP_IMAGES[groupName]) {
    return GROUP_IMAGES[groupName];
  }
  
  const nameWithoutEmoji = groupName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();
  if (GROUP_IMAGES[nameWithoutEmoji]) {
    return GROUP_IMAGES[nameWithoutEmoji];
  }
  
  return null;
};

const GROUP_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  'הכרזות': 'megaphone',
  'דיונים - כללי': 'chatbubbles',
  'נטו ניתוחים!': 'analytics',
  'דיוני - פניסטוקס': 'trending-up',
  'שאלות ותשובות בשוק': 'help-circle',
  'עסקאות מסחר יומי': 'flash',
  'רווחים והצלחות': 'trophy',
  'חדשות מתפרצות': 'newspaper',
  'סווינגים וסטאפים': 'swap-horizontal',
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const { groups: contextGroups, realtimeConnectionState } = useChat();
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

  const [allGroups, setAllGroups] = useState<GroupWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const imageErrorsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<TextInput>(null);
  const isLoadingRef = useRef(false);
  const [imageErrorCount, setImageErrorCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [joinGroupSheet, setJoinGroupSheet] = useState<{ visible: boolean; group: GroupWithMembership | null }>({ visible: false, group: null });
  const [isJoining, setIsJoining] = useState(false);
  const [addStorySheetVisible, setAddStorySheetVisible] = useState(false);
  const [usersWithStories, setUsersWithStories] = useState<StoryWithUser[]>([]);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyViewerInitialIndex, setStoryViewerInitialIndex] = useState(0);
  const storiesScrollRef = useRef<ScrollView>(null);
  const [createGroupSheetVisible, setCreateGroupSheetVisible] = useState(false);

  // בדיקת admin — האם המשתמש admin בלפחות קבוצה אחת
  const isGlobalAdmin = useMemo(
    () => allGroups.some(g => g.my_role === 'admin'),
    [allGroups]
  );

  const loadGroups = async () => {
    if (!user) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
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

      const getMessagePreview = (msg: any): string => {
        if (msg.content) return msg.content;
        const typeMap: Record<string, string> = { image: 'תמונה', video: 'וידאו', audio: 'הודעת קול', document: 'מסמך' };
        return typeMap[msg.message_type] || 'הודעה';
      };

      const groupsWithLastMessage = realGroups.map((g) => {
        const lastMessage = lastMessageMap.get(g.id);
        let senderName = 'משתמש';
        if (lastMessage) {
          const users = (lastMessage as any).users;
          if (users) {
            const userData = Array.isArray(users) ? users[0] : users;
            senderName = userData?.display_name || userData?.full_name || 'משתמש';
          }
        }

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
                sender_name: senderName,
                created_at: lastMessage.created_at,
                message_type: lastMessage.message_type,
              }
            : null,
        };
      });

      setAllGroups(groupsWithLastMessage);
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
    } catch (error) {
      logger.error('ChatGroupsListScreen', 'Failed to load stories', error);
      setUsersWithStories([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadGroups();
  }, [user]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  // M8: removed useFocusEffect – realtime updates from contextGroups replace manual re-fetch on focus

  // M8: contextGroups is the single source of truth for live data; merge all fields on change
  useEffect(() => {
    if (!contextGroups || contextGroups.length === 0) return;

    setAllGroups(prev => {
      let changed = false;
      const next = prev.map(group => {
        const cg = contextGroups.find(c => c.id === group.id);
        if (!cg) return group;

        const hasChange =
          group.unread_count !== (cg.unread_count || 0) ||
          group.mentioned_count !== (cg.mentioned_count || 0) ||
          group.last_message_at !== cg.last_message_at ||
          group.last_message_preview !== cg.last_message_preview ||
          (group as any).is_muted !== (cg as any).is_muted;

        if (!hasChange) return group;
        changed = true;
        return {
          ...group,
          unread_count: cg.unread_count || 0,
          mentioned_count: cg.mentioned_count || 0,
          last_message_at: cg.last_message_at,
          last_message_preview: cg.last_message_preview,
          is_muted: (cg as any).is_muted,
          last_message: cg.last_message_preview
            ? {
                content: cg.last_message_preview,
                sender_name: group.last_message?.sender_name ?? '',
                created_at: cg.last_message_at ?? group.last_message?.created_at ?? '',
                message_type: group.last_message?.message_type,
              }
            : group.last_message,
        };
      });
      return changed ? next : prev; // avoid re-render if nothing changed
    });
  }, [contextGroups]);

  // Helper function for message type text
  const getMessageTypeText = (messageType: string): string => {
    switch (messageType) {
      case 'image': return 'תמונה';
      case 'video': return 'וידאו';
      case 'audio': return 'הודעת קול';
      case 'document': return 'מסמך';
      default: return 'הודעה';
    }
  };
  
  // פונקציה להחזרת אייקון לפי סוג ההודעה
  const getMessageTypeIcon = (messageType?: string): string | null => {
    switch (messageType) {
      case 'image': return 'image-outline';
      case 'video': return 'videocam-outline';
      case 'audio': return 'mic-outline';
      case 'document': return 'document-text-outline';
      default: return null;
    }
  };

  // בדיקה אם זו קבוצת הכרזות
  const isAnnouncementGroup = (name: string) => {
    const lowerName = name.toLowerCase();
    return lowerName.includes('הכרזות') || lowerName.includes('announcement');
  };

  // Filter groups - הכרזות למעלה עם רווח אחריהן
  const filteredGroups = useMemo(() => {
    let filtered = allGroups;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        (group.name || '').toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
      );
    }

    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(g => g.is_member && (g.unread_count || 0) > 0);
        break;
      case 'mentions':
        filtered = filtered.filter(g => g.is_member && (g.mentioned_count || 0) > 0);
        break;
      case 'all':
      default:
        // ממיין: חברים קודם
        filtered = [...filtered].sort((a, b) => {
          if (a.is_member && !b.is_member) return -1;
          if (!a.is_member && b.is_member) return 1;
          return 0;
        });
        break;
    }

    // מיון: הכרזות למעלה
    const announcements = filtered.filter(g => isAnnouncementGroup(g.name));
    const regular = filtered.filter(g => !isAnnouncementGroup(g.name));

    // 🔥 מיון לפי last_message_at - קבוצות עם הודעות חדשות למעלה (כמו וואטסאפ)
    const sortByLastMessage = (groups: typeof filtered) => {
      return [...groups].sort((a, b) => {
        // קודם כל לפי membership
        if (a.is_member && !b.is_member) return -1;
        if (!a.is_member && b.is_member) return 1;
        
        // אחר כך לפי הודעה אחרונה (חדש קודם)
        const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return timeB - timeA;
      });
    };

    return [...sortByLastMessage(announcements), ...sortByLastMessage(regular)];
  }, [allGroups, searchQuery, activeTab]);

  // מספר קבוצות ההכרזות (לחישוב הרווח)
  const announcementCount = useMemo(() => 
    filteredGroups.filter(g => isAnnouncementGroup(g.name)).length,
    [filteredGroups]
  );

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
        legacyAlert('שגיאה', 'לא הצלחנו להצטרף');
        setIsJoining(false);
        return;
      }

      // סגור את ה-BottomSheet ונווט לקבוצה
      setJoinGroupSheet({ visible: false, group: null });
      setIsJoining(false);
      await loadGroups();

      void HapticFeedback.impactLight();
      // נווט לקבוצה אחרי הצטרפות
      (navigation as any).navigate('ChatGroup', { groupId: group.id });
    } catch (error: any) {
      setIsJoining(false);
      legacyAlert('שגיאה', error?.message || 'שגיאה לא צפויה');
    }
  };

  const handleGroupPress = useCallback((group: GroupWithMembership) => {
    if (!group.is_member) {
      void HapticFeedback.selection();
      setJoinGroupSheet({ visible: true, group });
      return;
    }
    Keyboard.dismiss();
    void HapticFeedback.impactLight();
    (navigation as any).navigate('ChatGroup', { groupId: group.id });
  }, [navigation]);

  const renderGroup = useCallback(({ item, index }: { item: GroupWithMembership; index: number }) => {
    const iconName = GROUP_ICONS[item.name] || 'chatbubbles';
    const hasUnread = (item.unread_count || 0) > 0;
    const hasMentions = (item.mentioned_count || 0) > 0;
    const isAnnouncement = isAnnouncementGroup(item.name);
    const imageUrl = item.avatar_url || getImageByGroupName(item.name) || null;
    const hasImageError = imageUrl ? imageErrorsRef.current.has(imageUrl) : false;
    const isLastAnnouncement = isAnnouncement && index === announcementCount - 1 && announcementCount > 0;
    const isLastItem = index === filteredGroups.length - 1;

    const lastMsgPreview = item.is_member && item.last_message
      ? item.last_message.message_type && item.last_message.message_type !== 'text'
        ? `${item.last_message.sender_name}: ${getMessageTypeText(item.last_message.message_type)}`
        : `${item.last_message.sender_name}: ${item.last_message.content}`
      : item.is_member
        ? 'אין הודעות עדיין'
        : `${item.members_count || 0} חברים`;

    const timeLabel = item.last_message
      ? formatRelativeTime(item.last_message.created_at)
      : '';

    return (
      <View key={`group-wrapper-${item.id}`}>
        <TouchableOpacity
          style={styles.chatRow}
          onPress={() => handleGroupPress(item)}
          activeOpacity={0.6}
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {imageUrl && !hasImageError ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.avatar}
                resizeMode="cover"
                onError={() => {
                  if (!imageErrorsRef.current.has(imageUrl)) {
                    imageErrorsRef.current.add(imageUrl);
                    setImageErrorCount(c => c + 1);
                  }
                }}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name={iconName} size={22} color={tokens.colors.text.secondary} />
              </View>
            )}
            {item.is_member && hasUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Text content */}
          <View style={styles.chatBody}>
            <View style={styles.chatRow1}>
              <Text style={[styles.chatName, hasUnread && styles.chatNameBold]} numberOfLines={1}>
                {item.name}
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
                {item.last_message?.message_type && getMessageTypeIcon(item.last_message.message_type) ? (
                  <>
                    <Ionicons
                      name={getMessageTypeIcon(item.last_message.message_type) as any}
                      size={13}
                      color={hasUnread ? tokens.colors.text.primary : tokens.colors.text.tertiary}
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
        ) : !isLastItem ? (
          <View style={styles.rowSeparator} />
        ) : null}
      </View>
    );
  }, [imageErrorCount, announcementCount, filteredGroups.length, styles, tokens, handleGroupPress]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <View style={{ width: '100%' }}>
          {[0,1,2,3,4,5,6,7].map(i => <SkeletonGroupRow key={i} delay={i * 70} />)}
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
    <View style={{ flex: 1 }}>
      <MainDrawerRegistration />
      <ScreenGradientBackground style={StyleSheet.absoluteFill} />
      {/* שור ודוב ברקע — כמו LoginScreen */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: 0.22,
        }}
      >
        <ImageBackground
          source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
          style={{ width: CHAT_SCREEN_W * 1.6, height: CHAT_SCREEN_H * 1.6 }}
          imageStyle={{ resizeMode: 'contain' }}
        />
      </View>
      <RNSafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.appHeader}>
            <View style={styles.appHeaderActions}>
              <DayNavBlurButton
                onPress={openMainDrawer}
                glassIntensity="subtle"
                size={DRAWER_MENU_BUTTON_SIZE}
                accessibilityLabel="תפריט ראשי"
              >
                <Ionicons name="menu" size={24} color={tokens.colors.text.primary} />
              </DayNavBlurButton>
            </View>
            <Text style={[styles.appHeaderTitle, styles.appHeaderTitleCenter]}>צ׳אטים</Text>
            <View style={styles.appHeaderActions}>
              {isGlobalAdmin && (
                <TouchableOpacity
                  style={styles.headerActionBtn}
                  onPress={() => setCreateGroupSheetVisible(true)}
                  accessibilityLabel="צור קבוצה חדשה"
                >
                  <Ionicons name="create-outline" size={22} color={tokens.colors.text.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* שורת סטטוסים */}
          <View style={styles.statusRow}>
            <Pressable
              style={styles.statusCircle}
              onPress={() => setAddStorySheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="הוסף סטטוס"
            >
              <View style={styles.statusAddOuter}>
                <View style={styles.statusCircleInner}>
                  <Ionicons name="add" size={24} color={tokens.colors.primary.main} />
                </View>
                <View style={styles.statusAddBadge}>
                  <Ionicons name="add" size={11} color="#fff" />
                </View>
              </View>
              <Text style={[styles.statusLabel, { color: tokens.colors.primary.main }]}>הוסף</Text>
            </Pressable>
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
              return (
                <TouchableOpacity
                  key={s.user_id}
                  style={styles.statusCircle}
                  onPress={() => {
                    setStoryViewerInitialIndex(idx);
                    setStoryViewerVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  {isUnread ? (
                    <LinearGradient
                      colors={[tokens.colors.primary.main, tokens.colors.primary.light, tokens.colors.secondary.main]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.storyRingGradient}
                    >
                      <View style={styles.storyRingInner}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.statusCircleImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.storyAvatarPlaceholder}>
                            <Ionicons name="person" size={22} color={tokens.colors.text.secondary} />
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.storyRingViewed}>
                      <View style={styles.storyRingInner}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.statusCircleImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.storyAvatarPlaceholder}>
                            <Ionicons name="person" size={22} color={tokens.colors.text.tertiary} />
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                  <Text style={[styles.statusLabel, isOwn && { color: tokens.colors.primary.main }]} numberOfLines={1}>
                    {isOwn ? 'שלי' : displayName}
                  </Text>
                  {isUnread && s.story_count > 1 && (
                    <View style={styles.storyCountBadge}>
                      <Text style={styles.storyCountText}>{s.story_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            </ScrollView>
          </View>

          {/* Chat list card – raised surface with rounded top corners */}
          <View style={styles.listCard}>
          {/* Search + Filters – Instagram style */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={tokens.colors.text.tertiary} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="חיפוש..."
                placeholderTextColor={tokens.colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={tokens.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.filterRow}>
              {(['all', 'unread', 'mentions'] as TabType[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterPill, activeTab === tab && styles.filterPillActive]}
                  onPress={() => setActiveTab(tab)}
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

          {/* חיבור Realtime — לא מציגים בזמן "connecting" ראשוני כדי לא להלחיץ */}
          {(realtimeConnectionState === 'reconnecting' || realtimeConnectionState === 'offline') && (
            <View style={styles.offlineBanner}>
              {realtimeConnectionState === 'reconnecting' ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
              ) : null}
              <Text style={styles.offlineBannerText}>
                {realtimeConnectionState === 'reconnecting'
                  ? 'מתחבר מחדש לצ׳אט...'
                  : 'אין חיבור בזמן אמת. הרשימה תתעדכן כשיחזור החיבור.'}
              </Text>
            </View>
          )}

          {/* Chat List */}
          <View style={{ flex: 1, minHeight: 0 }}>
            <FlatList
              data={filteredGroups}
              renderItem={renderGroup}
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
                filteredGroups.length === 0
                  ? styles.emptyListContainer
                  : { paddingTop: 4, paddingBottom: 20 }
              }
              keyboardShouldPersistTaps="handled"
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={true}
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
        onCreated={(_groupId, groupName) => {
          void loadGroups();
          legacyAlert('הצלחה', `הקבוצה "${groupName}" נוצרה בהצלחה!`);
        }}
      />

      {/* Add Story – מסך מלא בסגנון Instagram/WhatsApp */}
      <AddStoryFullScreen
        visible={addStorySheetVisible}
        onClose={() => setAddStorySheetVisible(false)}
        onAdded={() => loadStories()}
      />

      {/* Story Viewer */}
      <StoryViewer
        visible={storyViewerVisible}
        onClose={() => { setStoryViewerVisible(false); loadStories(); }}
        storiesByUser={usersWithStories}
        initialUserIndex={storyViewerInitialIndex}
        onStoriesChanged={loadStories}
      />
    </View>
  );
}

// ============================================
// Styles – Instagram DM inspired design
// ============================================

const HP = 20; // horizontal padding constant

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: 'transparent' },

  /* ── Header ── */
  appHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: HP,
    paddingVertical: 14,
  },
  appHeaderTitleCenter: {
    flex: 1,
    textAlign: 'center',
  },
  appHeaderActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minWidth: 72,
  },
  appHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    letterSpacing: -0.3,
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
    // Keep rounded top corners without brightening the screen gradient.
    backgroundColor: 'transparent',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
    paddingRight: 0,
    marginLeft: 14,
  },
  statusCircle: { alignItems: 'center', marginLeft: 14 },
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
    borderColor: tokens.colors.primary.glow,
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
  storyRingGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyRingViewed: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: tokens.colors.border.hover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyRingInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: tokens.colors.background.primary,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  storyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.border.divider,
  },
  storyCountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: tokens.colors.background.primary,
  },
  storyCountText: { color: tokens.colors.text.primary, fontSize: 9, fontWeight: '700' },
  statusLabel: {
    fontSize: 11,
    color: tokens.colors.text.secondary,
    maxWidth: 68,
    textAlign: 'center',
    marginTop: 2,
  },
  statusCircleImage: { width: 56, height: 56, borderRadius: 28 },

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
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    paddingVertical: 0,
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
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.text.secondary,
  },
  filterPillTextActive: {
    color: tokens.colors.primary.main,
    fontWeight: '600',
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
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: tokens.colors.text.inverse },

  /* ── Chat row ── */
  chatRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: HP,
    marginHorizontal: 8,
    borderRadius: 16,
  },
  avatarWrap: { position: 'relative', marginLeft: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: tokens.colors.primary.main,
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
  },
  chatBody: { flex: 1, minWidth: 0 },
  chatRow1: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  chatNameBold: { fontWeight: '700' },
  chatTime: {
    fontSize: 12,
    color: tokens.colors.text.tertiary,
    marginRight: 10,
  },
  chatTimeUnread: { color: tokens.colors.primary.main },
  chatRow2: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreview: {
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    flex: 1,
    textAlign: 'right',
  },
  chatPreviewUnread: {
    color: tokens.colors.text.secondary,
    fontWeight: '500',
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
  badgeText: { fontSize: 12, fontWeight: '700', color: tokens.colors.text.inverse },
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
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text.primary,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: tokens.colors.border.primary,
    marginHorizontal: HP,
    marginTop: 6,
    marginBottom: 2,
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
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
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
  offlineBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
