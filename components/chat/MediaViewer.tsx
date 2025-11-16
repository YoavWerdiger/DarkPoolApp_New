import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  Image, 
  Dimensions,
  ScrollView,
  Alert,
  Animated,
  Share as RNShare
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AlertCircle, Video as VideoIcon, Music, FileText, MessageCircle, Forward, Share as ShareIcon, Download, X } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Message } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import ForwardModal from './ForwardModal';
import { useDesignTokens } from '../ui/DesignTokens';

interface MediaViewerProps {
  visible: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  message?: Message;
  onReply?: () => void;
  onForward?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MediaViewer({ 
  visible, 
  onClose, 
  mediaUrl, 
  mediaType, 
  caption,
  message,
  onReply,
  onForward
}: MediaViewerProps) {
  console.log('🎯 MediaViewer: Rendering with:', { visible, mediaUrl, mediaType });
  
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageScale = useRef(new Animated.Value(1)).current;

  // לוג כשה-visible משתנה
  useEffect(() => {
    console.log('🎯 MediaViewer visible changed to:', visible);
  }, [visible]);

  // בדיקת מצב כוכב ראשוני
  useEffect(() => {
    const checkStarredStatus = async () => {
      if (visible && message?.id && user?.id) {
        try {
          console.log('🔍 Checking if message is starred:', message.id);
          const ChatService = await import('../../services/chatService');
          const isMessageStarred = await ChatService.ChatService.isMessageStarred(
            message.id,
            user.id
          );
          console.log('🔍 Message starred status:', isMessageStarred);
          setIsStarred(isMessageStarred);
        } catch (error) {
          console.error('❌ Error checking starred status:', error);
          setIsStarred(false);
        }
      }
    };
    
    checkStarredStatus();
  }, [visible, message?.id, user?.id]);

  // פונקציה להחזרת מיקום למרכז עם אנימציה חלקה
  const resetImagePosition = () => {
    // נקה timeout קודם אם קיים
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    
    zoomTimeoutRef.current = setTimeout(() => {
      // החזר את ה-ScrollView למרכז עם אנימציה
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
      
      // החזר את גודל התמונה למקור עם אנימציה חלקה וטבעית
      Animated.spring(imageScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
        velocity: 0,
      }).start();
    }, 100);
  };

  // אנימציה כניסה וניקוי state
  useEffect(() => {
    console.log('🎯 MediaViewer visible changed to:', visible);
    if (visible) {
      console.log('🎯 MediaViewer opening - resetting states');
      setShowActions(false);
      imageScale.setValue(1);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      setShowActions(false);
      setIsStarred(false);
      setIsPlaying(false);
      
      if (audioRef.current) {
        audioRef.current.unloadAsync();
        audioRef.current = null;
      }
      
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      imageScale.setValue(1);
    }
  }, [visible]);

