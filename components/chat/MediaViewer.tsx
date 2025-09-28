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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Message } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import ForwardModal from './ForwardModal';

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
  
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  // אנימציה כניסה וניקוי state
  useEffect(() => {
    console.log('🎯 MediaViewer visible changed to:', visible);
    if (visible) {
      console.log('🎯 MediaViewer opening - resetting states');
      setShowActions(false);
      
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
      
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
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
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'black' }}>
          <AlertCircle size={64} color="white" strokeWidth={1.5} />
          <Text className="text-white text-lg mt-4 text-center">
            לא ניתן לטעון את המדיה
          </Text>
        </View>
      );
    }

    switch (mediaType) {
      case 'image':
        return (
          <View 
            style={{ 
              flex: 1,
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: 'black',
            }}
          >
            <Image
              source={{ uri: mediaUrl }}
              style={{
                width: screenWidth,
                height: screenHeight * 0.8,
              }}
              resizeMode="contain"
              onLoad={() => {
                console.log('✅ Image loaded successfully:', mediaUrl);
              }}
              onError={(error) => {
                console.error('❌ Image load error:', error);
                console.error('❌ Failed URL:', mediaUrl);
              }}
            />
          </View>
        );

      case 'video':
        return (
          <View className="flex-1 justify-center items-center" style={{ 
            backgroundColor: 'black', 
            paddingTop: 80,
            paddingBottom: 120 
          }}>
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
                <Text className="text-white text-lg mt-4 text-center">
                  לא ניתן לטעון את הווידאו
                </Text>
              </View>
            )}
          </View>
        );

      case 'audio':
        return (
          <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'black' }}>
            <View className="w-40 h-40 bg-green-500 rounded-full items-center justify-center mb-8">
              <Music size={64} color="white" strokeWidth={1.5} />
            </View>
            <Text className="text-white text-xl mb-4">קובץ אודיו</Text>
          </View>
        );

      default:
        return (
          <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'black' }}>
            <FileText size={64} color="white" strokeWidth={1.5} />
            <Text className="text-white text-lg mt-4">מסמך</Text>
          </View>
        );
    }
  };

  const renderActionBar = () => {
    return (
      <View 
        className="absolute bottom-0 left-0 right-0"
        style={{ 
          backgroundColor: '#181818', // אפור של האפליקציה
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
          paddingBottom: 30, // מרווח פנימי מהתחתית
        }}
      >
        {/* סרגל פעולות קבוע כמו WhatsApp */}
        <View className="flex-row justify-around items-center py-6 px-8">
          <Pressable
            onPress={() => {
              console.log('💬 Reply button pressed!');
              onReply && onReply();
            }}
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <MessageCircle size={24} color="white" strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={handleForward}
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Forward size={24} color="white" strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={shareMedia}
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <ShareIcon size={24} color="white" strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={() => {
              console.log('⭐ Star button pressed!');
              toggleStar();
            }}
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Ionicons 
              name={isStarred ? "star" : "star-outline"} 
              size={24} 
              color={isStarred ? "#FFD700" : "white"} 
            />
          </Pressable>

          <Pressable
            onPress={downloadFile}
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Download size={24} color="white" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      style={{ zIndex: 9999 }}
    >
      <Animated.View 
        className="flex-1 bg-black"
        style={{ 
          opacity: fadeAnim
        }}
      >
        {/* Header */}
        <View 
          className="flex-row justify-between items-center px-4 py-4"
          style={{
            backgroundColor: '#181818', // אפור של האפליקציה
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.1)',
            paddingTop: insets.top + 16
          }}
        >
          <View className="w-12" />
          
          <View className="flex-1 items-center">
            <>
              <Text 
                className="text-white font-semibold text-lg"
            style={{ 
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {message?.sender?.full_name || 'שם לא ידוע'}
              </Text>
              <Text 
                className="text-gray-300 text-sm mt-1"
                style={{
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {formatMessageTime(message?.created_at || new Date().toISOString())}
              </Text>
            </>
          </View>
          
          <Pressable 
            onPress={onClose} 
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ 
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <X size={22} color="white" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Media Content */}
        <View className="flex-1 justify-center items-center bg-black">
          <Animated.View 
            style={{ 
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
        >
          {renderMediaContent()}
          </Animated.View>
        </View>

        {/* Caption */}
        {caption && (
          <View 
            className="absolute left-4 right-4 px-4 py-3 rounded-2xl"
            style={{
              backgroundColor: 'rgba(0,0,0,0.7)',
              bottom: 140, // הזזה למעלה כדי שלא יגלוש על Action Bar
            }}
          >
            <Text 
              className="text-center text-base leading-5"
              style={{ 
                color: 'white',
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
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
      </Animated.View>
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