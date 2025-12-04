import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, ScrollView, Alert, Share, Linking, Modal, Dimensions, Switch, ActivityIndicator, ImageBackground, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, Share as ShareIcon, Trash2, ImageIcon, Star, Bell, BellOff, Palette, FileText, Edit3, Lock, MoreVertical, Users, User, UserMinus, ChevronLeft } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';


const iconMap: Record<string, string> = {
  'MessageCircle': 'chatbubbles',
  'AlertTriangle': 'warning',
  'Bitcoin': 'diamond',
  'Users': 'people',
  'Newspaper': 'newspaper',
  'Trophy': 'trophy',
  'Bell': 'notifications',
  'Briefcase': 'briefcase',
};

export default function GroupInfoScreen() {
  const DesignTokens = useDesignTokens();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const tabBarInsets = useSafeAreaInsets();
  const { user } = useAuth();
  const { chatId } = route.params as { chatId: string };
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);

  // הסתר TabBar כשנכנסים למסך זה
  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: 'none' }
        });
      }

      return () => {
        if (parent) {
          parent.setOptions({
            tabBarStyle: {
              backgroundColor: DesignTokens.colors.background.primary,
              borderTopWidth: 0,
              height: Platform.OS === 'ios' ? 90 : 70 + tabBarInsets.bottom,
              paddingBottom: Platform.OS === 'ios' ? 15 : tabBarInsets.bottom + 10,
              paddingTop: 15,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              display: 'flex'
            }
          });
        }
      };
    }, [navigation, tabBarInsets])
  );
  const [isPinned, setIsPinned] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [starredMessages, setStarredMessages] = useState<any[]>([]);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { theme, toggleTheme, isDarkMode } = useTheme();

  // פונקציה לבחירת ערכת נושא
  const handleThemeSelect = () => {
    toggleTheme();
    console.log('🎨 Theme toggled to:', isDarkMode ? 'light' : 'dark');
  };

  // פונקציה לבדיקת מבנה הנתונים
  const debugDataStructure = (data: any) => {
    console.log('🔍 Debugging data structure:');
    console.log('📊 Raw data:', data);

    if (Array.isArray(data)) {
      console.log('📋 Array length:', data.length);
      data.forEach((item, index) => {
        console.log(`📝 Item ${index}:`, {
          user_id: item.user_id,
          role: item.role,
          hasUsers: !!item.users,
          usersKeys: item.users ? Object.keys(item.users) : 'NO_USERS',
          fullName: item.users?.full_name,
          displayName: item.users?.display_name,
          phone: item.users?.phone,
          profilePicture: item.users?.profile_picture
        });
      });
    } else {
      console.log('❌ Data is not an array:', typeof data);
    }
  };

  const loadData = async () => {
    console.log('🔄 Starting to load group data for:', chatId);
    console.log('👤 Current user:', user?.id);

    setLoading(true);

    try {
      console.log('🔄 Loading group data...');

      // טען נתוני הקבוצה
      const { data: groupData, error: groupError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', chatId)
        .single();

      if (groupError) {
        console.error('❌ Error loading group data:', groupError);
        Alert.alert('שגיאה', 'שגיאה בטעינת נתוני הקבוצה');
        return;
      }

      if (!groupData) {
        console.error('❌ No group data found');
        Alert.alert('שגיאה', 'הקבוצה לא נמצאה');
        navigation.goBack();
        return;
      }

      console.log('✅ Group data loaded:', groupData);
      setGroup(groupData);
      setIsPinned(!!groupData?.is_pinned);
      setIsOwner(groupData?.created_by === user?.id);

      // Load members - simple and reliable approach
      console.log('🔄 Loading members for channel:', chatId);

      const { data: membersOnly, error: membersError } = await supabase
        .from('channel_members')
        .select('user_id, role, user_data')
        .eq('channel_id', chatId);

      if (membersError) {
        console.error('❌ Error loading members:', membersError);
        Alert.alert('שגיאה', 'לא ניתן לטעון רשימת חברים');
        return;
      }

      console.log('✅ Members loaded:', membersOnly?.length || 0);
      console.log('📋 First few members:', membersOnly?.slice(0, 3));

      if (membersOnly && membersOnly.length > 0) {
        // המר את הנתונים לפורמט הנכון
        const membersData = membersOnly.map(member => {
          console.log('🔍 Processing member:', member);
          return {
            user_id: member.user_id,
            role: member.role,
            users: {
              id: member.user_id,
              full_name: member.user_data?.full_name || `User ${member.user_id.slice(0, 8)}`,
              profile_picture: member.user_data?.profile_picture || null,
              phone: member.user_data?.phone || null,
              display_name: member.user_data?.display_name || member.user_data?.full_name || `User ${member.user_id.slice(0, 8)}`
            }
          };
        });

        console.log('🔗 Merged members data:', membersData.slice(0, 2));

        const validMembers = membersData.filter(m => m.users && m.user_id);
        console.log('✅ Valid members count:', validMembers.length);
        setMembers(validMembers);

        // בדוק אם המשתמש הנוכחי חבר בקבוצה
        const currentMember = validMembers?.find((m: any) => m.user_id === user?.id);
        const isUserMember = !!currentMember;

        console.log('👤 Current user membership status:', {
          userId: user?.id,
          isMember: isUserMember,
          memberRole: currentMember?.role
        });

        // אם המשתמש לא חבר וזו קבוצה ציבורית, הוסף אותו אוטומטית
        if (!isUserMember && !groupData.is_private && user?.id) {
          console.log('🔄 Auto-adding current user to public group');
          try {
            // בדיקה אם המשתמש כבר חבר בקבוצה
            const { data: existingMember, error: checkError } = await supabase
              .from('channel_members')
              .select('id')
              .eq('channel_id', chatId)
              .eq('user_id', user.id)
              .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
              console.error('❌ Error checking existing membership:', checkError);
            } else if (existingMember) {
              console.log('ℹ️ User is already a member of this group');
              // המשתמש כבר חבר, נעדכן את הנתונים
              const currentUserData = {
                user_id: user.id,
                role: 'member',
                users: {
                  id: user.id,
                  full_name: user.full_name || 'אתה',
                  display_name: user.display_name || 'אתה',
                  profile_picture: user.profile_picture || null,
                  phone: user.phone || null
                }
              };
              validMembers.push(currentUserData);
            } else {
              // המשתמש לא חבר, נוסיף אותו
              const { error: addError } = await supabase
                .from('channel_members')
                .insert({
                  channel_id: chatId,
                  user_id: user.id,
                  role: 'member'
                });

              if (addError) {
                console.error('❌ Error auto-adding user to group:', addError);
              } else {
                console.log('✅ User auto-added to group successfully');
                // הוסף את המשתמש לרשימה
                const currentUserData = {
                  user_id: user.id,
                  role: 'member',
                  users: {
                    id: user.id,
                    full_name: user.full_name || 'אתה',
                    display_name: user.display_name || 'אתה',
                    profile_picture: user.profile_picture || null,
                    phone: user.phone || null
                  }
                };
                validMembers.push(currentUserData);
              }
            }
          } catch (error) {
            console.error('❌ Exception auto-adding user:', error);
          }
        }

        // עדכן את הרשימה עם כל החברים (כולל המשתמש הנוכחי אם נוסף)
        console.log('🎯 Setting members state with (basic):', validMembers);
        setMembers(validMembers);
        const finalCurrentMember = validMembers?.find((m: any) => m.user_id === user?.id);
        setIsMember(!!finalCurrentMember);
        setIsAdmin(finalCurrentMember?.role === 'admin');

      } else {
        console.log('ℹ️ No members found for this channel');
        setMembers([]);
        setIsMember(false);
        setIsAdmin(false);
      }

      // Load media items
      await loadMediaItems();

      // Load starred messages
      await loadStarredMessages();

      console.log('✅ Data loading completed successfully');
    } catch (error) {
      console.error('❌ Error loading members:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת חברים');
    } finally {
      setLoading(false);
    }
  };

  // Load media items (images, videos, audio, documents)
  const loadMediaItems = async () => {
    try {
      console.log('🖼️ Loading media items for channel:', chatId);

      // First, let's check what types of messages exist in this channel
      const { data: allMessages, error: allMessagesError } = await supabase
        .from('messages')
        .select('id, content, type, created_at, sender_id')
        .eq('channel_id', chatId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Let's check what's actually in the content field for media messages
      const { data: mediaTypeMessages, error: mediaTypeError } = await supabase
        .from('messages')
        .select('id, content, type, created_at, sender_id, file_url')
        .eq('channel_id', chatId)
        .in('type', ['image', 'video', 'audio', 'document'])
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('🔍 Media type messages found:', mediaTypeMessages?.length || 0);
      if (mediaTypeMessages && mediaTypeMessages.length > 0) {
        console.log('📋 All media type messages:', mediaTypeMessages);
      }

      // Let's also check for messages with actual file paths
      const { data: realMediaMessages, error: realMediaError } = await supabase
        .from('messages')
        .select('id, content, type, created_at, sender_id')
        .eq('channel_id', chatId)
        .or('content.like.*.jpg,content.like.*.png,content.like.*.jpeg,content.like.*.mp4,content.like.*.mp3,content.like.*.pdf')
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('🔍 Real media messages found:', realMediaMessages?.length || 0);
      if (realMediaMessages && realMediaMessages.length > 0) {
        console.log('📋 Sample real media:', realMediaMessages.slice(0, 3));
      }

      if (allMessagesError) {
        console.error('❌ Error loading all messages:', allMessagesError);
        return;
      }

      console.log('📊 All messages in channel:', allMessages?.length || 0);
      console.log('📋 Message types found:', allMessages?.map(m => m.type) || []);

      // Use media type messages first, then real media messages, then filter from all messages
      const mediaMessages = mediaTypeMessages && mediaTypeMessages.length > 0
        ? mediaTypeMessages
        : realMediaMessages && realMediaMessages.length > 0
          ? realMediaMessages
          : allMessages?.filter(msg =>
            msg.type === 'image' ||
            msg.type === 'video' ||
            msg.type === 'audio' ||
            msg.type === 'document' ||
            msg.content?.includes('http') ||
            msg.content?.includes('.jpg') ||
            msg.content?.includes('.png') ||
            msg.content?.includes('.mp4') ||
            msg.content?.includes('.mp3')
          ) || [];

      console.log('🎯 Media messages found:', mediaMessages.length);
      console.log('📋 Media message details:', mediaMessages.slice(0, 3));

      // Now get user data for these messages
      const { data: mediaData, error: mediaError } = await supabase
        .from('messages')
        .select(`
          id, 
          content, 
          type, 
          created_at, 
          sender_id,
          file_url,
          users!messages_sender_id_fkey(full_name, profile_picture)
        `)
        .eq('channel_id', chatId)
        .in('id', mediaMessages.map(m => m.id))
        .order('created_at', { ascending: false })
        .limit(50);

      if (mediaError) {
        console.error('❌ Error loading media items with user data:', mediaError);
        // Fallback to the filtered messages without user data
        setMediaItems(mediaMessages);
        return;
      }

      console.log('✅ Media items with user data loaded:', mediaData?.length || 0);
      console.log('📋 Sample media item:', mediaData?.[0]);

      // Process media items to get proper URLs from Supabase Storage
      const processedMediaItems = await Promise.all(
        (mediaData || []).map(async (item) => {
          let mediaUrl = item.file_url || item.content;

          console.log('🔍 Processing media item:', {
            id: item.id,
            type: item.type,
            content: item.content,
            file_url: item.file_url
          });

          // If we have a file_url, use it directly
          if (item.file_url) {
            console.log('✅ Using file_url:', item.file_url);
            return {
              ...item,
              content: item.file_url,
              isValid: true
            };
          }

          // Skip items that don't have valid file paths
          if (!item.content ||
            item.content === '[image]' ||
            item.content === '[video]' ||
            item.content === '[audio]' ||
            item.content === '[document]' ||
            item.content.includes('אחאח') ||
            item.content.includes('היידה') ||
            item.content.includes('שלום')) {
            console.log('⏭️ Skipping invalid media content:', item.content);
            return {
              ...item,
              content: null,
              isValid: false
            };
          }

          // If content looks like a file path, get signed URL
          if (item.content && !item.content.startsWith('http')) {
            try {
              console.log('🔄 Getting signed URL for:', item.content);

              // Determine the correct bucket based on media type
              let bucketName = 'chat-files'; // Default for images
              if (item.type === 'video' || item.type === 'audio' || item.type === 'document') {
                bucketName = 'media'; // Use media bucket for video/audio/documents
              }

              console.log('📁 Using bucket:', bucketName, 'for type:', item.type);

              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(item.content, 3600); // 1 hour expiry

              if (signedUrlError) {
                console.error('❌ Error getting signed URL:', signedUrlError);
                return {
                  ...item,
                  content: `placeholder_${item.type}`,
                  isValid: true
                };
              } else {
                mediaUrl = signedUrlData.signedUrl;
                console.log('✅ Got signed URL:', mediaUrl);
                return {
                  ...item,
                  content: mediaUrl,
                  isValid: true
                };
              }
            } catch (error) {
              console.error('❌ Exception getting signed URL:', error);
              return {
                ...item,
                content: `placeholder_${item.type}`,
                isValid: true
              };
            }
          }

          return {
            ...item,
            content: mediaUrl,
            isValid: true
          };
        })
      );

      // Filter out invalid media items
      const validMediaItems = processedMediaItems.filter(item => item.isValid && item.content);

      console.log('🎯 Processed media items:', processedMediaItems.length);
      console.log('✅ Valid media items:', validMediaItems.length);
      setMediaItems(validMediaItems);
    } catch (error) {
      console.error('❌ Exception loading media items:', error);
    }
  };

  // Load pinned messages
  const loadStarredMessages = async () => {
    try {
      if (!user?.id || !chatId) return;

      console.log('⭐ GroupInfoScreen: Loading starred messages for user:', user.id);

      const data = await ChatService.getStarredMessages(chatId, user.id);

      console.log('✅ GroupInfoScreen: Starred messages loaded:', data?.length || 0);
      setStarredMessages(data || []);
    } catch (error) {
      console.error('❌ GroupInfoScreen: Exception loading starred messages:', error);
      setStarredMessages([]);
    }
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered:', { chatId, userId: user?.id });
    if (user?.id) {
      console.log('✅ User ID exists, calling loadData');
      loadData();
    } else {
      console.log('❌ No user ID, skipping loadData');
    }
  }, [chatId, user?.id]);

  // מיין: המשתמש הנוכחי, מנהלים, שאר החברים
  const sortedMembers = () => {
    if (!user) return members;

    console.log('🔄 Sorting members:', {
      totalMembers: members.length,
      currentUserId: user.id
    });

    const you = members.find((m: any) => m.user_id === user.id);
    const admins = members.filter((m: any) => m.role === 'admin' && m.user_id !== user.id);
    const others = members.filter((m: any) => m.role !== 'admin' && m.user_id !== user.id);

    const sorted = [you, ...admins, ...others].filter(Boolean);

    console.log('✅ Sorted members result:', {
      you: you ? { id: you.user_id, name: you.users?.full_name } : null,
      adminsCount: admins.length,
      othersCount: others.length,
      totalSorted: sorted.length
    });

    return sorted;
  };

  const handlePin = async () => {
    try {
      const success = await ChatService.togglePinChat(chatId, isPinned);
      if (success) {
        setIsPinned(!isPinned);
        Alert.alert('הצלחה', isPinned ? 'הקבוצה הוסרה מהמועדפים' : 'הקבוצה נוספה למועדפים');
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      Alert.alert('שגיאה', 'לא ניתן להצמיד/להסיר הצמדה מהקבוצה');
    }
  };

  const handleExit = async () => {
    Alert.alert('יציאה מהקבוצה', 'האם אתה בטוח שברצונך לצאת מהקבוצה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'צא', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase
              .from('channel_members')
              .delete()
              .eq('channel_id', chatId)
              .eq('user_id', user?.id);

            if (error) {
              console.error('Error leaving group:', error);
              Alert.alert('שגיאה', 'לא ניתן לצאת מהקבוצה כעת');
              return;
            }

            setIsMember(false);
            Alert.alert('הצלחה', 'יצאת מהקבוצה בהצלחה');
            navigation.goBack();
          } catch (error) {
            console.error('Error leaving group:', error);
            Alert.alert('שגיאה', 'שגיאה ביציאה מהקבוצה');
          }
        }
      }
    ]);
  };

  const handleJoin = async () => {
    try {
      console.log('🔄 User attempting to join group:', { userId: user?.id, chatId });

      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: chatId,
          user_id: user?.id,
          role: 'member'
        });

      if (error) {
        console.error('❌ Error joining group:', error);
        Alert.alert('שגיאה', 'לא ניתן להצטרף לקבוצה כעת');
        return;
      }

      console.log('✅ User joined group successfully');
      setIsMember(true);
      Alert.alert('הצלחה', 'הצטרפת לקבוצה בהצלחה!');

      // רענן את רשימת החברים
      await loadData();
    } catch (error) {
      console.error('❌ Exception joining group:', error);
      Alert.alert('שגיאה', 'לא ניתן להצטרף לקבוצה כעת');
    }
  };

  const handleShareGroup = async () => {
    try {
      await Share.share({
        message: `הצטרף לקבוצה "${group?.name}" באפליקציה!`,
        title: `קבוצה: ${group?.name}`,
      });
    } catch (error) {
      console.error('Error sharing group:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הקבוצה');
    }
  };

  const handlePromoteMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      'העלאה למנהל',
      `האם אתה בטוח שברצונך להעלות את ${memberName} למנהל קבוצה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'העלה למנהל',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('channel_members')
                .update({ role: 'admin' })
                .eq('channel_id', chatId)
                .eq('user_id', memberId);

              if (error) {
                console.error('Error promoting member:', error);
                Alert.alert('שגיאה', 'לא ניתן להעלות למנהל כעת');
                return;
              }

              Alert.alert('הצלחה', `${memberName} הועלה למנהל בהצלחה!`);
              await loadData();
            } catch (error) {
              console.error('Error promoting member:', error);
              Alert.alert('שגיאה', 'שגיאה בהעלאה למנהל');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      'הסרת חבר',
      `האם אתה בטוח שברצונך להסיר את ${memberName} מהקבוצה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('channel_members')
                .delete()
                .eq('channel_id', chatId)
                .eq('user_id', memberId);

              if (error) {
                console.error('Error removing member:', error);
                Alert.alert('שגיאה', 'לא ניתן להסיר חבר כעת');
                return;
              }

              Alert.alert('הצלחה', `${memberName} הוסר מהקבוצה בהצלחה!`);
              await loadData();
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('שגיאה', 'שגיאה בהסרת חבר');
            }
          },
        },
      ]
    );
  };

  const handleEditGroup = () => {
    // ניווט לדף עריכת קבוצה (אם קיים)
    Alert.alert('עריכת קבוצה', 'פונקציונליות זו תהיה זמינה בקרוב');
  };

  const handleDeleteGroup = () => {
    if (!isOwner) return;

    Alert.alert(
      'מחיקת קבוצה',
      'האם אתה בטוח שברצונך למחוק את הקבוצה? פעולה זו אינה הפיכה!',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('channels')
                .delete()
                .eq('id', chatId);

              if (error) {
                console.error('Error deleting group:', error);
                Alert.alert('שגיאה', 'לא ניתן למחוק את הקבוצה כעת');
                return;
              }

              Alert.alert('הצלחה', 'הקבוצה נמחקה בהצלחה!');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('שגיאה', 'שגיאה במחיקת הקבוצה');
            }
          },
        },
      ]
    );
  };

  // Toggle mute notifications
  const handleToggleMute = async () => {
    try {
      setIsMuted(!isMuted);
      // Here you would implement the actual mute functionality
      console.log('🔇 Toggling mute:', !isMuted);
      Alert.alert('הצלחה', isMuted ? 'התראות הופעלו' : 'התראות הושתקו');
    } catch (error) {
      console.error('Error toggling mute:', error);
      Alert.alert('שגיאה', 'לא ניתן לשנות הגדרות התראות');
    }
  };



  // Open media viewer
  const handleOpenMedia = (mediaItem: any) => {
    console.log('🖼️ Opening media:', mediaItem);
    console.log('🎯 Current showMediaPreview state:', showMediaPreview);
    setSelectedMedia(mediaItem);
    setShowMediaPreview(true);
    console.log('✅ showMediaPreview set to true');
  };

  // Navigate to pinned message
  const handleNavigateToPinnedMessage = (messageId: string) => {
    console.log('📌 Navigating to pinned message:', messageId);
    navigation.navigate('ChatRoom', {
      chatId,
      jumpToMessage: messageId
    });
  };

  const iconName = group?.icon_name && iconMap[group.icon_name] ? iconMap[group.icon_name] : 'chatbubbles';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            paddingHorizontal: 32,
            paddingVertical: 24,
            borderRadius: DesignTokens.borderRadius.xl,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: DesignTokens.colors.border.primary
          }}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: DesignTokens.typography.fontSize.base,
              fontWeight: '500' as any,
              marginTop: 16,
              textAlign: 'center'
            }}>
              טוען פרטי קבוצה...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{
          color: DesignTokens.colors.text.primary,
          fontSize: DesignTokens.typography.fontSize.lg,
          marginBottom: 16
        }}>הקבוצה לא נמצאה</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: DesignTokens.colors.primary.main,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: DesignTokens.borderRadius.xl
          }}
        >
          <Text style={{
            color: DesignTokens.colors.background.primary,
            fontWeight: '700' as any
          }}>חזור</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: DesignTokens.colors.background.primary,
      }}>
        {/* כפתור חזור - מימין */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            padding: 8
          }}
        >
          <ArrowRight size={24} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* כותרת ממורכזת */}
        <Text style={{
          fontSize: 18,
          fontWeight: '700',
          color: DesignTokens.colors.text.primary,
          textAlign: 'center'
        }}>פרטי קבוצה</Text>

        {/* כפתור שיתוף - משמאל */}
        <TouchableOpacity
          onPress={handleShareGroup}
          style={{
            padding: 8
          }}
        >
          <ShareIcon size={24} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Group Header */}
        <View style={{
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 24,
          paddingHorizontal: 20,
          paddingVertical: 32,
          borderRadius: 16,
          backgroundColor: DesignTokens.colors.background.secondary
        }}>
          {/* תמונת קבוצה */}
          {group?.image_url ? (
            <Image
              source={{ uri: group.image_url }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                marginBottom: 16,
                borderWidth: 4,
                borderColor: DesignTokens.colors.background.primary
              }}
            />
          ) : (
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              marginBottom: 16,
              backgroundColor: DesignTokens.colors.primary.main,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              borderColor: DesignTokens.colors.background.primary
            }}>
              <Text style={{ fontSize: 40, color: '#FFFFFF', fontWeight: 'bold' }}>
                {group?.name ? group.name[0] : '?'}
              </Text>
            </View>
          )}

          <Text style={{
            fontSize: 24,
            fontWeight: '800',
            color: DesignTokens.colors.text.primary,
            textAlign: 'center',
            marginBottom: 8
          }}>{group?.name}</Text>

          <Text style={{
            textAlign: 'center',
            color: DesignTokens.colors.text.secondary,
            fontSize: 15,
            lineHeight: 22,
            marginBottom: 20,
            paddingHorizontal: 16
          }}>
            {group?.description || 'אין תיאור זמין לקבוצה זו'}
          </Text>

          <View style={{
            backgroundColor: DesignTokens.colors.background.tertiary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Users size={14} color={DesignTokens.colors.primary.main} style={{ marginRight: 6 }} />
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontWeight: '600',
              fontSize: 13
            }}>{members.length} משתתפים</Text>
          </View>
        </View>


        {/* Admin/Owner Actions */}
        {(isAdmin || isOwner) && (
          <View style={{
            marginHorizontal: 20,
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 20,
            borderRadius: 16,
            backgroundColor: DesignTokens.colors.background.secondary,
            borderWidth: 0
          }}>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 16
            }}>פעולות מנהל</Text>
            <View style={{
              flexDirection: 'row-reverse',
              justifyContent: 'space-around'
            }}>
              {isOwner && (
                <TouchableOpacity
                  onPress={handleDeleteGroup}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    backgroundColor: `${DesignTokens.colors.danger.main}26`,
                    borderRadius: 12,
                    flex: 1,
                    marginHorizontal: 4
                  }}
                >
                  <Trash2 size={20} color={DesignTokens.colors.danger.main} strokeWidth={2} />
                  <Text style={{
                    color: DesignTokens.colors.danger.main,
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: '600'
                  }}>מחק קבוצה</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Media Gallery Section */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 16,
          overflow: 'hidden'
        }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MediaGallery', {
              chatId: chatId,
              channelName: group?.name || 'קבוצה'
            })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16
            }}
          >
            {/* Chevron - שמאל */}
            <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />

            {/* Text Content - מרכז */}
            <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: DesignTokens.colors.text.primary,
                marginBottom: 2,
                textAlign: 'right'
              }}>מדיה, קישורים וקבצים</Text>
              <Text style={{
                fontSize: 13,
                color: DesignTokens.colors.text.tertiary,
                textAlign: 'right'
              }}>{mediaItems.length} פריטים</Text>
            </View>

            {/* Icon - ימין */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ImageIcon size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        </View>

        {/* הודעות שסומנו בכוכב */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 16,
          overflow: 'hidden'
        }}>
          <TouchableOpacity
            onPress={() => setShowPinnedMessages(!showPinnedMessages)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16
            }}
          >
            {/* Chevron - שמאל */}
            <Ionicons
              name={showPinnedMessages ? "chevron-up" : "chevron-down"}
              size={20}
              color={DesignTokens.colors.text.tertiary}
            />

            {/* Text Content - מרכז */}
            <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: DesignTokens.colors.text.primary,
                marginBottom: 2,
                textAlign: 'right'
              }}>הודעות שסומנו בכוכב</Text>
              <Text style={{
                fontSize: 13,
                color: DesignTokens.colors.text.tertiary,
                textAlign: 'right'
              }}>{starredMessages.length} הודעות</Text>
            </View>

            {/* Icon - ימין */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Star size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {showPinnedMessages && starredMessages.length > 0 && (
            <View style={{ marginTop: DesignTokens.spacing.lg }}>
              {starredMessages.slice(0, 3).map((message, index) => (
                <View key={index} style={{
                  backgroundColor: DesignTokens.colors.background.tertiary,
                  borderRadius: DesignTokens.borderRadius.md,
                  padding: DesignTokens.spacing.md,
                  marginBottom: DesignTokens.spacing.sm
                }}>
                  <Text style={{
                    color: DesignTokens.colors.text.primary,
                    fontSize: DesignTokens.typography.fontSize.sm,
                    lineHeight: 20
                  }} numberOfLines={2}>
                    {message.content}
                  </Text>
                  <Text style={{
                    color: DesignTokens.colors.text.tertiary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    marginTop: 4
                  }}>
                    {new Date(message.created_at).toLocaleDateString('he-IL')}
                  </Text>
                </View>
              ))}
              {starredMessages.length > 3 && (
                <Text style={{
                  color: DesignTokens.colors.primary.main,
                  fontSize: DesignTokens.typography.fontSize.sm,
                  textAlign: 'center',
                  marginTop: DesignTokens.spacing.sm,
                  fontWeight: '600' as any
                }}>
                  +{starredMessages.length - 3} הודעות נוספות
                </Text>
              )}
            </View>
          )}
        </View>

        {/* הגדרות */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 16,
          overflow: 'hidden'
        }}>
          {/* התראות */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: DesignTokens.colors.border.primary
          }}>
            {/* Switch - שמאל */}
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: DesignTokens.colors.background.tertiary, true: DesignTokens.colors.success.main }}
              thumbColor={notificationsEnabled ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary}
              ios_backgroundColor={DesignTokens.colors.background.tertiary}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />

            {/* Text Content - מרכז */}
            <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: DesignTokens.colors.text.primary,
                marginBottom: 2,
                textAlign: 'right'
              }}>התראות</Text>
              <Text style={{
                fontSize: 13,
                color: DesignTokens.colors.text.tertiary,
                textAlign: 'right'
              }}>
                {notificationsEnabled ? 'מופעלות' : 'מבוטלות'}
              </Text>
            </View>

            {/* Icon - ימין */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: notificationsEnabled ? `${DesignTokens.colors.success.main}1A` : DesignTokens.colors.background.tertiary,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {notificationsEnabled ? <Bell size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} /> : <BellOff size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />}
            </View>
          </View>

          {/* ערכת נושא */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16
          }}>
            {/* Switch - שמאל */}
            <Switch
              value={!isDarkMode}
              onValueChange={handleThemeSelect}
              trackColor={{ false: DesignTokens.colors.background.tertiary, true: DesignTokens.colors.success.main }}
              thumbColor={isDarkMode ? DesignTokens.colors.text.tertiary : DesignTokens.colors.text.primary}
              ios_backgroundColor={DesignTokens.colors.background.tertiary}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />

            {/* Text Content - מרכז */}
            <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: DesignTokens.colors.text.primary,
                marginBottom: 2,
                textAlign: 'right'
              }}>ערכת נושא</Text>
              <Text style={{
                fontSize: 13,
                color: DesignTokens.colors.text.tertiary,
                textAlign: 'right'
              }}>
                {isDarkMode ? 'מצב כהה' : 'מצב בהיר'}
              </Text>
            </View>

            {/* Icon - ימין */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Palette size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
            </View>
          </View>
        </View>




        {/* Admin Settings Section - Only for Admins/Owners */}
        {(isAdmin || isOwner) && (
          <View style={{
            marginHorizontal: 20,
            marginTop: 16
          }}>
            {/* כותרת סקשן */}
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: DesignTokens.colors.text.tertiary,
              marginBottom: 12,
              marginRight: 4,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>הגדרות מנהל</Text>

            {/* בלוק הגדרות מנהל */}
            <View style={{
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 16,
              overflow: 'hidden'
            }}>

              {/* Group Description */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.primary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>תיאור קבוצה</Text>
                  <Text style={{
                    fontSize: 13,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }} numberOfLines={1}>
                    {group?.description || 'אין תיאור'}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.success.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              {/* Group Icon */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.primary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>אייקון קבוצה</Text>
                  <Text style={{
                    fontSize: 13,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }}>שנה את האייקון</Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.success.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ImageIcon size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              {/* Group Name */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.primary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>שם קבוצה</Text>
                  <Text style={{
                    fontSize: 13,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }} numberOfLines={1}>
                    {group?.name || 'ללא שם'}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.success.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit3 size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              {/* Clear Chat History */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.danger.main} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.danger.main,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>נקה היסטוריה</Text>
                  <Text style={{
                    fontSize: 13,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }}>מחק את כל ההודעות</Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.danger.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={20} color={DesignTokens.colors.danger.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              {/* Group Privacy */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: DesignTokens.colors.border.primary
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.primary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>הגדרות פרטיות</Text>
                  <Text style={{
                    fontSize: 13,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }}>
                    {group?.is_private ? 'קבוצה פרטית' : 'קבוצה ציבורית'}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.success.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Lock size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              {/* More Admin Options */}
              <TouchableOpacity style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16
              }}>
                {/* Chevron - שמאל */}
                <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.tertiary} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.primary,
                    textAlign: 'right'
                  }}>אפשרויות נוספות</Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: `${DesignTokens.colors.success.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MoreVertical size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Members Section */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16
        }}>
          {/* כותרת סקשן */}
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: DesignTokens.colors.text.tertiary,
            marginBottom: 12,
            marginRight: 4,
            textAlign: 'right',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>משתתפים ({members.length})</Text>

          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 16,
            overflow: 'hidden'
          }}>
            <TouchableOpacity
              onPress={() => setShowAll(!showAll)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16
              }}
            >
              {/* Chevron - שמאל */}
              <Ionicons
                name={showAll ? "chevron-up" : "chevron-down"}
                size={20}
                color={DesignTokens.colors.text.tertiary}
              />

              {/* Text Content - מרכז */}
              <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: DesignTokens.colors.text.primary,
                  marginBottom: 2,
                  textAlign: 'right'
                }}>הצג את כל החברים</Text>
                <Text style={{
                  fontSize: 13,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'right'
                }}>לחץ להרחבה</Text>
              </View>

              {/* Icon - ימין */}
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: `${DesignTokens.colors.success.main}1A`,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            </TouchableOpacity>

            {loading ? (
              <View style={{
                alignItems: 'center',
                paddingVertical: 32
              }}>
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontSize: 16
                }}>טוען חברים...</Text>
              </View>
            ) : members.length === 0 ? (
              <View style={{
                alignItems: 'center',
                paddingVertical: 32
              }}>
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  textAlign: 'center',
                  marginBottom: 16,
                  fontSize: 16
                }}>אין חברים נוספים בקבוצה זו</Text>
                <Text style={{
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'center',
                  fontSize: 14,
                  marginBottom: 16,
                  lineHeight: 20
                }}>
                  אתה יכול להזמין חברים או לחכות שחברים נוספים יצטרפו
                </Text>
                <View style={{
                  flexDirection: 'row'
                }}>
                  <TouchableOpacity
                    onPress={loadData}
                    style={{
                      backgroundColor: DesignTokens.colors.background.tertiary,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      marginRight: 8
                    }}
                  >
                    <Text style={{
                      color: DesignTokens.colors.text.primary,
                      fontWeight: '700',
                      fontSize: 14
                    }}>רענן</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleShareGroup}
                    style={{
                      backgroundColor: DesignTokens.colors.primary.main,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12
                    }}
                  >
                    <Text style={{
                      color: DesignTokens.colors.background.primary,
                      fontWeight: '700',
                      fontSize: 14
                    }}>הזמן חברים</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 16 }}>
                {/* Show first 5 members */}
                {sortedMembers().slice(0, 5).map((item, index) => {
                  const memberName = item.users?.full_name || item.users?.display_name || 'משתמש';
                  const memberPhone = item.users?.phone;
                  const memberImage = item.users?.profile_picture;

                  return (
                    <View key={item.user_id} style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      padding: 14,
                      backgroundColor: 'transparent',
                      borderRadius: 12,
                      borderBottomWidth: index < sortedMembers().slice(0, 5).length - 1 ? 1 : 0,
                      borderBottomColor: DesignTokens.colors.border.primary
                    }}>
                      <View style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        flex: 1
                      }}>
                        {memberImage ? (
                          <Image
                            source={{ uri: memberImage }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              marginRight: 12
                            }}
                            onError={(error) => console.log('❌ Image load error:', error)}
                          />
                        ) : (
                          <View style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: DesignTokens.colors.background.tertiary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12
                          }}>
                            <User size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <View style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            marginBottom: 4
                          }}>
                            <Text style={{
                              color: DesignTokens.colors.text.primary,
                              fontWeight: '600',
                              fontSize: 14,
                              marginRight: 8,
                              textAlign: 'right',
                              flex: 1
                            }} numberOfLines={1}>
                              {memberName}
                            </Text>

                            {item.role === 'admin' && (
                              <View style={{
                                backgroundColor: `${DesignTokens.colors.success.main}1A`,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                marginLeft: 4
                              }}>
                                <Text style={{
                                  color: DesignTokens.colors.primary.main,
                                  fontWeight: '700',
                                  fontSize: 9
                                }}>מנהל</Text>
                              </View>
                            )}

                            {item.user_id === user?.id && (
                              <View style={{
                                backgroundColor: DesignTokens.colors.background.tertiary,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                marginLeft: 4
                              }}>
                                <Text style={{
                                  color: DesignTokens.colors.text.secondary,
                                  fontWeight: '700',
                                  fontSize: 9
                                }}>אתה</Text>
                              </View>
                            )}
                          </View>

                          {memberPhone && (
                            <Text style={{
                              color: DesignTokens.colors.text.tertiary,
                              fontSize: 12,
                              marginLeft: 8,
                              textAlign: 'right'
                            }}>{memberPhone}</Text>
                          )}
                        </View>
                      </View>

                      {/* Admin Actions */}
                      {(isAdmin || isOwner) && item.user_id !== user?.id && (
                        <View style={{
                          flexDirection: 'row-reverse'
                        }}>
                          {item.role !== 'admin' && (
                            <TouchableOpacity
                              onPress={() => handlePromoteMember(item.user_id, memberName)}
                              style={{
                                backgroundColor: `${DesignTokens.colors.success.main}26`,
                                padding: DesignTokens.spacing.sm,
                                borderRadius: DesignTokens.borderRadius.sm,
                                marginLeft: DesignTokens.spacing.sm
                              }}
                            >
                              <Star size={14} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            onPress={() => handleRemoveMember(item.user_id, memberName)}
                            style={{
                              backgroundColor: `${DesignTokens.colors.danger.main}26`,
                              padding: DesignTokens.spacing.sm,
                              borderRadius: DesignTokens.borderRadius.sm
                            }}
                          >
                            <UserMinus size={14} color={DesignTokens.colors.danger.main} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Show all members if expanded */}
                {showAll && sortedMembers().length > 5 && (
                  <View style={{ marginTop: 16 }}>
                    {sortedMembers().slice(5).map((item) => {
                      const memberName = item.users?.full_name || item.users?.display_name || 'משתמש';
                      const memberPhone = item.users?.phone;
                      const memberImage = item.users?.profile_picture;

                      return (
                        <View key={item.user_id} style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: DesignTokens.spacing.md,
                          padding: DesignTokens.spacing.md,
                          backgroundColor: DesignTokens.colors.background.tertiary,
                          borderRadius: DesignTokens.borderRadius.md,
                          borderWidth: 1,
                          borderColor: DesignTokens.colors.border.primary
                        }}>
                          <View style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            flex: 1
                          }}>
                            {memberImage ? (
                              <Image
                                source={{ uri: memberImage }}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: DesignTokens.borderRadius.full,
                                  marginRight: DesignTokens.spacing.md
                                }}
                                onError={(error) => console.log('❌ Image load error:', error)}
                              />
                            ) : (
                              <View style={{
                                width: 44,
                                height: 44,
                                borderRadius: DesignTokens.borderRadius.full,
                                backgroundColor: DesignTokens.colors.background.tertiary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: DesignTokens.spacing.md
                              }}>
                                <User size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                              </View>
                            )}

                            <View style={{ flex: 1 }}>
                              <View style={{
                                flexDirection: 'row-reverse',
                                alignItems: 'center',
                                marginBottom: 4
                              }}>
                                <Text style={{
                                  color: DesignTokens.colors.text.primary,
                                  fontWeight: '600' as any,
                                  fontSize: DesignTokens.typography.fontSize.sm,
                                  marginRight: DesignTokens.spacing.sm,
                                  textAlign: 'right',
                                  flex: 1
                                }} numberOfLines={1}>
                                  {memberName}
                                </Text>

                                {item.role === 'admin' && (
                                  <View style={{
                                    backgroundColor: `${DesignTokens.colors.success.main}26`,
                                    borderRadius: DesignTokens.borderRadius.sm,
                                    paddingHorizontal: DesignTokens.spacing.sm,
                                    paddingVertical: 4,
                                    marginLeft: 4
                                  }}>
                                    <Text style={{
                                      color: DesignTokens.colors.primary.main,
                                      fontWeight: '700' as any,
                                      fontSize: 9
                                    }}>מנהל</Text>
                                  </View>
                                )}

                                {item.user_id === user?.id && (
                                  <View style={{
                                    backgroundColor: DesignTokens.colors.background.tertiary,
                                    borderRadius: DesignTokens.borderRadius.sm,
                                    paddingHorizontal: DesignTokens.spacing.sm,
                                    paddingVertical: 4,
                                    marginLeft: 4
                                  }}>
                                    <Text style={{
                                      color: DesignTokens.colors.text.secondary,
                                      fontWeight: '700' as any,
                                      fontSize: 9
                                    }}>אתה</Text>
                                  </View>
                                )}
                              </View>

                              {memberPhone && (
                                <Text style={{
                                  color: DesignTokens.colors.text.tertiary,
                                  fontSize: DesignTokens.typography.fontSize.xs,
                                  marginLeft: DesignTokens.spacing.sm,
                                  textAlign: 'right'
                                }}>{memberPhone}</Text>
                              )}
                            </View>
                          </View>

                          {/* Admin Actions */}
                          {(isAdmin || isOwner) && item.user_id !== user?.id && (
                            <View style={{
                              flexDirection: 'row-reverse'
                            }}>
                              {item.role !== 'admin' && (
                                <TouchableOpacity
                                  onPress={() => handlePromoteMember(item.user_id, memberName)}
                                  style={{
                                    backgroundColor: `${DesignTokens.colors.success.main}26`,
                                    padding: DesignTokens.spacing.sm,
                                    borderRadius: DesignTokens.borderRadius.sm,
                                    marginLeft: DesignTokens.spacing.sm
                                  }}
                                >
                                  <Star size={14} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                onPress={() => handleRemoveMember(item.user_id, memberName)}
                                style={{
                                  backgroundColor: `${DesignTokens.colors.danger.main}26`,
                                  padding: DesignTokens.spacing.sm,
                                  borderRadius: DesignTokens.borderRadius.sm
                                }}
                              >
                                <UserMinus size={14} color={DesignTokens.colors.danger.main} strokeWidth={2} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Show more/less button */}
                {members.length > 5 && (
                  <TouchableOpacity
                    onPress={() => setShowAll(!showAll)}
                    style={{
                      marginTop: DesignTokens.spacing.md,
                      backgroundColor: DesignTokens.colors.background.secondary,
                      padding: DesignTokens.spacing.md,
                      borderRadius: DesignTokens.borderRadius.md,
                      borderWidth: 1,
                      borderColor: DesignTokens.colors.border.primary
                    }}
                  >
                    <Text style={{
                      color: DesignTokens.colors.text.secondary,
                      textAlign: 'center',
                      fontWeight: '600' as any,
                      fontSize: DesignTokens.typography.fontSize.sm
                    }}>
                      {showAll ? `הצג פחות` : `הצג את כל ${members.length} החברים`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Exit Group Button */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 20,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 16,
          overflow: 'hidden'
        }}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'יציאה מהקבוצה',
                'האם אתה בטוח שברצונך לצאת מהקבוצה?',
                [
                  {
                    text: 'ביטול',
                    style: 'cancel'
                  },
                  {
                    text: 'צא מהקבוצה',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        console.log('🚪 Attempting to leave group:', { chatId, userId: user?.id });

                        const { error } = await supabase
                          .from('channel_members')
                          .delete()
                          .eq('channel_id', chatId)
                          .eq('user_id', user?.id);

                        if (error) {
                          console.error('❌ Error leaving group:', error);
                          throw error;
                        }

                        console.log('✅ Successfully left group');
                        Alert.alert('הצלחה', 'יצאת מהקבוצה בהצלחה');
                        navigation.goBack();
                      } catch (error) {
                        console.error('❌ Exception leaving group:', error);
                        Alert.alert('שגיאה', `לא ניתן לצאת מהקבוצה כרגע: ${(error as any)?.message || 'שגיאה לא ידועה'}`);
                      }
                    }
                  }
                ]
              );
            }}
            style={{
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center'
            }}
          >
            <Text style={{
              color: DesignTokens.colors.danger.main,
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center'
            }}>
              צא מהקבוצה
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}