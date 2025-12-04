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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, Video as VideoIcon, FileText, File, X, Trash2, ArrowRight } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { MediaMetadata, MediaFile } from '../../services/mediaService';
import { useDesignTokens } from '../ui/DesignTokens';

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
  console.log('📱 MediaPreviewModal: Rendering with:', { 
    visible, 
    mediaFilesCount: mediaFiles.length,
    mediaFiles: mediaFiles.map(f => ({ id: f.id, type: f.type, uri: f.uri?.substring(0, 50) }))
  });
  
  const DesignTokens = useDesignTokens();
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
    console.log('📱 MediaPreviewModal: visible changed to:', visible);
    if (visible) {
      console.log('📱 MediaPreviewModal: Starting fade-in animation');
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

  if (!visible || !currentMedia) {
    console.log('📱 MediaPreviewModal: NOT rendering - visible:', visible, 'currentMedia:', currentMedia);
    return null;
  }
  
  console.log('📱 MediaPreviewModal: RENDERING with currentMedia:', { id: currentMedia.id, type: currentMedia.type });

  const renderMediaContent = () => {
    switch (currentMedia.type) {
      case 'image':
        return (
          <ScrollView 
            contentContainerStyle={{ 
              flexGrow: 1, 
              justifyContent: 'center', 
              alignItems: 'center'
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
                  width: screenWidth,
                  height: '100%'
                }}
                resizeMode="contain"
                onError={(error) => {
                  console.error('Image load error in MediaPreviewModal:', error);
                }}
              />
            ) : (
              <View style={{
                width: screenWidth,
                height: screenHeight * 0.6,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: DesignTokens.colors.background.primary
              }}>
                <ImageIcon size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
              </View>
            )}
          </ScrollView>
        );

      case 'video':
        return (
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {currentMedia.uri && currentMedia.uri.trim() !== '' && (currentMedia.uri.startsWith('http') || currentMedia.uri.startsWith('file://') || currentMedia.uri.startsWith('content://')) ? (
              <Video
                source={{ uri: currentMedia.uri }}
                style={{
                  width: screenWidth,
                  height: '100%'
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
                width: screenWidth,
                height: screenHeight * 0.6,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: DesignTokens.colors.background.primary
              }}>
                <VideoIcon size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
              </View>
            )}
          </View>
        );

      case 'audio':
        return (
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <View style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: `${DesignTokens.colors.success.main}1F`,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24
            }}>
              <Pressable
                onPress={() => toggleAudio(currentMedia.id)}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: DesignTokens.colors.success.main,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Ionicons
                  name={isPlaying[currentMedia.id] ? 'pause' : 'play'}
                  size={40}
                  color={DesignTokens.colors.text.primary}
                />
              </Pressable>
            </View>
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
              {currentMedia.name || 'הקלטת קול'}
            </Text>
            <Text style={{ color: DesignTokens.colors.text.tertiary, fontSize: 16 }}>
              {currentMedia.duration ? formatDuration(currentMedia.duration) : '0:00'}
            </Text>
          </View>
        );

      case 'document':
        return (
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <View style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: DesignTokens.colors.background.secondary,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24
            }}>
              <FileText size={70} color={DesignTokens.colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
              {currentMedia.name || 'מסמך'}
            </Text>
            {currentMedia.size && (
              <Text style={{ color: DesignTokens.colors.text.tertiary, fontSize: 16 }}>
                {formatFileSize(currentMedia.size)}
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <View style={{
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: DesignTokens.colors.background.secondary,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 32
            }}>
              <File size={80} color={DesignTokens.colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 20, fontWeight: '600' }}>סוג מדיה לא נתמך</Text>
          </View>
        );
    }
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
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: DesignTokens.colors.background.primary,
              paddingTop: insets.top + 12,
              borderBottomWidth: 1,
              borderBottomColor: DesignTokens.colors.border.primary
            }}
          >
            {/* כפתור סגירה - ימין */}
            <Pressable 
              onPress={onClose} 
              style={{ 
                padding: 8,
                marginRight: -8
              }}
            >
              <X size={24} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
            </Pressable>
            
            {/* כותרת ממורכזת */}
            <Text style={{ 
              color: DesignTokens.colors.text.primary, 
              fontSize: 17, 
              fontWeight: '700',
              flex: 1,
              textAlign: 'center'
            }}>
              {mediaFiles.length > 1 ? `${currentIndex + 1} מתוך ${mediaFiles.length}` : 'תצוגה מקדימה'}
            </Text>
            
            {/* רווח מימין לאיזון */}
            <View style={{ width: 40 }} />
          </View>

          {/* Media Content */}
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor: DesignTokens.colors.background.primary
          }}>
            {renderMediaContent()}
          </View>

          {/* Caption Input */}
          <View style={{ 
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: DesignTokens.colors.background.primary,
            borderTopWidth: 1,
            borderTopColor: DesignTokens.colors.border.primary
          }}>
            <TextInput
              placeholder="הוסף כיתוב..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={captions[currentMedia.id] || ''}
              onChangeText={(text) => setCaptions(prev => ({ ...prev, [currentMedia.id]: text }))}
              style={{ 
                color: DesignTokens.colors.text.primary, 
                textAlign: 'right', 
                fontSize: 15,
                backgroundColor: DesignTokens.colors.background.secondary,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                minHeight: 44,
                borderWidth: 1,
                borderColor: DesignTokens.colors.border.primary
              }}
              multiline
              maxLength={200}
            />
          </View>


          {/* Action Buttons */}
          <View style={{ 
            paddingHorizontal: 20,
            paddingVertical: 20,
            paddingBottom: insets.bottom + 20,
            backgroundColor: DesignTokens.colors.background.primary,
            borderTopWidth: 1,
            borderTopColor: DesignTokens.colors.border.primary
          }}>
            {/* כפתור שלח */}
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => ({
                backgroundColor: DesignTokens.colors.success.main,
                paddingVertical: 16,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: mediaFiles.length > 1 ? 12 : 0,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              })}
            >
              <Text style={{ 
                color: '#FFFFFF', 
                fontWeight: '700', 
                fontSize: 17,
                textAlign: 'center'
              }}>
                שלח
              </Text>
            </Pressable>

            {/* כפתור הבא (רק אם יש מספר קבצים) */}
            {mediaFiles.length > 1 && (
              <Pressable
                onPress={() => {
                  const newIndex = (currentIndex + 1) % mediaFiles.length;
                  setCurrentIndex(newIndex);
                }}
                style={({ pressed }) => ({
                  backgroundColor: DesignTokens.colors.background.secondary,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  flexDirection: 'row-reverse',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                })}
              >
                <Text style={{ 
                  color: DesignTokens.colors.text.primary, 
                  fontSize: 16, 
                  fontWeight: '600', 
                  marginLeft: 8 
                }}>
                  הבא
                </Text>
                <ArrowRight size={18} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
  );
}
