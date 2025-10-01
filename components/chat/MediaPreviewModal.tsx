import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  TextInput, 
  ScrollView, 
  Dimensions,
  Image,
  Alert,
  Animated
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, Video as VideoIcon, FileText, File, X, Trash2, ArrowRight } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { MediaMetadata, MediaFile } from '../../services/mediaService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (mediaFiles: MediaFile[], captions: Record<string, string>) => void;
  mediaFiles: MediaFile[];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MediaPreviewModal({ 
  visible, 
  onClose, 
  onSend, 
  mediaFiles 
}: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [audioStatus, setAudioStatus] = useState<Record<string, boolean>>({});
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentMedia = mediaFiles[currentIndex];

  // אנימציה כניסה
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // פורמט גודל קובץ
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // פורמט משך זמן
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // נגינת/עצירת אודיו
  const toggleAudio = async (fileId: string) => {
    try {
      if (isPlaying[fileId]) {
        // עצור אודיו
        if (audioRefs.current[fileId]) {
          await audioRefs.current[fileId].stopAsync();
          await audioRefs.current[fileId].unloadAsync();
        }
        setIsPlaying(prev => ({ ...prev, [fileId]: false }));
      } else {
        // התחל אודיו
        const mediaFile = mediaFiles.find(f => f.id === fileId);
        if (mediaFile && mediaFile.type === 'audio') {
          const { sound } = await Audio.Sound.createAsync({ uri: mediaFile.uri });
          audioRefs.current[fileId] = sound;
          await sound.playAsync();
          setIsPlaying(prev => ({ ...prev, [fileId]: true }));
          
          // עצור אוטומטית בסיום
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) {
              setIsPlaying(prev => ({ ...prev, [fileId]: false }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  // הסרת מדיה
  const removeMedia = (fileId: string) => {
    if (mediaFiles.length === 1) {
      onClose();
      return;
    }
    
    const newMediaFiles = mediaFiles.filter(f => f.id !== fileId);
    const newCaptions = { ...captions };
    delete newCaptions[fileId];
    
    if (currentIndex >= newMediaFiles.length) {
      setCurrentIndex(Math.max(0, newMediaFiles.length - 1));
    }
    
    // עדכן את המערך המקורי
    mediaFiles.splice(mediaFiles.findIndex(f => f.id === fileId), 1);
    setCaptions(newCaptions);
  };

  // שליחה
  const handleSend = () => {
    if (mediaFiles.length === 0) return;
    
    // בדוק שכל הקבצים עדיין קיימים
    const validMediaFiles = mediaFiles.filter(f => f.uri);
    
    if (validMediaFiles.length === 0) {
      Alert.alert('שגיאה', 'אין קבצים לשליחה');
      return;
    }
    
    onSend(validMediaFiles, captions);
    onClose();
  };

  // ניקוי אודיו בעת סגירה
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(sound => {
        sound?.unloadAsync();
      });
    };
  }, []);

  if (!visible || !currentMedia) return null;

  const renderMediaContent = () => {
    switch (currentMedia.type) {
      case 'image':
        return (
          <ScrollView 
            contentContainerStyle={{ 
              flexGrow: 1, 
              justifyContent: 'center', 
              alignItems: 'center',
              paddingTop: 80,
              paddingBottom: 120
            }}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {currentMedia.uri && currentMedia.uri.trim() !== '' ? (
              <Image
                source={{ uri: currentMedia.uri }}
                style={{
                  width: screenWidth * 0.9,
                  height: screenHeight * 0.6,
                  alignSelf: 'center',
                  borderRadius: 12,
                }}
                resizeMode="contain"
                onError={(error) => {
                  console.error('Image load error in MediaPreviewModal:', error);
                }}
              />
            ) : (
              <View style={{
                width: screenWidth * 0.9,
                height: screenHeight * 0.6,
                alignSelf: 'center',
                borderRadius: 12,
                backgroundColor: '#2A2A2A',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <ImageIcon size={64} color="#666" strokeWidth={1.5} />
              </View>
            )}
          </ScrollView>
        );

      case 'video':
        return (
          <View className="flex-1 justify-center items-center" style={{ 
            paddingTop: 80,
            paddingBottom: 120 
          }}>
            {currentMedia.uri && currentMedia.uri.trim() !== '' && (currentMedia.uri.startsWith('http') || currentMedia.uri.startsWith('file://') || currentMedia.uri.startsWith('content://')) ? (
              <Video
                source={{ uri: currentMedia.uri }}
                style={{
                  width: screenWidth * 0.9,
                  height: screenHeight * 0.6,
                borderRadius: 12,
              }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              onLoadStart={() => {
                console.log('Video loading started in MediaPreviewModal:', currentMedia.uri);
              }}
              onLoad={(status) => {
                console.log('Video loaded successfully in MediaPreviewModal:', status);
              }}
              onError={(error) => {
                console.error('Video load error in MediaPreviewModal:', error);
                console.error('Video URL:', currentMedia.uri);
              }}
              onPlaybackStatusUpdate={(status) => {
                if ('error' in status && status.error) {
                  console.error('Video playback error in MediaPreviewModal:', status.error);
                }
              }}
            />
          ) : (
            <View style={{
              width: screenWidth * 0.9,
              height: screenHeight * 0.6,
              borderRadius: 12,
              backgroundColor: '#2A2A2A',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <VideoIcon size={64} color="#666" strokeWidth={1.5} />
            </View>
          )}
          </View>
        );

      case 'audio':
        return (
          <View className="flex-1 justify-center items-center" style={{ 
            paddingTop: 80,
            paddingBottom: 120 
          }}>
            <View className="w-40 h-40 bg-gradient-to-br from-primary to-[#00ff88] rounded-full items-center justify-center mb-8 shadow-lg">
              <Pressable
                onPress={() => toggleAudio(currentMedia.id)}
                className="w-24 h-24 bg-white rounded-full items-center justify-center shadow-lg"
              >
                <Ionicons
                  name={isPlaying[currentMedia.id] ? 'pause' : 'play'}
                  size={48}
                  color="#000"
                />
              </Pressable>
            </View>
            <Text className="text-white text-xl mb-2 font-bold">
              {currentMedia.name || 'הקלטת קול'}
            </Text>
            <Text className="text-gray-400 text-lg">
              {currentMedia.duration ? formatDuration(currentMedia.duration) : '0:00'}
            </Text>
            {currentMedia.size && (
              <Text className="text-gray-500 text-sm mt-2">
                {formatFileSize(currentMedia.size)}
              </Text>
            )}
          </View>
        );

      case 'document':
        return (
          <View className="flex-1 justify-center items-center" style={{ 
            paddingTop: 80,
            paddingBottom: 120 
          }}>
            <View className="w-40 h-40 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full items-center justify-center mb-8 shadow-lg">
              <FileText size={80} color="white" strokeWidth={1.5} />
            </View>
            <Text className="text-white text-xl mb-2 font-bold text-center">
              {currentMedia.name || 'מסמך'}
            </Text>
            {currentMedia.size && (
              <Text className="text-gray-400 text-lg">
                {formatFileSize(currentMedia.size)}
              </Text>
            )}
            <Text className="text-gray-500 text-sm mt-2 text-center">
              {currentMedia.type === 'document' ? 'PDF או מסמך אחר' : currentMedia.type}
            </Text>
          </View>
        );

      default:
        return (
          <View className="flex-1 justify-center items-center" style={{ 
            paddingTop: 80,
            paddingBottom: 120 
          }}>
            <View className="w-40 h-40 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full items-center justify-center mb-8">
              <File size={80} color="white" strokeWidth={1.5} />
            </View>
            <Text className="text-white text-xl">סוג מדיה לא נתמך</Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Animated.View 
        className="flex-1 bg-black"
        style={{ opacity: fadeAnim }}
      >
          {/* Header */}
          <View 
            className="flex-row justify-between items-center px-4 py-4"
            style={{
              backgroundColor: '#181818',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.1)',
              paddingTop: insets.top + 16
            }}
          >
            <Pressable 
              onPress={onClose} 
              className="w-11 h-11 bg-white/15 border border-white/25 rounded-full items-center justify-center"
              style={{ shadowColor: '#fff', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
            >
              <X size={22} color="white" strokeWidth={2} />
            </Pressable>
            
            <View className="items-center">
              <Text className="text-white text-lg font-bold mb-1">
                {mediaFiles.length > 1 ? `${currentIndex + 1} מתוך ${mediaFiles.length}` : 'תצוגה מקדימה'}
              </Text>
              <Text className="text-gray-300 text-sm font-medium">
                {currentMedia.type === 'image' ? 'תמונה' : 
                 currentMedia.type === 'video' ? 'וידאו' : 
                 currentMedia.type === 'audio' ? 'הקלטה' : 'מסמך'}
              </Text>
            </View>
            
            <Pressable 
              onPress={handleSend} 
              className="bg-primary px-6 py-3 rounded-full shadow-lg"
              style={{ shadowColor: '#00E654', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
            >
              <Text className="text-black font-bold text-base">שלח</Text>
            </Pressable>
          </View>

          {/* Media Content */}
          <View className="flex-1 justify-center items-center bg-black">
            {renderMediaContent()}
          </View>

          {/* Caption Input - מעוצב כמו וואצפ */}
          <View className="p-4 bg-gradient-to-t from-black/90 to-black/70">
            <View className="bg-white/10 rounded-2xl p-3 border border-white/20">
              <TextInput
                placeholder="הוסף כיתוב (אופציונלי)..."
                placeholderTextColor="#999"
                value={captions[currentMedia.id] || ''}
                onChangeText={(text) => setCaptions(prev => ({ ...prev, [currentMedia.id]: text }))}
                className="text-white text-right text-base"
                multiline
                maxLength={500}
                style={{ minHeight: 40 }}
              />
              <Text className="text-gray-400 text-xs text-left mt-1">
                {captions[currentMedia.id]?.length || 0}/500
              </Text>
            </View>
          </View>

          {/* Navigation Dots - מעוצב כמו וואצפ */}
          {mediaFiles.length > 1 && (
            <View className="flex-row justify-center items-center p-4 bg-black/80">
              {mediaFiles.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => setCurrentIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full mx-1 transition-all duration-200 ${
                    index === currentIndex ? 'bg-primary w-8' : 'bg-white/40'
                  }`}
                />
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row justify-around p-4 bg-gradient-to-t from-black/95 via-black/80 to-black/60">
            <Pressable
              onPress={() => removeMedia(currentMedia.id)}
              className="bg-red-500/20 border border-red-500/50 px-6 py-3 rounded-2xl items-center min-w-[80px]"
              style={{ shadowColor: '#ef4444', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
            >
              <Trash2 size={20} color="#ef4444" strokeWidth={2} />
              <Text className="text-red-400 text-sm font-semibold mt-1.5">הסר</Text>
            </Pressable>

            {mediaFiles.length > 1 && (
              <Pressable
                onPress={() => {
                  const newIndex = (currentIndex + 1) % mediaFiles.length;
                  setCurrentIndex(newIndex);
                }}
                className="bg-white/15 border border-white/25 px-6 py-3 rounded-2xl items-center min-w-[80px]"
                style={{ shadowColor: '#fff', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
              >
                <ArrowRight size={20} color="white" strokeWidth={2} />
                <Text className="text-white text-sm font-semibold mt-1.5">הבא</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Modal>
  );
}
