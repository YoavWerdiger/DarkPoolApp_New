import { View, Text, Image, FlatList, TouchableOpacity, ScrollView, Alert, Share, Linking, Modal, Dimensions, Switch, ActivityIndicator, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, Share as ShareIcon, Trash2, ImageIcon, Star, Bell, BellOff, Palette, FileText, Edit3, Lock, MoreVertical, Users, User, UserMinus } from 'lucide-react-native';


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
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { chatId } = route.params as { chatId: string };
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
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
  const { theme, toggleTheme, isDark } = useTheme();

  // פונקציה לבחירת ערכת נושא
  const handleThemeSelect = () => {
    toggleTheme();
    console.log('🎨 Theme toggled to:', isDark ? 'light' : 'dark');
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
      if (!user?.id) return;
      
      console.log('⭐ GroupInfoScreen: Loading starred messages for user:', user.id);
      
      const ChatService = await import('../../services/chatService');
      const data = await ChatService.ChatService.getStarredMessages(user.id);
      
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
      { text: 'צא', style: 'destructive', onPress: async () => {
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
      }}
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
      <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
        <LinearGradient 
          colors={['rgba(0,230,84,0.08)', 'rgba(0,230,84,0.03)', 'rgba(0,230,84,0.05)']} 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 32,
            paddingVertical: 24,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(0,230,84,0.2)'
          }}>
            <ActivityIndicator size="large" color="#00E654" />
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 16, 
              fontWeight: '500',
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
      <LinearGradient colors={[ 'rgba(0,230,84,0.06)', '#0b0b0b' ]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text className="text-white text-lg">הקבוצה לא נמצאה</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 bg-primary px-6 py-3 rounded-xl">
          <Text className="text-black font-bold">חזור</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Header */}
      <View style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
                  backgroundColor: '#181818',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,230,84,0.2)'
      }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,230,84,0.2)',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowRight size={24} color="#00E654" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={{
          fontSize: 20,
          fontWeight: '700',
          color: '#FFFFFF',
          letterSpacing: 0.5
        }}>פרטי קבוצה</Text>
        <TouchableOpacity 
          onPress={handleShareGroup}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,230,84,0.2)',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ShareIcon size={24} color="#00E654" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Group Header */}
        <View style={{
          alignItems: 'center',
          marginHorizontal: 20,
          marginTop: 20,
          paddingHorizontal: 24,
          paddingVertical: 32,
          borderRadius: 20,
          backgroundColor: '#181818',
          borderWidth: 2,
          borderColor: 'rgba(0,230,84,0.3)',
          shadowColor: '#00E654',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 12
        }}>
          {group?.image_url ? (
            <Image 
              source={{ uri: group.image_url }} 
              style={{ 
                width: 112,
                height: 112,
                borderRadius: 56,
                marginBottom: 16,
                borderWidth: 4,
                borderColor: '#00E654',
                shadowColor: '#00E654', 
                shadowOpacity: 0.5, 
                shadowRadius: 16, 
                shadowOffset: { width: 0, height: 8 },
              }} 
            />
          ) : (
            <View style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 4,
              borderColor: '#00E654',
                shadowColor: '#00E654', 
              shadowOpacity: 0.5, 
              shadowRadius: 16, 
              shadowOffset: { width: 0, height: 8 },
              elevation: 8
            }}>
              <Text style={{ color: '#000000', fontSize: 40, fontWeight: '800' }}>
                {group?.name?.charAt(0) || 'ק'}
              </Text>
            </View>
          )}
          
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 8,
            letterSpacing: -0.5
          }}>{group?.name}</Text>
          
          <Text style={{
            textAlign: 'center',
            color: '#B0B0B0',
            fontSize: 16,
            lineHeight: 24,
            marginBottom: 16,
            paddingHorizontal: 16,
            fontWeight: '400'
          }}>
            {group?.description || 'אין תיאור זמין לקבוצה זו'}
          </Text>
          
          <View style={{
            backgroundColor: 'rgba(0,230,84,0.15)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(0,230,84,0.3)'
          }}>
            <Text style={{
              color: '#00E654',
              fontWeight: '700',
              fontSize: 14
            }}>{members.length} משתתפים</Text>
          </View>
        </View>


        {/* Admin/Owner Actions */}
        {(isAdmin || isOwner) && (
          <View style={{
            marginHorizontal: 20,
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 20,
            borderRadius: 20,
            backgroundColor: '#181818',
            borderWidth: 1,
            borderColor: 'rgba(255,0,0,0.2)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4
          }}>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 16,
              letterSpacing: 0.5
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
                    paddingHorizontal: 16,
                    backgroundColor: '#DC2626',
                    borderRadius: 16,
                    flex: 1,
                    marginHorizontal: 4,
                    shadowColor: '#DC2626',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                >
                  <Trash2 size={24} color="#FFFFFF" strokeWidth={2} />
                  <Text style={{
                    color: '#FFFFFF',
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: '700'
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
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 16,
          backgroundColor: '#181818',
          borderWidth: 1,
          borderColor: 'rgba(0,230,84,0.15)'
        }}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('MediaGallery', { 
                chatId: chatId, 
                channelName: group?.name || 'קבוצה' 
              })}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: 1
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: '#00E654',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <ImageIcon size={20} color="#000000" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 16,
                  marginBottom: 2,
                  textAlign: 'right'
                }}>מדיה, קישורים וקבצים</Text>
                <Text style={{
                  color: '#B0B0B0',
                  fontSize: 14,
                  textAlign: 'right'
                }}>{mediaItems.length} פריטים</Text>
              </View>
            </View>
              <Ionicons 
              name="chevron-back" 
                size={20} 
                color="#00E654" 
              />
              </TouchableOpacity>
          </View>

        {/* הודעות שסומנו בכוכב */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 16,
          backgroundColor: '#181818',
          borderWidth: 1,
          borderColor: 'rgba(0,230,84,0.15)'
        }}>
          <TouchableOpacity 
            onPress={() => setShowPinnedMessages(!showPinnedMessages)}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: 1
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: '#F59E0B',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <Star size={20} color="#000000" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 16,
                  marginBottom: 2,
                  textAlign: 'right'
                }}>הודעות שסומנו בכוכב</Text>
                <Text style={{
                  color: '#B0B0B0',
                  fontSize: 14,
                  textAlign: 'right'
                }}>{starredMessages.length} הודעות</Text>
              </View>
            </View>
            <Ionicons 
              name={showPinnedMessages ? "chevron-up" : "chevron-down"} 
                size={20} 
              color="#00E654" 
              />
          </TouchableOpacity>
          
          {showPinnedMessages && starredMessages.length > 0 && (
            <View style={{ marginTop: 16 }}>
              {starredMessages.slice(0, 3).map((message, index) => (
                <View key={index} style={{
                  backgroundColor: '#181818',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(0,230,84,0.1)'
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    lineHeight: 20
                  }} numberOfLines={2}>
                    {message.content}
                  </Text>
                  <Text style={{
                    color: '#B0B0B0',
                    fontSize: 12,
                    marginTop: 4
                  }}>
                    {new Date(message.created_at).toLocaleDateString('he-IL')}
                  </Text>
                </View>
              ))}
              {starredMessages.length > 3 && (
                <Text style={{
                  color: '#00E654',
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 8,
                  fontWeight: '600'
                }}>
                  +{starredMessages.length - 3} הודעות נוספות
                </Text>
              )}
            </View>
          )}
        </View>

        {/* הגדרות התראות */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 16,
          backgroundColor: '#181818',
          borderWidth: 1,
          borderColor: 'rgba(0,230,84,0.15)'
        }}>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: 1
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: '#3B82F6',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                {notificationsEnabled ? <Bell size={20} color="#FFFFFF" strokeWidth={2} /> : <BellOff size={20} color="#FFFFFF" strokeWidth={2} />}
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 16,
                  marginBottom: 2,
                  textAlign: 'right'
                }}>התראות</Text>
                <Text style={{
                  color: '#B0B0B0',
                  fontSize: 14,
                  textAlign: 'right'
                }}>
                  {notificationsEnabled ? 'מופעלות' : 'מבוטלות'}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: 'rgba(51,51,51,0.8)', true: '#00E654' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#666666'}
              ios_backgroundColor="rgba(51,51,51,0.8)"
            />
          </View>
        </View>

        {/* ערכת נושא לצ'אט */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 16,
          backgroundColor: '#181818',
          borderWidth: 1,
          borderColor: 'rgba(0,230,84,0.15)'
        }}>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: 1
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: '#8B5CF6',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <Palette size={20} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 16,
                  marginBottom: 2,
                  textAlign: 'right'
                }}>ערכת נושא</Text>
                <Text style={{
                  color: '#B0B0B0',
                  fontSize: 14,
                  textAlign: 'right'
                }}>
                  {isDark ? 'מצב כהה' : 'מצב בהיר'}
                </Text>
              </View>
            </View>
            <Switch
              value={!isDark}
              onValueChange={handleThemeSelect}
              trackColor={{ false: 'rgba(51,51,51,0.8)', true: '#00E654' }}
              thumbColor={isDark ? '#666666' : '#FFFFFF'}
              ios_backgroundColor="rgba(51,51,51,0.8)"
            />
          </View>
        </View>




        {/* Admin Settings Section - Only for Admins/Owners */}
        {(isAdmin || isOwner) && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 16,
            backgroundColor: '#111111',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#222',
            padding: 16
          }}>
            <Text style={{
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: 18,
              marginBottom: 16,
              textAlign: 'right'
            }}>הגדרות מנהל</Text>
            
            {/* Group Description */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <FileText size={24} color="#00E654" strokeWidth={2} />
                <View style={{ marginRight: 12 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>תיאור קבוצה</Text>
                  <Text style={{
                    color: '#9CA3AF',
                    fontSize: 12,
                    textAlign: 'right'
                  }} numberOfLines={1}>
                    {group?.description || 'אין תיאור'}
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color="#00E654" strokeWidth={2} />
            </TouchableOpacity>
            
            {/* Group Icon */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <ImageIcon size={24} color="#00E654" strokeWidth={2} />
                <View style={{ marginRight: 12 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>אייקון קבוצה</Text>
                  <Text style={{
                    color: '#9CA3AF',
                    fontSize: 12,
                    textAlign: 'right'
                  }}>שנה את האייקון</Text>
                </View>
              </View>
              <ArrowRight size={20} color="#00E654" strokeWidth={2} />
            </TouchableOpacity>
            
            {/* Group Name */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <Edit3 size={24} color="#00E654" strokeWidth={2} />
                <View style={{ marginRight: 12 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>שם קבוצה</Text>
                  <Text style={{
                    color: '#9CA3AF',
                    fontSize: 12,
                    textAlign: 'right'
                  }} numberOfLines={1}>
                    {group?.name || 'ללא שם'}
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color="#00E654" strokeWidth={2} />
            </TouchableOpacity>
            
            {/* Clear Chat History */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <Trash2 size={24} color="#ff4444" strokeWidth={2} />
                <View style={{ marginRight: 12 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>נקה היסטוריה</Text>
                  <Text style={{
                    color: '#9CA3AF',
                    fontSize: 12,
                    textAlign: 'right'
                  }}>מחק את כל ההודעות</Text>
                </View>
              </View>
              <ArrowRight size={20} color="#ff4444" strokeWidth={2} />
            </TouchableOpacity>
            
            {/* Group Privacy */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <Lock size={24} color="#00E654" strokeWidth={2} />
                <View style={{ marginRight: 12 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>הגדרות פרטיות</Text>
                  <Text style={{
                    color: '#9CA3AF',
                    fontSize: 12,
                    textAlign: 'right'
                  }}>
                    {group?.is_private ? 'קבוצה פרטית' : 'קבוצה ציבורית'}
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color="#00E654" strokeWidth={2} />
            </TouchableOpacity>
            
            {/* More Admin Options */}
            <TouchableOpacity style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center'
              }}>
                <MoreVertical size={24} color="#00E654" strokeWidth={2} />
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  marginRight: 12,
                  textAlign: 'right'
                }}>אפשרויות נוספות</Text>
              </View>
              <ArrowRight size={20} color="#00E654" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* Members Section */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 20,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4
        }}>
          <TouchableOpacity 
            onPress={() => setShowAll(!showAll)}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center'
            }}>
              <View style={{
                backgroundColor: '#00E654',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
                marginRight: 8
              }}>
                <Text style={{
                  color: '#000000',
                  fontWeight: '700',
                  fontSize: 12
                }}>{members.length}</Text>
              </View>
              <Text style={{
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: 16,
                marginRight: 12
              }}>חברים</Text>
              <Users size={24} color="#00E654" strokeWidth={2} />
            </View>
          </TouchableOpacity>
          
        {loading ? (
          <View style={{
            alignItems: 'center',
            paddingVertical: 32
          }}>
            <Text style={{
              color: '#B0B0B0',
              fontSize: 16
            }}>טוען חברים...</Text>
          </View>
        ) : members.length === 0 ? (
            <View style={{
              alignItems: 'center',
              paddingVertical: 32
            }}>
            <Text style={{
              color: '#B0B0B0',
              textAlign: 'center',
              marginBottom: 16,
              fontSize: 16
            }}>אין חברים נוספים בקבוצה זו</Text>
            <Text style={{
              color: '#808080',
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
                  backgroundColor: '#4B5563',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginRight: 8
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: 14
                }}>רענן</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleShareGroup} 
                style={{
                  backgroundColor: '#00E654',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12
                }}
              >
                <Text style={{
                  color: '#000000',
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
                    marginBottom: 12,
                    padding: 12,
                    backgroundColor: '#181818',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(0,230,84,0.1)'
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
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            marginRight: 12
                          }}
                          onError={(error) => console.log('❌ Image load error:', error)}
                        />
                      ) : (
                        <View style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#00E654',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12
                        }}>
                          <User size={20} color="#FFFFFF" strokeWidth={2} />
                        </View>
                      )}
                      
                      <View style={{ flex: 1 }}>
                        <View style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          marginBottom: 4
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontWeight: '700',
                            fontSize: 14,
                            marginRight: 8,
                            textAlign: 'right'
                          }} numberOfLines={1}>
                            {memberName}
                          </Text>
                          
                          {item.role === 'admin' && (
                            <View style={{
                              backgroundColor: '#00E654',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              marginLeft: 8
                            }}>
                              <Text style={{
                                color: '#000000',
                                fontWeight: '700',
                                fontSize: 10
                              }}>מנהל</Text>
                            </View>
                          )}
                          
                          {item.user_id === user?.id && (
                            <View style={{
                              backgroundColor: '#4B5563',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              marginLeft: 8
                            }}>
                              <Text style={{
                                color: '#00E654',
                                fontWeight: '700',
                                fontSize: 10
                              }}>אתה</Text>
                            </View>
                          )}
                        </View>
                        
                        {memberPhone && (
                          <Text style={{
                            color: '#B0B0B0',
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
                              backgroundColor: '#00E654',
                              padding: 8,
                              borderRadius: 12,
                              marginLeft: 8
                            }}
                          >
                            <Star size={14} color="#000000" strokeWidth={2} />
                          </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                          onPress={() => handleRemoveMember(item.user_id, memberName)}
                          style={{
                            backgroundColor: '#DC2626',
                            padding: 8,
                            borderRadius: 12
                          }}
                        >
                          <UserMinus size={14} color="#FFFFFF" strokeWidth={2} />
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
                        marginBottom: 12,
                        padding: 12,
                        backgroundColor: '#181818',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(0,230,84,0.1)'
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
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12
                              }}
                              onError={(error) => console.log('❌ Image load error:', error)}
                            />
                          ) : (
                            <View style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#00E654',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12
                            }}>
                              <User size={20} color="#FFFFFF" strokeWidth={2} />
                            </View>
                          )}
                          
                          <View style={{ flex: 1 }}>
                            <View style={{
                              flexDirection: 'row-reverse',
                              alignItems: 'center',
                              marginBottom: 4
                            }}>
                              <Text style={{
                                color: '#FFFFFF',
                                fontWeight: '700',
                                fontSize: 14,
                                marginRight: 8,
                                textAlign: 'right'
                              }} numberOfLines={1}>
                                {memberName}
                              </Text>
                              
                              {item.role === 'admin' && (
                                <View style={{
                                  backgroundColor: '#00E654',
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  marginLeft: 8
                                }}>
                                  <Text style={{
                                    color: '#000000',
                                    fontWeight: '700',
                                    fontSize: 10
                                  }}>מנהל</Text>
                                </View>
                              )}
                              
                              {item.user_id === user?.id && (
                                <View style={{
                                  backgroundColor: '#4B5563',
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  marginLeft: 8
                                }}>
                                  <Text style={{
                                    color: '#00E654',
                                    fontWeight: '700',
                                    fontSize: 10
                                  }}>אתה</Text>
                                </View>
                              )}
                            </View>
                            
                            {memberPhone && (
                              <Text style={{
                                color: '#B0B0B0',
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
                                  backgroundColor: '#00E654',
                                  padding: 8,
                                  borderRadius: 12,
                                  marginLeft: 8
                                }}
                              >
                                <Star size={14} color="#000000" strokeWidth={2} />
                </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity 
                              onPress={() => handleRemoveMember(item.user_id, memberName)}
                              style={{
                                backgroundColor: '#DC2626',
                                padding: 8,
                                borderRadius: 12
                              }}
                            >
                              <UserMinus size={14} color="#FFFFFF" strokeWidth={2} />
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
                marginTop: 12,
                backgroundColor: '#181818',
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(0,230,84,0.2)'
              }}
            >
              <Text style={{
                color: '#00E654',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: 14
              }}>
                    {showAll ? `הצג פחות` : `הצג את כל ${members.length} החברים`}
              </Text>
            </TouchableOpacity>
              )}
          </View>
        )}
        </View>

        {/* Exit Group Button */}
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 20,
          backgroundColor: 'transparent'
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
              backgroundColor: '#FF4444',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#FF4444',
              alignItems: 'center',
              alignSelf: 'center',
              minWidth: 300
            }}
          >
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center'
            }}>
             
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                צא מהקבוצה
              </Text>
            </View>
            </TouchableOpacity>
          </View>

      </ScrollView>
    </View>
  );
} 