  const downloadFile = async () => {
    try {
      console.log('📥 Download button pressed - mediaUrl:', mediaUrl);
      
      if (!mediaUrl || mediaUrl.trim() === '') {
        console.log('❌ Invalid mediaUrl:', mediaUrl);
        Alert.alert('שגיאה', 'URL לא תקין');
        return;
      }

      // בדוק אם זה קובץ מקומי או URL מהאינטרנט
      if (mediaUrl.startsWith('file://')) {
        console.log('📥 Local file detected - sharing directly');
        // זה קובץ מקומי, נשתף אותו ישירות
        if (await Sharing.isAvailableAsync()) {
          console.log('📥 Sharing local file:', mediaUrl);
          await Sharing.shareAsync(mediaUrl);
      } else {
          Alert.alert('שיתוף', 'הקובץ קיים במכשיר');
        }
        return;
      }

      // אם זה URL מהאינטרנט, נוריד אותו
      const fileExtension = mediaType === 'image' ? 'jpg' : 
                           mediaType === 'video' ? 'mp4' : 
                           mediaType === 'audio' ? 'mp3' : 'file';
      
      const fileName = `media_${Date.now()}.${fileExtension}`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      console.log('📥 Starting download from URL:', { mediaUrl, fileUri });
      
      const downloadResult = await FileSystem.downloadAsync(mediaUrl, fileUri);
      
      console.log('📥 Download result:', downloadResult);
      
      if (downloadResult && downloadResult.uri) {
        if (await Sharing.isAvailableAsync()) {
          console.log('📥 Sharing downloaded file:', downloadResult.uri);
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('הורדה הושלמה', 'הקובץ נשמר במכשיר');
        }
      } else {
        console.log('❌ Download failed - no URI returned');
        Alert.alert('שגיאה', 'לא ניתן להוריד את הקובץ');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('שגיאה', 'לא ניתן להוריד את הקובץ: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const shareMedia = async () => {
    try {
      console.log('📤 Share button pressed - mediaUrl:', mediaUrl);
      
      if (!mediaUrl || mediaUrl.trim() === '') {
        console.log('❌ Invalid mediaUrl for sharing:', mediaUrl);
        Alert.alert('שגיאה', 'URL לא תקין');
        return;
      }

      // אם זה קובץ מקומי, נשתמש ב-Sharing במקום Share
      if (mediaUrl.startsWith('file://')) {
        console.log('📤 Local file detected - using Sharing.shareAsync');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(mediaUrl);
        } else {
          Alert.alert('שיתוף', 'הקובץ קיים במכשיר');
        }
        return;
      }

      // אם זה URL מהאינטרנט, נשתמש ב-Share
      if (RNShare.share) {
        console.log('📤 Sharing URL:', mediaUrl);
        await RNShare.share({
          url: mediaUrl,
          message: caption || `מדיה מ-${message?.sender?.full_name || 'משתמש'}`,
        });
      } else {
        Alert.alert('שיתוף', 'הקישור הועתק ללוח');
      }
    } catch (error) {
      console.error('Error sharing media:', error);
      Alert.alert('שיתוף', 'שגיאה בשיתוף: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Star/Favorite functionality
  const handleStarMessage = async () => {
    try {
      if (!user?.id) return;
      
      console.log('⭐ MediaViewer: Attempting to star message:', {
        messageId: message?.id,
        userId: user.id
      });
      
      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.starMessage(
        message?.id || '',
        user.id
      );
      
      console.log('⭐ MediaViewer: Star message result:', success);
      
      if (success) {
        setIsStarred(true);
        Alert.alert('הצלחה', 'ההודעה סומנה בכוכב');
      } else {
        console.log('⭐ Star failed, checking current status...');
        const currentStatus = await ChatService.ChatService.isMessageStarred(
          message?.id || '',
          user.id
        );
        setIsStarred(currentStatus);
        
        if (currentStatus) {
          Alert.alert('מידע', 'ההודעה כבר מסומנת בכוכב');
        } else {
          Alert.alert('שגיאה', 'לא ניתן לסמן את ההודעה בכוכב');
        }
      }
    } catch (error) {
      console.error('❌ Error starring message:', error);
      Alert.alert('שגיאה', 'שגיאה בסימון ההודעה בכוכב');
    }
  };

  const handleUnstarMessage = async () => {
    try {
      if (!user?.id) return;
      
      console.log('⭐ MediaViewer: Attempting to unstar message:', {
        messageId: message?.id,
        userId: user.id
      });
      
      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.unstarMessage(
        message?.id || '',
        user.id
      );
      
      console.log('⭐ MediaViewer: Unstar message result:', success);
      
      if (success) {
        setIsStarred(false);
        Alert.alert('הצלחה', 'הכוכב הוסר מההודעה');
      } else {
        Alert.alert('שגיאה', 'לא ניתן להסיר את הכוכב');
      }
    } catch (error) {
      console.error('❌ Error unstarring message:', error);
      Alert.alert('שגיאה', 'שגיאה בהסרת הכוכב');
    }
  };

  const toggleStar = async () => {
    console.log('⭐ Toggle star called - current state:', isStarred);
    if (isStarred) {
      await handleUnstarMessage();
    } else {
      await handleStarMessage();
    }
  };

  // Forward functionality - פתח ForwardModal בתוך MediaViewer
  const handleForward = () => {
    console.log('📤 Forward button pressed in MediaViewer!');
    console.log('📤 Opening internal ForwardModal');
    setShowForwardModal(true);
  };

  const renderMediaContent = () => {
    console.log('🎯 MediaViewer renderMediaContent - mediaUrl:', mediaUrl, 'mediaType:', mediaType);
    
    if (!mediaUrl || mediaUrl.trim() === '') {
      console.log('❌ MediaViewer: No mediaUrl provided');
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AlertCircle size={64} color="white" strokeWidth={1.5} />
          <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
            לא ניתן לטעון את המדיה
          </Text>
        </View>
      );
    }

    switch (mediaType) {
      case 'image':
        return (
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              minHeight: screenHeight,
              minWidth: screenWidth,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            maximumZoomScale={3}
            minimumZoomScale={1}
            bouncesZoom={true}
            centerContent={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              // נקה טיימרים קודמים כשמתחילים גלילה חדשה
              if (zoomTimeoutRef.current) {
                clearTimeout(zoomTimeoutRef.current);
                zoomTimeoutRef.current = null;
              }
            }}
            onScrollEndDrag={() => {
              resetImagePosition();
            }}
            onMomentumScrollEnd={() => {
              resetImagePosition();
            }}
          >
            <Animated.Image
              source={{ uri: mediaUrl }}
              style={{
                width: screenWidth * 1.15,
                height: screenHeight * 1.05,
                transform: [{ scale: imageScale }],
              }}
              resizeMode="cover"
              onLoad={() => {
                console.log('✅ Image loaded successfully:', mediaUrl);
              }}
              onError={(error) => {
                console.error('❌ Image load error:', error);
                console.error('❌ Failed URL:', mediaUrl);
              }}
            />
          </ScrollView>
        );

      case 'video':
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {mediaUrl && mediaUrl.trim() !== '' && (mediaUrl.startsWith('http') || mediaUrl.startsWith('file://') || mediaUrl.startsWith('content://')) ? (
            <Video
              source={{ uri: mediaUrl }}
              style={{
                width: screenWidth,
                height: screenHeight * 0.8,
              }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              onLoadStart={() => {
                console.log('Video loading started:', mediaUrl);
              }}
              onLoad={(status) => {
                console.log('Video loaded successfully:', status);
              }}
              onError={(error) => {
                console.error('Video load error:', error);
                console.error('Video URL:', mediaUrl);
              }}
              onPlaybackStatusUpdate={(status) => {
                if ('error' in status && status.error) {
                  console.error('Video playback error:', status.error);
                }
              }}
              />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <VideoIcon size={64} color="white" strokeWidth={1.5} />
                <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                  לא ניתן לטעון את הווידאו
                </Text>
              </View>
            )}
          </View>
        );

      case 'audio':
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ 
              width: 160, 
              height: 160, 
              backgroundColor: DesignTokens.colors.success.main, 
              borderRadius: 80, 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: 32 
            }}>
              <Music size={64} color={DesignTokens.colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 20, marginBottom: 16 }}>קובץ אודיו</Text>
          </View>
        );

      default:
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <FileText size={64} color="white" strokeWidth={1.5} />
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 18, marginTop: 16 }}>מסמך</Text>
          </View>
        );
    }
  };

  const renderActionBar = () => {
    return (
      <View 
        style={{ 
          backgroundColor: DesignTokens.colors.background.secondary,
          paddingBottom: insets.bottom + 16
        }}
      >
        {/* סרגל פעולות */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-around', 
          alignItems: 'center', 
          paddingVertical: 16,
          paddingHorizontal: 32
        }}>
          <Pressable
            onPress={() => {
              console.log('💬 Reply button pressed!');
              onReply && onReply();
            }}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12
            }}
          >
            <MessageCircle size={26} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={handleForward}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12
            }}
          >
            <Forward size={26} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={shareMedia}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12
            }}
          >
            <ShareIcon size={26} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={() => {
              console.log('⭐ Star button pressed!');
              toggleStar();
            }}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12
            }}
          >
            <Ionicons 
              name={isStarred ? "star" : "star-outline"} 
              size={26} 
              color={isStarred ? DesignTokens.colors.warning.main : DesignTokens.colors.text.primary} 
            />
          </Pressable>

          <Pressable
            onPress={downloadFile}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12
            }}
          >
            <Download size={26} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View 
        style={{ 
          flex: 1,
          backgroundColor: DesignTokens.colors.background.primary
        }}
      >
        {/* Header */}
        <View 
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: DesignTokens.colors.background.secondary,
            paddingTop: insets.top + 12
          }}
        >
          <View style={{ width: 48 }} />
          
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text 
              style={{ 
                color: DesignTokens.colors.text.primary,
                fontWeight: '700',
                fontSize: 18
              }}
            >
              {message?.sender?.full_name || 'שם לא ידוע'}
            </Text>
            <Text 
              style={{
                color: DesignTokens.colors.text.tertiary,
                fontSize: 14,
                marginTop: 4
              }}
            >
              {formatMessageTime(message?.created_at || new Date().toISOString())}
            </Text>
          </View>
          
          <Pressable 
            onPress={onClose} 
            style={{ 
              padding: 8
            }}
          >
            <X size={24} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Media Content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
          {renderMediaContent()}
        </View>

        {/* Caption */}
        {caption && (
          <View 
            style={{
              marginHorizontal: 20,
              marginBottom: 16
            }}
          >
            <Text 
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'center',
                fontSize: 15,
                lineHeight: 20,
                fontWeight: '500',
                textShadowColor: DesignTokens.colors.overlay,
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4
              }}
            >
              {caption}
            </Text>
          </View>
        )}

        {/* Action Bar */}
        {renderActionBar()}

        {/* Forward Modal - בתוך MediaViewer */}
        <ForwardModal
          visible={showForwardModal}
          onClose={() => {
            console.log('📤 Internal ForwardModal onClose called');
            setShowForwardModal(false);
          }}
          messageId={message?.id || ''}
          onForward={async (channelId, channelName) => {
            console.log('🚀 Internal onForward called:', { channelId, channelName, userId: user?.id });
            try {
              if (!user?.id) {
                Alert.alert('שגיאה', 'משתמש לא מחובר');
                return;
              }

              console.log('📤 Sending message to channel:', channelId);
              const ChatService = await import('../../services/chatService');
              
              // אם זה מדיה, נעביר את ה-mediaUrl
              let content = message?.content || 'מדיה מועברת';
              if (mediaUrl) {
                content = mediaType === 'image' ? '[תמונה]' : 
                         mediaType === 'video' ? '[וידאו]' : 
                         mediaType === 'audio' ? '[אודיו]' : '[מסמך]';
                content += `\n${mediaUrl}`;
                if (caption) {
                  content += `\n${caption}`;
                }
              }

              const result = await ChatService.ChatService.sendMessage({
                channelId: channelId,
                content: content,
                senderId: user.id,
                type: 'channel'
              });

              console.log('✅ Media forwarded successfully:', { channelName, result });
              setShowForwardModal(false); // סגור את ForwardModal אחרי הצלחה
            } catch (error) {
              console.error('❌ Error forwarding media:', error);
              Alert.alert('שגיאה', 'לא ניתן להעביר את המדיה: ' + (error instanceof Error ? error.message : String(error)));
            }
          }}
        />
      </View>
    </Modal>
  );
}

// פונקציה לעיצוב זמן ההודעה
const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    // אותו יום - הצג רק שעה
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (diffInHours < 24 * 7) {
    // שבוע אחרון - הצג יום ושעה
    return date.toLocaleDateString('he-IL', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    // יותר משבוע - הצג תאריך מלא
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
};