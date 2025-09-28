import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, Play, FileText, Download } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { MediaViewer } from './MediaViewer';

interface MediaBubbleProps {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  metadata?: {
    file_name?: string;
    file_size?: number;
    duration?: number;
    width?: number;
    height?: number;
  };
  isMe: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const maxImageWidth = screenWidth * 0.6;
const maxImageHeight = 300;

export default function MediaBubble({ 
  mediaUrl, 
  mediaType, 
  caption, 
  metadata, 
  isMe 
}: MediaBubbleProps) {
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [audioStatus, setAudioStatus] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);

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
  const toggleAudio = async () => {
    try {
      if (audioStatus) {
        // עצור אודיו
        if (audioRef.current) {
          await audioRef.current.stopAsync();
          await audioRef.current.unloadAsync();
        }
        setAudioStatus(false);
      } else {
        // התחל אודיו
        const { sound } = await Audio.Sound.createAsync({ uri: mediaUrl });
        audioRef.current = sound;
        await sound.playAsync();
        setAudioStatus(true);
        
        // עצור אוטומטית בסיום
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setAudioStatus(false);
          }
        });
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  // פתיחת MediaViewer
  const openMediaViewer = () => {
    setShowMediaViewer(true);
  };

  // ניקוי אודיו בעת סגירה
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.unloadAsync();
      }
    };
  }, []);

  const [thumbUri, setThumbUri] = useState<string | null>(null);

  useEffect(() => {
    const gen = async () => {
      if (mediaType !== 'video') return;
      try {
        // dynamic import to avoid bundler error if package not installed yet
        const mod: any = await import('expo-video-thumbnails');
        if (mod && typeof mod.getThumbnailAsync === 'function') {
          const { uri } = await mod.getThumbnailAsync(mediaUrl, { time: 1000 });
          setThumbUri(uri);
        }
      } catch (e) {
        // fallback: no thumbnail available
      }
    };
    gen();
  }, [mediaUrl, mediaType]);

  const renderMediaContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <Pressable onPress={openMediaViewer}>
            {mediaUrl ? (
              <Image
                source={{ uri: mediaUrl }}
                style={{
                  width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                  height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                  borderRadius: 12,
                }}
                resizeMode="cover"
                onError={(error) => {
                  console.error('Image load error in MediaBubble:', error);
                }}
              />
            ) : (
              <View style={{
                width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                borderRadius: 12,
                backgroundColor: '#2A2A2A',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <ImageIcon size={32} color="#666" strokeWidth={1.5} />
              </View>
            )}
          </Pressable>
        );

      case 'video':
        return (
          <Pressable onPress={openMediaViewer}>
            <View className="relative">
              {thumbUri && thumbUri.trim() !== '' ? (
                <Image
                  source={{ uri: thumbUri }}
                  style={{
                    width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                    height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                    borderRadius: 12,
                  }}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('Video thumbnail load error in MediaBubble:', error);
                  }}
                />
              ) : (
                <View style={{
                  width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                  height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                  borderRadius: 12,
                  backgroundColor: '#111'
                }} />
              )}
              <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-xl">
                <View className="w-16 h-16 bg-white/90 rounded-full items-center justify-center">
                  <Play size={32} color="#000" strokeWidth={2} />
                </View>
              </View>
            </View>
          </Pressable>
        );

      case 'audio':
        return (
          <View className="flex-row items-center bg-gray-800 rounded-xl p-3 min-w-[200]">
            <Pressable
              onPress={toggleAudio}
              className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3"
            >
              <Ionicons
                name={audioStatus ? 'pause' : 'play'}
                size={24}
                color="white"
              />
            </Pressable>
            <View className="flex-1">
              <View className="h-2 bg-gray-600 rounded-full mb-2">
                <View className="h-2 bg-blue-500 rounded-full" style={{ width: '30%' }} />
              </View>
              <Text className="text-white text-sm">
                {metadata?.duration ? formatDuration(metadata.duration) : '0:00'}
              </Text>
            </View>
          </View>
        );

      case 'document':
        return (
          <Pressable onPress={openMediaViewer}>
            <View className="flex-row items-center bg-gray-800 rounded-xl p-3 min-w-[200]">
              <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
                <FileText size={24} color="white" strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium text-sm" numberOfLines={1}>
                  {metadata?.file_name || 'מסמך'}
                </Text>
                <Text className="text-gray-400 text-xs">
                  {metadata?.file_size ? formatFileSize(metadata.file_size) : 'גודל לא ידוע'}
                </Text>
              </View>
              <Download size={20} color="#00E654" strokeWidth={2} />
            </View>
          </Pressable>
        );

      default:
        return (
          <View className="bg-gray-800 rounded-xl p-3">
            <Text className="text-white">סוג מדיה לא נתמך</Text>
          </View>
        );
    }
  };

  return (
    <>
      <View className={`max-w-[80%] ${isMe ? 'ml-auto' : 'mr-auto'}`}>
        {renderMediaContent()}
        
        {/* Caption */}
        {caption && (
          <Text 
            className={`text-white text-sm mt-2 ${isMe ? 'text-right' : 'text-left'}`}
            style={{ textAlign: isMe ? 'right' : 'left' }}
          >
            {caption}
          </Text>
        )}
      </View>

      {/* Media Viewer Modal */}
      <MediaViewer
        visible={showMediaViewer}
        onClose={() => setShowMediaViewer(false)}
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        caption={caption}
      />
    </>
  );
}
